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

const SYSTEM_PROMPT = `You are ARIA (Advanced Recursive Intelligence Archive), an autonomous agentic operating system.
MANDATORY: You must ALWAYS respond in STRICT JSON format. No conversational text before or after the JSON block.

AVAILABLE TOOLS:
${TOOLS.map(t => `- ${t.name}: ${t.desc}`).join('\n')}

OUTPUT JSON STRUCTURE:
{
  "thought": "Internal reasoning (hidden from user in final response but used for planning)",
  "plan": ["Step 1", "Step 2"],
  "action": { "name": "tool_name", "args": { ... } } | null,
  "response": "Final message to user (string) | null"
}

EXAMPLES:

User: "Create a file named hello.js"
Response:
{
  "thought": "The user wants to create a file. I will use the write tool.",
  "plan": ["Write hello.js", "Verify file"],
  "action": { "name": "write", "args": { "filePath": "hello.js", "content": "console.log('hello')" } },
  "response": null
}

User: "Who are you?"
Response:
{
  "thought": "Simple identification request.",
  "plan": ["Identify self"],
  "action": null,
  "response": "I am ARIA, your autonomous agentic operating system."
}

CRITICAL: 
- Never include markdown code blocks for the JSON itself. 
- Always ensure all fields are present.
- If you cannot fulfill a request, provide an explanation in the "response" field and set "action" to null.`;

class AgentEngine {
  constructor() {
    this.isProcessing = false;
    this.maxSteps = 10;
  }

  async run(userPrompt, model = 'llama3.2', existingAiMsgId = null) {
    if (this.isProcessing) throw new Error('Agent already busy');
    this.isProcessing = true;

    let stepsTaken = 0;
    
    let aiMsgId = existingAiMsgId;

    // 1. Immediate UI Feedback
    if (aiMsgId) {
      await DB.updateMessage(aiMsgId, { 
        text: 'Initializing neural reasoning...',
        steps: [{ label: 'Searching memory', status: 'running' }]
      });
      msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE);
    }

    // 2. Search memory for context
    const memories = await memoryEngine.searchMemory(userPrompt);
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
            text: stepsTaken === 1 ? 'Synthesizing strategy...' : 'Analyzing result and planning next step...',
            steps: [{ label: `Reasoning step ${stepsTaken}`, status: 'running' }]
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
