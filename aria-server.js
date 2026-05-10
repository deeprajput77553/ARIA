/**
 * ARIA Sandbox Server
 * 
 * A lightweight Node.js/Express backend that gives ARIA
 * safe, controlled access to the filesystem and terminal.
 * 
 * Start with: node aria-server.js
 * Runs on:    http://localhost:3001
 * 
 * Security model:
 *  - All file ops are restricted to the ARIA_WORKSPACE directory
 *  - Commands are run in a sandboxed shell with a 10s timeout
 *  - Dangerous commands (rm -rf, format, etc.) are blocked
 */

const express  = require('express');
const cors     = require('cors');
const { exec } = require('child_process');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const Validator = require('./validator');

const app  = express();
const PORT = 3001;
const validator = new Validator();

// ── Workspace Observer (F-18) ────────────────────────────────────────────────
fs.watch(__dirname, { recursive: true }, (eventType, filename) => {
  if (filename && !filename.includes('node_modules') && !filename.includes('.git') && !filename.includes('aria_workspace')) {
    // We don't have direct access to the DB here easily without more setup, 
    // so we'll just log to console for now or we could emit to a socket if we had one.
    // Actually, we can just print it and the agent can read the server logs if needed.
    console.log(`[OBSERVER] ${eventType}: ${filename}`);
  }
});

// ── Sandbox workspace ─────────────────────────────────────────────────────────
const WORKSPACE = path.join(__dirname, 'aria_workspace');
if (!fs.existsSync(WORKSPACE)) fs.mkdirSync(WORKSPACE, { recursive: true });

// ── Safety blocklist ──────────────────────────────────────────────────────────
const BLOCKED = [
  /rm\s+-rf/i, /rmdir\s+\/s/i, /format\s+c/i,
  /del\s+\/f/i, /shutdown/i, /reboot/i, /mkfs/i,
  /drop\s+database/i, /truncate/i,
  /:(){:|:&};:/,  // fork bomb
];

function isSafe(cmd) {
  return !BLOCKED.some(p => p.test(cmd));
}

function resolveSafe(filePath) {
  const resolved = path.resolve(WORKSPACE, filePath);
  if (!resolved.startsWith(WORKSPACE)) throw new Error('Path traversal blocked');
  return resolved;
}

app.use(cors());
app.use(express.json());

// ── GET /health ───────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ ok: true, workspace: WORKSPACE });
});

