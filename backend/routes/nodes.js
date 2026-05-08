// routes/nodes.js — Knowledge Graph Node CRUD + search
const router   = require('express').Router();
const Node     = require('../models/Node');
const AuditLog = require('../models/AuditLog');

// GET /api/nodes — list (filterable by type, tier, tags)
router.get('/', async (req, res, next) => {
  try {
    const { type, tier, tag, q, limit = 50, skip = 0 } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (tier) filter.tier = tier;
    if (tag)  filter.tags = tag;
    if (q)    filter.$text = { $search: q };

    const nodes = await Node.find(filter)
      .sort({ decay_score: -1, 'updated_at': -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .select('-embeddings'); // never send embeddings over API by default

    const total = await Node.countDocuments(filter);
    res.json({ nodes, total, skip: Number(skip), limit: Number(limit) });
  } catch (e) { next(e); }
});

// GET /api/nodes/:id
router.get('/:id', async (req, res, next) => {
  try {
    const node = await Node.findById(req.params.id).select('-embeddings');
    if (!node) return res.status(404).json({ error: 'Node not found' });

    // Bump access count
    node.access_count  += 1;
    node.last_accessed  = new Date();
    await node.save();

    res.json(node);
  } catch (e) { next(e); }
});

// POST /api/nodes — create a new knowledge node
router.post('/', async (req, res, next) => {
  try {
    const node = new Node(req.body);
    await node.save();

    // Audit
    await AuditLog.create({
      event_type:         'node_created',
      initiated_by:       req.body.source === 'system' ? 'ai' : 'user',
      nodes_affected:     [node._id],
      action_description: `Node created: "${node.summary || node.content.slice(0,60)}..." [type: ${node.type}]`,
      user_id:            node.user_id,
      metadata:           { type: node.type, tags: node.tags },
    });

    res.status(201).json(node);
  } catch (e) { next(e); }
});

// PATCH /api/nodes/:id — update a node
router.patch('/:id', async (req, res, next) => {
  try {
    const node = await Node.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!node) return res.status(404).json({ error: 'Node not found' });
    res.json(node);
  } catch (e) { next(e); }
});

// DELETE /api/nodes/:id — soft delete (archive)
router.delete('/:id', async (req, res, next) => {
  try {
    const node = await Node.findByIdAndUpdate(req.params.id, { tier: 'archived', decay_score: 0 }, { new: true });
    if (!node) return res.status(404).json({ error: 'Node not found' });

    await AuditLog.create({
      event_type:         'node_archived',
      initiated_by:       'user',
      nodes_affected:     [node._id],
      action_description: `Node archived: ${node._id}`,
      user_id:            node.user_id,
    });

    res.json({ message: 'Node archived', id: node._id });
  } catch (e) { next(e); }
});

module.exports = router;
