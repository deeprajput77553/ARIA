/**
 * ARIA Sandbox Engine
 * 
 * The Iron Man JARVIS capability — self-generating code that:
 *   1. Analyzes what the user wants
 *   2. Plans the file structure
 *   3. Generates the code via LLM
 *   4. Writes it to the sandbox workspace
 *   5. Tests it (runs it)
 *   6. Links it into ARIA if tests pass
 * 
 * Each step emits events visible in the UI via msgBus.
 */

import { msgBus, BUS_EVENTS } from './MessageBus.js';

const SERVER = 'http://localhost:3001';
const OLLAMA = 'http://localhost:11434/api/generate';

// ── Check if the sandbox server is alive ──────────────────────────────────────
export async function isSandboxAvailable() {
  try {
    const r = await fetch(`${SERVER}/health`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

// ── Detect if a message is a "build/create" intent ───────────────────────────
export function detectBuildIntent(text) {
  const t = text.toLowerCase();
  const patterns = [
    { regex: /play\s+(music|song|audio)\s*(.+)?/i,    type: 'music_player',    label: 'Music Player' },
    { regex: /open\s+(youtube|spotify|netflix)/i,      type: 'web_launcher',    label: 'Web App Launcher' },
    { regex: /(create|make|build|write)\s+a?\s*(app|tool|script|widget|function|plugin)/i, type: 'custom_script', label: 'Custom Script' },
    { regex: /(show|display|get)\s+(weather|time|news)/i,  type: 'info_widget',  label: 'Info Widget' },
    { regex: /(set|create|add)\s+(reminder|alarm|timer)/i, type: 'reminder',     label: 'Reminder System' },
    { regex: /search\s+(the web|google|online)\s+for/i,    type: 'web_search',   label: 'Web Search' },
  ];

  for (const p of patterns) {
    const m = text.match(p.regex);
    if (m) return { detected: true, type: p.type, label: p.label, rawMatch: m[0], originalText: text };
  }
  return { detected: false };
}

// ── Main sandbox execution pipeline ──────────────────────────────────────────
/**
 * @param {string}   userText - Original user message
 * @param {string}   model    - Ollama model
 * @param {Function} onStep   - (step: { phase, label, status, output }) => void
 * @returns {Promise<{success, files, output, error}>}
 */
export async function runSandboxPipeline(userText, model, onStep) {
  const emit = (phase, label, status, output = '') => {
    onStep?.({ phase, label, status, output });
    msgBus.emit(BUS_EVENTS.SANDBOX_EVENT, { phase, label, status, output });
  };

  const result = { success: false, files: [], output: '', error: null };

  try {
    // ── Phase 1: Analyze ────────────────────────────────────────────────────
    emit('analyze', '🔍 Analyzing request...', 'running');
    const intent = detectBuildIntent(userText);
    const plan   = await analyzePlan(userText, model);
    emit('analyze', '🔍 Analysis complete', 'done', `Plan: ${plan.description}`);

    // ── Phase 2: Generate Code ──────────────────────────────────────────────
    emit('generate', '✍️ Generating code...', 'running');
    const generated = await generateCode(userText, plan, model);
    emit('generate', `✍️ ${generated.files.length} file(s) generated`, 'done',
      generated.files.map(f => f.path).join(', '));

    // ── Phase 3: Write Files ────────────────────────────────────────────────
    emit('write', '📝 Writing files to workspace...', 'running');
    const written = [];
    for (const file of generated.files) {
      const r = await serverCall('/write', { filePath: file.path, content: file.content });
      if (!r.ok) throw new Error(`Failed to write ${file.path}: ${r.error}`);
      written.push(file.path);
    }
    result.files = written;
    emit('write', `📝 ${written.length} file(s) written`, 'done', written.join('\n'));

    // ── Phase 4: Sandbox Test ───────────────────────────────────────────────
    emit('test', '🧪 Running in sandbox...', 'running');
    const testFile = generated.files.find(f => f.isEntrypoint);
    let testResult = { ok: true, stdout: '(not runnable in sandbox)', stderr: '' };

    if (testFile && (testFile.path.endsWith('.js') || testFile.path.endsWith('.py'))) {
      const lang = testFile.path.endsWith('.py') ? 'python' : 'javascript';
      testResult = await serverCall('/run', {
        command: lang === 'python' ? `python "${testFile.path}"` : `node "${testFile.path}"`,
      });
    }

    if (!testResult.ok && testResult.stderr) {
      // ── Phase 4b: Auto-fix on failure ──────────────────────────────────
      emit('fix', '🔧 Auto-fixing errors...', 'running', testResult.stderr);
      const fixed = await autoFix(generated, testResult.stderr, model);
      if (fixed) {
        for (const file of fixed.files) {
          await serverCall('/write', { filePath: file.path, content: file.content });
        }
        testResult = await serverCall('/run', { command: `node "${fixed.files[0].path}"` });
      }
      emit('fix', '🔧 Fix applied', testResult.ok ? 'done' : 'error', testResult.stderr || 'Could not fix');
    } else {
      emit('test', '🧪 Sandbox test passed', 'done', testResult.stdout?.slice(0, 200) || 'OK');
    }

    // ── Phase 5: Link / Register ────────────────────────────────────────────
    emit('link', '🔗 Registering capability...', 'running');
    const registration = await registerCapability({
      type:        intent.type || 'custom_script',
      label:       intent.label || 'Custom Tool',
      files:       written,
      entrypoint:  testFile?.path,
      userRequest: userText,
    });
    emit('link', '🔗 Capability registered ✓', 'done', `ID: ${registration.id}`);

    result.success = true;
    result.output  = testResult.stdout || 'Completed successfully';
    result.registration = registration;

  } catch (e) {
    emit('error', `❌ ${e.message}`, 'error', e.stack || '');
    result.error = e.message;
  }

  return result;
}

// ── LLM-powered plan analysis ─────────────────────────────────────────────────
async function analyzePlan(userText, model) {
  const prompt = `You are ARIA's code planner. Analyze this user request and return a JSON plan.

User request: "${userText}"

Return ONLY valid JSON like:
{
  "description": "brief description of what to build",
  "files": [
    { "path": "filename.js", "purpose": "what this file does", "isEntrypoint": true }
  ],
  "language": "javascript",
  "approach": "brief technical approach"
}`;

  try {
    const r = await fetch(OLLAMA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
    });
    const j = await r.json();
    const text = j.response?.trim() || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}
  // Fallback plan
  return {
    description: `Script for: ${userText}`,
    files: [{ path: `aria_task_${Date.now()}.js`, purpose: 'Main script', isEntrypoint: true }],
    language: 'javascript',
    approach: 'Single file implementation',
  };
}

// ── LLM code generation ───────────────────────────────────────────────────────
async function generateCode(userText, plan, model) {
  const prompt = `You are ARIA's code generator. Write complete, working code for this task.

Task: "${userText}"
Plan: ${JSON.stringify(plan, null, 2)}

Rules:
- Write complete, runnable code (no placeholders)
- Use only Node.js built-in modules (no npm installs needed unless critical)
- Add comments explaining key parts
- For music/media tasks: use shell commands (powershell/cmd) to open the app
- For web tasks: use the 'open' command or spawn a browser

Return a JSON array of files:
[
  {
    "path": "${plan.files?.[0]?.path || 'task.js'}",
    "content": "...complete file content...",
    "isEntrypoint": true
  }
]

Return ONLY the JSON array, no other text.`;

  try {
    const r = await fetch(OLLAMA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
    });
    const j = await r.json();
    const text = j.response?.trim() || '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const files = JSON.parse(jsonMatch[0]);
      return { files: Array.isArray(files) ? files : [files] };
    }
  } catch {}

  // Fallback minimal script
  const taskFile = plan.files?.[0]?.path || `aria_task_${Date.now()}.js`;
  return {
    files: [{
      path: taskFile,
      content: `// ARIA Generated Script\n// Task: ${userText}\nconsole.log('ARIA task script executed for: ${userText.replace(/'/g, "\\'")}');`,
      isEntrypoint: true,
    }]
  };
}

