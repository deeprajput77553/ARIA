// ─────────────────────────────────────────────────────────────────────────────
// ARIA Backend — server.js
// Express + MongoDB Atlas — Phase 1: Storage Layer
// Collections: nodes, edges, tasks, user_context, audit_log
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const helmet   = require('helmet');
const rateLimit = require('express-rate-limit');

const nodeRoutes       = require('./routes/nodes');
const edgeRoutes       = require('./routes/edges');
const taskRoutes       = require('./routes/tasks');
const userCtxRoutes    = require('./routes/userContext');
const auditRoutes      = require('./routes/auditLog');
const ollamaRoutes     = require('./routes/ollama');

const app  = express();
const PORT = process.env.PORT || 5001;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/nodes',        nodeRoutes);
app.use('/api/edges',        edgeRoutes);
app.use('/api/tasks',        taskRoutes);
app.use('/api/user-context', userCtxRoutes);
app.use('/api/audit',        auditRoutes);
app.use('/api/ollama',       ollamaRoutes);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ARIA ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── DB + Server start ────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
})
  .then(() => {
    console.log('[ARIA] ✅  MongoDB Atlas connected');
  })
  .catch(err => {
    console.warn('[ARIA] ⚠️  MongoDB offline — running in offline mode:', err.message);
    console.warn('[ARIA] ℹ️  All routes will return 503 for DB operations until MongoDB is reachable.');
  });

app.listen(PORT, () => {
  console.log(`[ARIA] 🚀  Backend running on http://localhost:${PORT}`);
  console.log(`[ARIA] 📡  MongoDB status: ${mongoose.connection.readyState === 1 ? 'connected' : 'connecting...'}`);
});
