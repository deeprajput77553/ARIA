// routes/userContext.js — User preferences & behavior pattern sync
const router      = require('express').Router();
const UserContext = require('../models/UserContext');

// GET /api/user-context  OR  /api/user-context/:user_id
router.get('/', async (req, res, next) => {
  try {
    const uid = req.query.user_id || 'default';
    let ctx = await UserContext.findOne({ user_id: uid });
    if (!ctx) ctx = await UserContext.create({ user_id: uid });
    res.json(ctx);
  } catch (e) { next(e); }
});

router.get('/:user_id', async (req, res, next) => {
  try {
    const uid = req.params.user_id || 'default';
    let ctx = await UserContext.findOne({ user_id: uid });
    if (!ctx) ctx = await UserContext.create({ user_id: uid });
    res.json(ctx);
  } catch (e) { next(e); }
});

// PUT /api/user-context
router.put('/', async (req, res, next) => {
  try {
    const uid = req.body.user_id || 'default';
    const ctx = await UserContext.findOneAndUpdate(
      { user_id: uid },
      { $set: req.body },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(ctx);
  } catch (e) { next(e); }
});

router.put('/:user_id', async (req, res, next) => {
  try {
    const uid = req.params.user_id || 'default';
    const ctx = await UserContext.findOneAndUpdate(
      { user_id: uid },
      { $set: req.body },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(ctx);
  } catch (e) { next(e); }
});

// PATCH /api/user-context/:user_id/behavior
router.patch('/:user_id/behavior', async (req, res, next) => {
  try {
    const ctx = await UserContext.findOneAndUpdate(
      { user_id: req.params.user_id },
      { $set: { behavior_patterns: req.body } },
      { new: true, upsert: true }
    );
    res.json(ctx);
  } catch (e) { next(e); }
});

module.exports = router;