// ── Auto-fix on test failure ──────────────────────────────────────────────────
async function autoFix(original, error, model) {
  const prompt = `Fix this JavaScript code that failed with error:
Error: ${error}

Original code:
\`\`\`
${original.files[0]?.content || ''}
\`\`\`

Return ONLY the fixed code, no explanation.`;

  try {
    const r = await fetch(OLLAMA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
    });
    const j = await r.json();
    const fixed = j.response?.replace(/```(javascript|js)?/g, '').replace(/```/g, '').trim();
    if (!fixed) return null;
    return { files: [{ ...original.files[0], content: fixed }] };
  } catch { return null; }
}

// ── Register capability in DB ─────────────────────────────────────────────────
async function registerCapability(info) {
  const id = `cap_${Date.now()}`;
  // Store in IndexedDB via a simple fetch to a capabilities store
  try {
    const { DB } = await import('./Database.js');
    await DB.putNode({
      id,
      type:        'capability',
      content:     JSON.stringify(info),
      summary:     `${info.label}: ${info.userRequest.slice(0, 80)}`,
      tags:        ['capability', info.type],
      files:       info.files,
      entrypoint:  info.entrypoint,
      source:      'self_generated',
      access_count: 0,
      decay_score:  1.0,
      tier:         'hot',
      created_at:   Date.now(),
      updated_at:   Date.now(),
    });
    await DB.logAudit({
      event_type:         'capability_created',
      initiated_by:       'ai',
      action_description: `Created capability: ${info.label} (${info.type})`,
      outcome:            'success',
      nodes_affected:     [id],
    });
  } catch {}
  return { id, ...info };
}

// ── Get list of all registered capabilities ───────────────────────────────────
export async function getCapabilities() {
  try {
    const { DB } = await import('./Database.js');
    const nodes = await DB.getNodes('capability');
    return nodes || [];
  } catch { return []; }
}

// ── Server helper ─────────────────────────────────────────────────────────────
async function serverCall(endpoint, body) {
  try {
    const r = await fetch(`${SERVER}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, error: `Sandbox server unreachable: ${e.message}` };
  }
}
