/**
 * ARIA Agent Engine
 * 
 * Orchestrates multi-step autonomous tasks by parsing AI intent into tools.
 * See FEATURES.md F-14 and F-15 for the specification.
 */

import { DB } from '../storage/Database.js';
import { msgBus, BUS_EVENTS } from '../storage/MessageBus.js';
import { speak as speakFemale } from '../utils/voice';
import { loadSettings } from '../components/SettingsPage';
import { memoryEngine } from './MemoryEngine.js';
import { loadProfile, buildProfileContext, extractProfileFromMessage } from '../storage/UserProfile.js';

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
  { name: 'saveProfile',  desc: 'Store personal data about the user (name, prefs, etc). Args: { [key: string]: any }' },
  { name: 'getProfile',   desc: 'Retrieve stored user profile data. Args: {}' },
  { name: 'commit',       desc: 'Save all current workspace changes to git. Args: { message: string }' },
];

const SYSTEM_PROMPT = `You are ARIA, an autonomous agentic OS.
You solve objectives using reasoning and tools.

CORE OBJECTIVES:
1. AUTONOMY: Plan and execute multi-step tasks.
2. NEURAL MEMORY: Use "saveProfile" to remember new user details and "getProfile" to retrieve the full profile if needed. You ALREADY have some user context in the prompt.
3. SYSTEM CONTROL: Use tools to manage files and git state.

RULES:
1. MANDATORY: ALWAYS respond in valid JSON.
2. NO conversational text outside the JSON block.
3. The "action" field must be a tool object { "name": "...", "args": {} } OR the value null. 
4. If you have the final answer or the task is finished, set "action" to null and provide your final answer in "response".
5. NEVER use placeholders like [user.name] or {name}. Use the actual values provided in the context (e.g., if you see "User Name: Ajinkya", say "Ajinkya").

OUTPUT FORMAT:
{
  "thought": "Internal reasoning",
  "plan": ["Step 1"],
  "action": null,
  "response": "Message to user"
}`;

class AgentEngine {
  constructor() {
    this.isProcessing = false;
    this.maxSteps = 10;
    this.lastActions = []; // To detect loops
  }

  async run(userPrompt, model = 'llama3.2', existingAiMsgId = null) {
    if (this.isProcessing) throw new Error('Agent already busy');
    this.isProcessing = true;
    msgBus.emit(BUS_EVENTS.AGENT_STATUS, { status: 'busy', action: 'Thinking...' });

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

    // 2. Load Profile Context
    const profile = await loadProfile();
    const profileContext = buildProfileContext(profile);

    // 3. Optimization: Skip memory search for very short/common messages
    const greetings = ['hi', 'hello', 'hey', 'hii', 'hy', 'who are you', 'how are you'];
    let memories = [];
    if (!greetings.includes(userPrompt.toLowerCase().trim())) {
      memories = await memoryEngine.searchMemory(userPrompt);
    }
    
    const memoryContext = memories.length > 0 
      ? `\nRELEVANT MEMORIES:\n${memories.map(m => `- ${m.content}`).join('\n')}`
      : '';

    let context = [{ role: 'user', content: profileContext + userPrompt + memoryContext }];
    this.lastActions = []; // Reset loop detection

    const safeText = (val) => {
      if (typeof val !== 'string') return String(val || '');
      return val;
    };

    try {
      while (stepsTaken < this.maxSteps) {
        stepsTaken++;
        
        // 4. Get AI Decision
        msgBus.emit(BUS_EVENTS.AGENT_STATUS, { status: 'busy', action: 'Reasoning...' });
        const response = await this.callLLM(model, context);
        let decision = this.parseDecision(response);
        
        if (!decision) {
          console.warn('AgentEngine: Failed to parse decision. Treating as final response.');
          decision = {
            thought: 'Fallback (failed to parse JSON)',
            plan: [],
            action: null,
            response: response.replace(/```json\n?|```/g, '').trim()
          };
        }

        // 3. Update UI Message with actual thought/plan
        if (!aiMsgId) {
          const msg = await DB.addMessage('ai', decision.thought || 'Processing...', this.formatSteps(decision.plan, 0));
          aiMsgId = msg.id;
          msgBus.emit(BUS_EVENTS.NEW_MESSAGE, msg);
        } else if (decision.action) {
          await DB.updateMessage(aiMsgId, { 
            text: safeText(decision.response || decision.thought || 'Processing next objective...'), 
            steps: this.formatSteps(decision.plan || [], stepsTaken - 1) 
          });
          msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE);
        }

        // 3. Handle Final Response
        if (!decision.action) {
          await DB.updateMessage(aiMsgId, { 
            text: safeText(decision.response || decision.thought) || 'Task completed.', 
            steps: this.formatSteps(decision.plan || ['Completed'], 999) 
          });
          msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE);
          msgBus.emit(BUS_EVENTS.AGENT_STATUS, { status: 'idle' });
          speakFemale(safeText(decision.response || decision.thought), loadSettings());
          if (stepsTaken > 1) notify('Task Complete', safeText(decision.response || decision.thought));
          break;
        }

        // 4. Loop Detection
        const actionKey = `${decision.action.name}:${JSON.stringify(decision.action.args)}`;
        if (this.lastActions.includes(actionKey)) {
          console.warn('Loop detected! Stopping agent.');
          await DB.updateMessage(aiMsgId, { 
            text: "I'm noticing a loop in my reasoning. I'll stop here to prevent wasting resources. How should we proceed?", 
            steps: this.formatSteps(decision.plan || [], stepsTaken) 
          });
          msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE);
          msgBus.emit(BUS_EVENTS.AGENT_STATUS, { status: 'error', action: 'Loop detected' });
          break;
        }
        this.lastActions.push(actionKey);
        if (this.lastActions.length > 3) this.lastActions.shift();

