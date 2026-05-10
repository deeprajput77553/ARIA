/**
 * ARIA Agent Engine
 * 
 * Orchestrates multi-step autonomous tasks by parsing AI intent into tools.
 * See FEATURES.md F-14 and F-15 for the specification.
 */

import { DB } from '../storage/Database.js';
import { msgBus, BUS_EVENTS } from '../storage/MessageBus.js';
import { speakFemale } from '../components/Logs.jsx';
import { loadSettings } from '../components/SettingsPage.jsx';
import { memoryEngine } from './MemoryEngine.js';

const notify = (title, body) => {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.svg' });
  }
};

const TOOLS = [
  { name: 'write',    desc: 'Write content to a file. Args: { filePath: string, content: string }' },
  { name: 'read',     desc: 'Read a file. Args: { filePath: string }' },
  { name: 'list',     desc: 'List files in a directory. Args: { dir?: string }' },
  { name: 'run',      desc: 'Run a shell command. Args: { command: string, cwd?: string }' },
  { name: 'test',     desc: 'Run a sandbox code test. Args: { testCode: string, language: "javascript"|"python" }' },
  { name: 'validate', desc: 'Validate code safety. Args: { code: string, filename?: string }' },
  { name: 'snapshot', desc: 'Create a git snapshot. Args: { message: string }' },
  { name: 'search',   desc: 'Search for text patterns across the project. Args: { query: string, dir?: string }' },
  { name: 'searchMemory', desc: 'Search long-term memory for past conversations and decisions. Args: { query: string }' },
];

const SYSTEM_PROMPT = `You are ARIA, an autonomous agentic OS.
You solve objectives using reasoning and tools.

RULES:
1. If the user's request is conversational (e.g. "tell me a joke", "who are you"), respond directly in the "response" field and set "action" to null.
2. Only use tools if the objective requires interacting with the system (files, commands, memory).
3. ALWAYS respond in valid JSON. No markdown code blocks.

OUTPUT FORMAT:
{
  "thought": "Brief reasoning",
  "plan": ["Step 1", "Step 2"],
  "action": { "name": "tool_name", "args": { ... } } | null,
  "response": "Final message to user | null"
}

Example (Simple):
{ "thought": "Greeting.", "plan": ["Greet"], "action": null, "response": "Hello!" }

Example (Tool):
{ "thought": "User wants to see files.", "plan": ["List directory"], "action": { "name": "list", "args": {} }, "response": null }`;

class AgentEngine {
  constructor() {
    this.isProcessing = false;
    this.maxSteps = 10;
  }

  async run(userPrompt, model = 'llama3.2', existingAiMsgId = null) {
    if (this.isProcessing) throw new Error('Agent already busy');
    this.isProcessing = true;

    let aiMsgId = existingAiMsgId;
    let stepsTaken = 0;
    
    // 1. Immediate UI Feedback
    if (aiMsgId) {
      await DB.updateMessage(aiMsgId, { 
        text: 'Analyzing request...',
        steps: [{ label: 'Cognitive check', status: 'running' }]
      });
      msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE);
    }

    // 2. Optimization: Skip memory search for very short/common messages
    const greetings = ['hi', 'hello', 'hey', 'hii', 'hy', 'who are you', 'how are you'];
    let memories = [];
    if (!greetings.includes(userPrompt.toLowerCase().trim())) {
      memories = await memoryEngine.searchMemory(userPrompt);
    }
    
    const memoryContext = memories.length > 0 
      ? `\nRELEVANT MEMORIES:\n${memories.map(m => `- ${m.content}`).join('\n')}`
      : '';

    let context = [{ role: 'user', content: userPrompt + memoryContext }];