// ── POST /write ───────────────────────────────────────────────────────────────
app.post('/write', (req, res) => {
  try {
    const { filePath, content } = req.body;
    if (!filePath) return res.status(400).json({ error: 'filePath required' });
    const safe = resolveSafe(filePath);
    fs.mkdirSync(path.dirname(safe), { recursive: true });
    fs.writeFileSync(safe, content || '', 'utf8');
    res.json({ ok: true, path: safe });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /read ────────────────────────────────────────────────────────────────
app.post('/read', (req, res) => {
  try {
    const { filePath } = req.body;
    const safe = resolveSafe(filePath);
    const content = fs.readFileSync(safe, 'utf8');
    res.json({ ok: true, content });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /list ────────────────────────────────────────────────────────────────
app.post('/list', (req, res) => {
  try {
    const { dir } = req.body;
    const safe = dir ? resolveSafe(dir) : WORKSPACE;
    const files = fs.readdirSync(safe).map(name => {
      const full = path.join(safe, name);
      const stat = fs.statSync(full);
      return { name, isDir: stat.isDirectory(), size: stat.size };
    });
    res.json({ ok: true, files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /delete ──────────────────────────────────────────────────────────────
app.post('/delete', (req, res) => {
  try {
    const { filePath } = req.body;
    const safe = resolveSafe(filePath);
    fs.rmSync(safe, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /run ─────────────────────────────────────────────────────────────────
// Execute a shell command inside the workspace with timeout
app.post('/run', (req, res) => {
  const { command, cwd } = req.body;
  if (!command) return res.status(400).json({ error: 'command required' });
  if (!isSafe(command)) return res.status(403).json({ error: 'Command blocked by safety policy' });

  const safeCwd = cwd ? resolveSafe(cwd) : WORKSPACE;

  exec(command, {
    cwd: safeCwd,
    timeout: 15000,
    maxBuffer: 2 * 1024 * 1024,
    shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
  }, (err, stdout, stderr) => {
    res.json({
      ok:       !err,
      stdout:   stdout || '',
      stderr:   stderr || '',
      exitCode: err?.code || 0,
      error:    err?.message || null,
    });
  });
});

// ── POST /validate ───────────────────────────────────────────────────────────
app.post('/validate', (req, res) => {
  const { code, filename } = req.body;
  if (!code) return res.status(400).json({ error: 'code required' });
  const result = validator.validate(code, filename);
  res.json(result);
});

// ── POST /test ────────────────────────────────────────────────────────────────
// Write + run in one step (the "sandbox test" step)
app.post('/test', async (req, res) => {
  const { testCode, language, skipValidation } = req.body;
  if (!testCode) return res.status(400).json({ error: 'testCode required' });

  // Optional pre-validation
  if (!skipValidation) {
    const v = validator.validate(testCode);
    if (!v.valid && v.recommendation === 'reject') {
      return res.status(403).json({ error: 'Validation failed: Unsafe code patterns detected', details: v });
    }
  }

  const ext = language === 'python' ? '.py' : '.js';
  const testFile = `sandbox_test_${Date.now()}${ext}`;
  const safePath = resolveSafe(testFile);

  try {
    fs.writeFileSync(safePath, testCode, 'utf8');
    const runner = language === 'python' ? 'python' : 'node';
    const result = await new Promise((resolve) => {
      exec(`${runner} "${safePath}"`, { cwd: WORKSPACE, timeout: 10000, maxBuffer: 512 * 1024 },
        (err, stdout, stderr) => resolve({ ok: !err, stdout, stderr, error: err?.message })
      );
    });
    // Clean up test file
    try { fs.unlinkSync(safePath); } catch {}
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /ollama-generate ─────────────────────────────────────────────────────
// Proxy for Ollama (avoids CORS if needed)
app.post('/ollama-generate', async (req, res) => {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /git/snapshot ───────────────────────────────────────────────────────
app.post('/git/snapshot', (req, res) => {
  const { message } = req.body;
  const msg = message ? `AI_SNAPSHOT: ${message}` : `AI_SNAPSHOT: session_${Date.now()}`;
  
  exec('git add -A && git commit -m "' + msg + '"', { cwd: __dirname }, (err, stdout, stderr) => {
    if (err && !stdout.includes('nothing to commit')) {
      return res.status(500).json({ error: err.message, stderr });
    }
    res.json({ ok: true, message: msg, output: stdout });
  });
});

// ── POST /git/rollback ───────────────────────────────────────────────────────
app.post('/git/rollback', (req, res) => {
  exec('git reset --hard HEAD~1', { cwd: __dirname }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: err.message, stderr });
    res.json({ ok: true, output: stdout });
  });
});

// ── POST /search ─────────────────────────────────────────────────────────────
app.post('/search', (req, res) => {
  const { query, dir } = req.body;
  if (!query) return res.status(400).json({ error: 'query required' });
  
  const searchDir = dir ? resolveSafe(dir) : __dirname;
  const results = [];
  const q = query.toLowerCase();

  const walk = (d) => {
    const files = fs.readdirSync(d);
    for (const f of files) {
      const p = path.join(d, f);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        if (['node_modules', '.git', 'aria_workspace', 'dist'].includes(f)) continue;
        walk(p);
      } else {
        const content = fs.readFileSync(p, 'utf8');
        if (content.toLowerCase().includes(q)) {
          const lines = content.split('\n');
          lines.forEach((line, i) => {
            if (line.toLowerCase().includes(q)) {
              results.push(`${path.relative(__dirname, p)}:${i + 1}: ${line.trim()}`);
            }
          });
        }
      }
      if (results.length > 100) break;
    }
  };

  try {
    walk(searchDir);
    res.json({ results: results.slice(0, 50), count: results.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🔮 ARIA Sandbox Server running on http://localhost:${PORT}`);
  console.log(`📁 Workspace: ${WORKSPACE}`);
  console.log(`🛡  Safety: ${BLOCKED.length} command patterns blocked\n`);
});
