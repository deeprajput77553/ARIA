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

const SYSTEM_PROMPT = `You are ARIA, an autonomous AI coding agent.
You achieve user goals by planning and executing steps using tools.

AVAILABLE TOOLS:
${TOOLS.map(t => `- ${t.name}: ${t.desc}`).join('\n')}

OUTPUT FORMAT:
You must ALWAYS respond with a JSON object. No markdown, no conversational text before or after.
Format:
{
  "thought": "Your reasoning about the current state and what to do next",
  "plan": ["Step 1", "Step 2", ...],
  "action": { "name": "tool_name", "args": { ... } } | null,
  "response": "Final message to user when goal is achieved or blocked"
}

If you need to perform multiple steps, return the first action. After that action is executed, you will be called again with the result to determine the next action.
When the task is complete, set "action" to null and provide a "response".`;

class AgentEngine {
  constructor() {
    this.isProcessing = false;
    this.maxSteps = 10;
  }

  async run(userPrompt, model = 'llama3.2', onStepUpdate) {
    if (this.isProcessing) throw new Error('Agent already busy');
    this.isProcessing = true;

    let stepsTaken = 0;
    
    // Search memory for context
    const memories = await memoryEngine.searchMemory(userPrompt);
    const memoryContext = memories.length > 0 
      ? `\nRELEVANT MEMORIES:\n${memories.map(m => `- ${m.content}`).join('\n')}`
      : '';

    let context = [{ role: 'user', content: userPrompt + memoryContext }];
    let aiMsgId = null;

    try {
      while (stepsTaken < this.maxSteps) {
        stepsTaken++;
        
        // 1. Get AI Decision
        const response = await this.callLLM(model, context);
        const decision = this.parseDecision(response);
        
        if (!decision) {
          throw new Error('Failed to parse AI decision');
        }

        // 2. Update UI Message
        if (!aiMsgId) {
          const msg = await DB.addMessage('ai', decision.thought || 'Planning...', this.formatSteps(decision.plan, 0));
          aiMsgId = msg.id;
          msgBus.emit(BUS_EVENTS.NEW_MESSAGE, msg);
        } else {
          await DB.updateMessage(aiMsgId, { 
            text: decision.thought || decision.response || 'Processing...', 
            steps: this.formatSteps(decision.plan || [], stepsTaken) 
          });
          msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE);
        }

        // 3. Handle Final Response
        if (!decision.action) {
          await DB.updateMessage(aiMsgId, { 
            text: decision.response || decision.thought, 
            steps: this.formatSteps(decision.plan || ['Completed'], 999) 
          });
          msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE);
          speakFemale(decision.response || decision.thought, loadSettings());
          if (stepsTaken > 1) notify('Task Complete', decision.response || decision.thought);
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
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;
      return JSON.parse(match[0]);
    } catch {
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
