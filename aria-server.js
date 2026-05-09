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

const app  = express();
const PORT = 3001;

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

// ── POST /test ────────────────────────────────────────────────────────────────
// Write + run in one step (the "sandbox test" step)
app.post('/test', async (req, res) => {
  const { testCode, language } = req.body;
  if (!testCode) return res.status(400).json({ error: 'testCode required' });

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

app.listen(PORT, () => {
  console.log(`\n🔮 ARIA Sandbox Server running on http://localhost:${PORT}`);
  console.log(`📁 Workspace: ${WORKSPACE}`);
  console.log(`🛡  Safety: ${BLOCKED.length} command patterns blocked\n`);
});
