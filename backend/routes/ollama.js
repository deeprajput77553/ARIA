// routes/ollama.js — Proxy to local Ollama + NVIDIA NIM fallback
// This route streams responses from Ollama and logs each call to audit_log.
const router   = require('express').Router();
const AuditLog = require('../models/AuditLog');
const Node     = require('../models/Node');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// POST /api/ollama/chat — streaming chat proxy
router.post('/chat', async (req, res, next) => {
  const { prompt, model = 'llama3.2', user_id = 'default', session_id = '', save_node = false } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const startTime = Date.now();

  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: true }),
    });

    if (!ollamaRes.ok) throw new Error(`Ollama HTTP ${ollamaRes.status}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader   = ollamaRes.body.getReader();
    const decoder  = new TextDecoder();
    let   full     = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.response) {
            full += json.response;
            res.write(`data: ${JSON.stringify({ token: json.response })}\n\n`);
          }
          if (json.done) {
            res.write(`data: ${JSON.stringify({ done: true, full })}\n\n`);
          }
        } catch { /* partial chunk */ }
      }
    }

    res.end();

    // ── Post-response: audit + optional node save ────────────────────────
    const duration = Date.now() - startTime;

    await AuditLog.create({
      session_id,
      event_type:         'ollama_call',
      initiated_by:       'user',
      tool_used:          model,
      action_description: `LLM call: ${model} | prompt: "${prompt.slice(0,80)}..."`,
      outcome:            'success',
      user_id,
      metadata:           { duration_ms: duration, response_length: full.length },
    });

    if (save_node && full.trim()) {
      await Node.create({
        content:   `Q: ${prompt}\nA: ${full}`,
        summary:   full.slice(0, 120),
        type:      'information',
        source:    'voice',
        tags:      ['ai-response', model],
        user_id,
        tier:      'hot',
      });
    }

  } catch (err) {
    // Try NVIDIA NIM fallback
    console.warn('[ARIA] Ollama offline, attempting NVIDIA NIM fallback');
    try {
      const nimRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${process.env.NVIDIA_API_KEY_CHAT}`,
        },
        body: JSON.stringify({
          model: 'meta/llama-3.1-8b-instruct',
          messages: [{ role: 'user', content: prompt }],
          stream: false,
        }),
      });
      const nimData = await nimRes.json();
      const content = nimData?.choices?.[0]?.message?.content || 'No response from NIM.';
      res.json({ full: content, source: 'nvidia_nim' });

      await AuditLog.create({
        session_id, event_type: 'ollama_call', initiated_by: 'user',
        tool_used: 'nvidia_nim', outcome: 'success', user_id,
        action_description: `NIM fallback used for: "${prompt.slice(0,80)}"`,
      });
    } catch (nimErr) {
      next(nimErr);
    }
  }
});

// GET /api/ollama/models — available models
router.get('/models', async (req, res, next) => {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await r.json();
    res.json(data);
  } catch {
    res.json({ models: [], error: 'Ollama offline' });
  }
});

module.exports = router;
