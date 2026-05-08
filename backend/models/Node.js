// models/Node.js — Knowledge Graph Node (F-06, F-07, F-08)
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ConnectionSchema = new mongoose.Schema({
  to_node:      { type: String, required: true },
  relationship: { type: String, enum: ['related_to','supports','contradicts','derived_from','similar_idea'], default: 'related_to' },
  weight:       { type: Number, default: 0.5, min: 0, max: 1 }
}, { _id: false });

const NodeSchema = new mongoose.Schema({
  _id:           { type: String, default: uuidv4 },
  content:       { type: String, required: true },
  summary:       { type: String, default: '' },
  type:          { type: String, enum: ['idea','task','study','information','personal','document','web_data','image'], default: 'information' },
  tags:          [String],
  embeddings:    [Number],
  connections:   [ConnectionSchema],
  source:        { type: String, enum: ['voice','text','file','web','system','ambient','image'], default: 'text' },
  access_count:  { type: Number, default: 0 },
  last_accessed: { type: Date, default: Date.now },
  decay_score:   { type: Number, default: 1.0, min: 0, max: 1 },
  tier:          { type: String, enum: ['hot','warm','cold','archived'], default: 'hot' },
  user_id:       { type: String, default: 'default' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Indexes
NodeSchema.index({ type: 1 });
NodeSchema.index({ tags: 1 });
NodeSchema.index({ tier: 1 });
NodeSchema.index({ decay_score: 1 });
NodeSchema.index({ user_id: 1 });
NodeSchema.index({ content: 'text', summary: 'text' });

module.exports = mongoose.model('Node', NodeSchema);
