// models/AuditLog.js — Full action transparency (F-17)
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const AuditLogSchema = new mongoose.Schema({
  _id:                { type: String, default: uuidv4 },
  session_id:         { type: String, default: '' },
  event_type:         { type: String, enum: [
    'tool_execution','proactive_initiation','node_created','edge_created',
    'node_archived','node_merged','user_override','system_startup',
    'task_created','task_updated','chat_message','ollama_call'
  ], required: true },
  initiated_by:       { type: String, enum: ['ai','user','system'], default: 'user' },
  tool_used:          { type: String, default: null },
  files_accessed:     [String],
  nodes_affected:     [String],
  action_description: { type: String, required: true },
  user_confirmed:     { type: Boolean, default: false },
  outcome:            { type: String, enum: ['success','failed','cancelled','pending'], default: 'success' },
  user_id:            { type: String, default: 'default' },
  metadata:           { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: 'timestamp', updatedAt: false } });

AuditLogSchema.index({ event_type: 1 });
AuditLogSchema.index({ user_id: 1 });
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ session_id: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