    try {
      while (stepsTaken < this.maxSteps) {
        stepsTaken++;
        
        // 3. Update UI to show LLM activity
        if (aiMsgId) {
          await DB.updateMessage(aiMsgId, { 
            text: stepsTaken === 1 ? 'Reasoning...' : 'Executing plan...',
            steps: [{ label: `Step ${stepsTaken}`, status: 'running' }]
          });
          msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE);
        }

        // 4. Get AI Decision
        const response = await this.callLLM(model, context);
        let decision = this.parseDecision(response);
        
        if (!decision) {
          console.warn('AgentEngine: Failed to parse decision, using raw text as response.');
          decision = {
            thought: 'Conversational response detected.',
            plan: ['Direct response'],
            action: null,
            response: response
          };
        }

        // 3. Update UI Message with actual thought/plan
        if (!aiMsgId) {
          const msg = await DB.addMessage('ai', decision.thought || 'Processing...', this.formatSteps(decision.plan, 0));
          aiMsgId = msg.id;
          msgBus.emit(BUS_EVENTS.NEW_MESSAGE, msg);
        } else {
          await DB.updateMessage(aiMsgId, { 
            text: String(decision.thought || decision.response || 'Processing next objective...'), 
            steps: this.formatSteps(decision.plan || [], stepsTaken - 1) 
          });
          msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE);
        }

        // 3. Handle Final Response
        if (!decision.action) {
          await DB.updateMessage(aiMsgId, { 
            text: String(decision.response || decision.thought || 'Task completed.'), 
            steps: this.formatSteps(decision.plan || ['Completed'], 999) 
          });
          msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE);
          speakFemale(String(decision.response || decision.thought), loadSettings());
          if (stepsTaken > 1) notify('Task Complete', String(decision.response || decision.thought));
          break;
        }

        // 4. Execute Action
        const result = await this.executeAction(decision.action);
        
        // 5. Add to context and loop
        context.push({ role: 'assistant', content: response });
        context.push({ role: 'user', content: `TOOL RESULT (${decision.action.name}):\n${JSON.stringify(result, null, 2)}` });

        if (stepsTaken >= this.maxSteps) {
          await DB.updateMessage(aiMsgId, { 
            text: "I've reached my maximum reasoning steps. Should I continue or pivot?", 
            steps: this.formatSteps(decision.plan || [], stepsTaken) 
          });
          msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE);
        }
      }
    } catch (err) {
      console.error('Agent Loop Error:', err);
      if (aiMsgId) {
        await DB.updateMessage(aiMsgId, { text: `⚠ Error: ${err.message}`, steps: [{ label: 'Error', status: 'error' }] });
        msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async callLLM(model, messages) {
    const chatMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
    ];

    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: chatMessages, stream: false })
    });
    const data = await res.json();
    return data.message.content;
  }

  parseDecision(text) {
    if (!text) return null;
    
    // 1. Try to strip markdown code blocks
    let clean = text.replace(/```json\n?|```/g, '').trim();
    
    try {
      // 2. Try direct parse
      return JSON.parse(clean);
    } catch (e) {
      // 3. Try to find the outermost { and }
      try {
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          const possibleJson = clean.substring(start, end + 1);
          return JSON.parse(possibleJson);
        }
      } catch (e2) {
        // 4. Emergency: try to repair common JSON errors
        try {
          let repaired = clean.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']'); // Remove trailing commas
          const start = repaired.indexOf('{');
          const end = repaired.lastIndexOf('}');
          if (start !== -1 && end !== -1) {
            return JSON.parse(repaired.substring(start, end + 1));
          }
        } catch (e3) {
          console.error('Failed to parse and repair JSON decision:', text);
        }
      }
      return null;
    }
  }

  formatSteps(plan, currentStepIdx) {
    return plan.map((p, i) => ({
      label: p,
      status: i < currentStepIdx ? 'done' : (i === currentStepIdx ? 'running' : 'pending')
    }));
  }

  async executeAction(action) {
    const { name, args } = action;

    // F-04: Auto-snapshot before write
    if (name === 'write') {
      try {
        await fetch('http://localhost:3001/git/snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `Before writing ${args.filePath}` })
        });
      } catch (e) {
        console.warn('Auto-snapshot failed:', e);
      }
    }

    if (name === 'searchMemory') {
      return await memoryEngine.searchMemory(args.query);
    }

    const url = `http://localhost:3001/${name === 'snapshot' ? 'git/snapshot' : name}`;
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });
      return await res.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
}

export const agentEngine = new AgentEngine();
