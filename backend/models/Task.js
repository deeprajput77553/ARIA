// models/Task.js — Agentic Task with DAG steps (Section 18)
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const StepSchema = new mongoose.Schema({
  step:        { type: Number, required: true },
  action:      { type: String, required: true },
  status:      { type: String, enum: ['pending','running','done','failed'], default: 'pending' },
  depends_on:  [Number],
  result:      { type: String, default: '' },
}, { _id: false });

const DagEdgeSchema = new mongoose.Schema({
  from_step:  Number,
  to_step:    Number,
  condition:  { type: String, enum: ['on_success','on_failure','always'], default: 'on_success' }
}, { _id: false });

const TaskSchema = new mongoose.Schema({
  _id:          { type: String, default: uuidv4 },
  title:        { type: String, required: true },
  steps:        [StepSchema],
  dag_edges:    [DagEdgeSchema],
  status:       { type: String, enum: ['pending','running','completed','failed','blocked'], default: 'pending' },
  priority:     { type: String, enum: ['low','medium','high','critical'], default: 'medium' },
  due_date:     { type: Date, default: null },
  user_id:      { type: String, default: 'default' },
  completed_at: { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

TaskSchema.index({ status: 1 });
TaskSchema.index({ priority: 1 });
TaskSchema.index({ user_id: 1 });
TaskSchema.index({ due_date: 1 });

module.exports = mongoose.model('Task', TaskSchema);
