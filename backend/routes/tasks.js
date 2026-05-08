// routes/tasks.js — Agentic Task management with DAG steps
const router   = require('express').Router();
const Task     = require('../models/Task');
const AuditLog = require('../models/AuditLog');

// GET /api/tasks
router.get('/', async (req, res, next) => {
  try {
    const { status, priority, user_id = 'default' } = req.query;
    const filter = { user_id };
    if (status)   filter.status   = status;
    if (priority) filter.priority = priority;
    const tasks = await Task.find(filter).sort({ created_at: -1 });
    res.json(tasks);
  } catch (e) { next(e); }
});

// GET /api/tasks/:id
router.get('/:id', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (e) { next(e); }
});

// POST /api/tasks — create task
router.post('/', async (req, res, next) => {
  try {
    const task = new Task(req.body);
    await task.save();

    await AuditLog.create({
      event_type:         'task_created',
      initiated_by:       'user',
      action_description: `Task created: "${task.title}"`,
      user_id:            task.user_id,
      metadata:           { priority: task.priority, steps: task.steps.length },
    });

    res.status(201).json(task);
  } catch (e) { next(e); }
});

// PATCH /api/tasks/:id — update task status or step status
router.patch('/:id', async (req, res, next) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Auto-complete timestamp
    if (task.status === 'completed' && !task.completed_at) {
      task.completed_at = new Date();
      await task.save();
    }

    await AuditLog.create({
      event_type:         'task_updated',
      initiated_by:       req.body._ai ? 'ai' : 'user',
      action_description: `Task "${task.title}" → ${task.status}`,
      user_id:            task.user_id,
    });

    res.json(task);
  } catch (e) { next(e); }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'Task deleted' });
  } catch (e) { next(e); }
});

module.exports = router;
