// routes/auditLog.js — Read-only audit log for full transparency (F-17)
const router   = require('express').Router();
const AuditLog = require('../models/AuditLog');

// GET /api/audit — list with filters
router.get('/', async (req, res, next) => {
  try {
    const { event_type, user_id = 'default', limit = 100, skip = 0 } = req.query;
    const filter = { user_id };
    if (event_type) filter.event_type = event_type;

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .skip(Number(skip));

    const total = await AuditLog.countDocuments(filter);
    res.json({ logs, total });
  } catch (e) { next(e); }
});

// POST /api/audit — create audit entry (for frontend to log events)
router.post('/', async (req, res, next) => {
  try {
    const log = await AuditLog.create(req.body);
    res.status(201).json(log);
  } catch (e) { next(e); }
});

module.exports = router;
