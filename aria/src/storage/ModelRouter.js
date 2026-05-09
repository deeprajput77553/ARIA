/**
 * ARIA Model Router — Section 19 of ARIA_main.md
 * 
 * Dynamically routes to the correct Ollama model based on task complexity.
 * Fast models for simple tasks, powerful models for planning/reasoning.
 */

// ── Task type → recommended model ─────────────────────────────────────────────
const MODEL_ROUTING = {
  classification: { preferred: ['llama3.2:1b', 'llama3.2', 'phi3'],      reason: 'Fast intent classification' },
  summarization:  { preferred: ['llama3.2:3b', 'llama3.2', 'mistral'],   reason: 'Balanced speed + quality' },
  reasoning:      { preferred: ['llama3.1:8b', 'llama3.3', 'llama3.2'],  reason: 'Deep reasoning & planning' },
  code:           { preferred: ['deepseek-coder:6.7b', 'deepseek-coder', 'llama3.2'], reason: 'Code generation' },
  vision:         { preferred: ['llava:7b', 'llava'],                     reason: 'Image understanding' },
  embedding:      { preferred: ['nomic-embed-text'],                       reason: 'Vector embeddings' },
  general:        { preferred: ['llama3.2', 'llama3.3', 'llama3.1', 'mistral'], reason: 'General purpose' },
};

let _availableModels = null;
let _lastCheck       = 0;

// ── Fetch available models from Ollama ────────────────────────────────────────
async function getAvailableModels() {
  const now = Date.now();
  if (_availableModels && (now - _lastCheck < 30_000)) return _availableModels;
  try {
    const res  = await fetch('http://localhost:11434/api/tags');
    if (!res.ok) throw new Error();
    const data = await res.json();
    _availableModels = (data.models || []).map(m => m.name.toLowerCase());
    _lastCheck = now;
    return _availableModels;
  } catch {
    return [];
  }
}

// ── Select best model for a task type ─────────────────────────────────────────
export async function routeModel(taskType = 'general', fallback = 'llama3.2') {
  const available = await getAvailableModels();
  const route     = MODEL_ROUTING[taskType] || MODEL_ROUTING.general;

  for (const preferred of route.preferred) {
    // Exact match
    if (available.includes(preferred)) return preferred;
    // Partial match (e.g. 'llama3.2' matches 'llama3.2:latest')
    const partial = available.find(m => m.startsWith(preferred.split(':')[0]));
    if (partial) return partial;
  }
  return fallback;
}

// ── Classify intent to determine routing ──────────────────────────────────────
export function classifyTaskType(text) {
  const t = text.toLowerCase();
  if (/write|create|build|generate|code|function|script|implement/.test(t)) return 'code';
  if (/plan|step|how to|strategy|roadmap|break down/.test(t))              return 'reasoning';
  if (/summarize|summary|brief|overview|tldr/.test(t))                      return 'summarization';
  if (/image|photo|picture|screenshot|visual/.test(t))                      return 'vision';
  return 'general';
}

// ── Tool Registry — Section 20 of ARIA_main.md ─────────────────────────────────

export const TOOL_TIERS = {
  1: 'Read Only — Safe, no side effects',
  2: 'Read/Write — Moderate risk',
  3: 'System Level — High risk, requires explicit unlock',
};

export const TOOLS = {
  // Tier 1 — Always available
  web_search:    { tier: 1, description: 'Search the web for information',        safe: true },
  web_summarize: { tier: 1, description: 'Fetch a URL and summarize its content', safe: true },
  read_document: { tier: 1, description: 'Read text from a file',                 safe: true },
  list_directory:{ tier: 1, description: 'List files in a directory',             safe: true },
  get_system_info:{ tier: 1, description: 'Get system CPU, RAM, disk info',       safe: true },
  knowledge_query:{ tier: 1, description: 'Query the knowledge graph',            safe: true },

  // Tier 2 — Unlocked by default, can be locked
  write_document:  { tier: 2, description: 'Create or edit a document',           safe: false },
  create_node:     { tier: 2, description: 'Add a node to the knowledge graph',   safe: false },
  save_profile:    { tier: 2, description: 'Update user profile data',            safe: false },

  // Tier 3 — Requires explicit unlock per session
  open_app:     { tier: 3, description: 'Launch an application',                  safe: false, confirmRequired: true },
  run_command:  { tier: 3, description: 'Execute a shell command (sandboxed)',     safe: false, confirmRequired: true },
  delete_file:  { tier: 3, description: 'Delete a file or directory',             safe: false, confirmRequired: true, dangerous: true },
};

// Per-session tier 3 unlock state
let _tier3Unlocked = false;

export function unlockTier3() { _tier3Unlocked = true; }
export function lockTier3()   { _tier3Unlocked = false; }
export function isTier3Unlocked() { return _tier3Unlocked; }

// ── Check if a tool is permitted to run ───────────────────────────────────────
export function canUseTool(toolName) {
  const tool = TOOLS[toolName];
  if (!tool) return { allowed: false, reason: 'Tool not found in registry' };
  if (tool.tier === 1) return { allowed: true };
  if (tool.tier === 2) return { allowed: true };
  if (tool.tier === 3) {
    if (_tier3Unlocked) return { allowed: true };
    return { allowed: false, reason: `Tier 3 tool "${toolName}" requires explicit session unlock. Ask user to confirm.` };
  }
  return { allowed: false, reason: 'Unknown tier' };
}

// ── Permanently blocked actions — hardcoded safety gate ───────────────────────
const BLOCKED_PATTERNS = [
  /rm\s+-rf/i, /format\s+c:/i, /del\s+\/f/i, /rmdir\s+\/s/i,
  /shutdown/i, /reboot/i, /mkfs/i,
];

export function isSafeCommand(command) {
  return !BLOCKED_PATTERNS.some(p => p.test(command));
}