        // 5. Execute Action
        msgBus.emit(BUS_EVENTS.AGENT_STATUS, { status: 'busy', action: `Executing: ${decision.action.name}` });
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
          msgBus.emit(BUS_EVENTS.AGENT_STATUS, { status: 'idle' });
        }
      }
    } catch (err) {
      console.error('Agent Loop Error:', err);
      msgBus.emit(BUS_EVENTS.AGENT_STATUS, { status: 'error', action: err.message });
      if (aiMsgId) {
        await DB.updateMessage(aiMsgId, { text: `⚠ Error: ${err.message}`, steps: [{ label: 'Error', status: 'error' }] });
        msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE);
      }
    } finally {
      this.isProcessing = false;
      // Background extraction (Level 5)
      loadProfile().then(p => {
        extractProfileFromMessage(userPrompt, p, model).catch(() => {});
      });
    }
  }

  async callLLM(model, messages) {
    const chatMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
    ];

    try {
      const res = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: chatMessages, stream: false })
      });
      const data = await res.json();
      return data.message?.content || '';
    } catch (e) {
      return JSON.stringify({
        thought: "System error: Ollama connection failed.",
        plan: [],
        action: null,
        response: "I'm having trouble connecting to my core brain (Ollama). Please ensure it's running."
      });
    }
  }

  parseDecision(text) {
    if (!text) return null;
    const clean = text.replace(/```json\n?|```/g, '').trim();
    
    // 1. Try direct parse
    try { return JSON.parse(clean); } catch(e) {}

    // 2. Outermost JSON extraction
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    const possibleJson = clean.substring(start, end + 1);
    try {
      return JSON.parse(possibleJson);
    } catch (e) {
      // 3. Robust fix for common LLM JSON errors
      try {
        const fixed = possibleJson
          .replace(/([{,]\s*)([a-z0-9_]+)\s*:/g, '$1"$2":') // Quote unquoted keys
          .replace(/:\s*'([^']*)'/g, ': "$1"') // Replace single quotes with double quotes
          .replace(/,\s*\}/g, '}') // Remove trailing commas
          .replace(/,\s*\]/g, ']'); 
        return JSON.parse(fixed);
      } catch {
        // Last resort: Try to find ANY json block
        const allMatches = clean.match(/\{[\s\S]*?\}/g);
        if (allMatches) {
          for (let m of allMatches.reverse()) {
            try { return JSON.parse(m); } catch(e3) {}
          }
        }
      }
    }
    
    console.error('Failed to parse any JSON from LLM output:', text);
    return null;
  }

  formatSteps(plan, currentIdx) {
    if (!Array.isArray(plan)) return [];
    return plan.map((p, i) => ({
      label: p,
      status: i < currentIdx ? 'done' : (i === currentIdx ? 'running' : 'pending')
    }));
  }

  async executeAction(action) {
    const { name, args } = action;
    try {
      let result;
      if (name === 'write') {
        const res = await fetch('http://localhost:3001/file/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args)
        });
        result = await res.json();
      } else if (name === 'read') {
        const res = await fetch(`http://localhost:3001/file/read?filePath=${encodeURIComponent(args.filePath)}`);
        result = await res.json();
      } else if (name === 'list') {
        const res = await fetch(`http://localhost:3001/file/list?dir=${encodeURIComponent(args.dir || '.')}`);
        result = await res.json();
      } else if (name === 'run') {
        const res = await fetch('http://localhost:3001/sys/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args)
        });
        result = await res.json();
      } else if (name === 'saveProfile') {
        result = await DB.saveProfile(args);
      } else if (name === 'getProfile') {
        result = await DB.getProfile();
      } else if (name === 'searchMemory') {
        result = await memoryEngine.searchMemory(args.query);
      } else {
        result = { error: `Unknown tool: ${name}` };
      }

      await DB.logAudit({
        event_type: 'tool_execution',
        initiated_by: 'ai',
        action_description: `Executed tool: ${name}`,
        outcome: result.error ? 'failure' : 'success',
        details: JSON.stringify(args)
      });
      return result;
    } catch (e) {
      await DB.logAudit({
        event_type: 'tool_execution',
        initiated_by: 'ai',
        action_description: `Failed tool: ${name}`,
        outcome: 'error',
        details: e.message
      });
      return { error: `Tool execution failed: ${e.message}` };
    }
  }
}

export const agentEngine = new AgentEngine();
