// routes/edges.js — Knowledge Graph Edge CRUD
const router = require('express').Router();
const Edge   = require('../models/Edge');

router.get('/', async (req, res, next) => {
  try {
    const { from_node, to_node, min_weight = 0 } = req.query;
    const filter = { weight: { $gte: Number(min_weight) } };
    if (from_node) filter.from_node = from_node;
    if (to_node)   filter.to_node   = to_node;
    const edges = await Edge.find(filter).sort({ weight: -1 }).limit(200);
    res.json(edges);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const edge = new Edge(req.body);
    await edge.save();
    res.status(201).json(edge);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Edge.findByIdAndDelete(req.params.id);
    res.json({ message: 'Edge deleted' });
  } catch (e) { next(e); }
});

module.exports = router;
