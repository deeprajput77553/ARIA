// models/Edge.js — Knowledge Graph Edge (F-06, Section 11)
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const EdgeSchema = new mongoose.Schema({
  _id:               { type: String, default: uuidv4 },
  from_node:         { type: String, required: true },
  to_node:           { type: String, required: true },
  relationship_type: { type: String, enum: ['related_to','supports','contradicts','derived_from','similar_idea'], default: 'related_to' },
  weight:            { type: Number, default: 0.5, min: 0, max: 1 },
  auto_generated:    { type: Boolean, default: true },
  confirmed_by_user: { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

EdgeSchema.index({ from_node: 1 });
EdgeSchema.index({ to_node: 1 });
EdgeSchema.index({ weight: 1 });
EdgeSchema.index({ from_node: 1, relationship_type: 1 });

module.exports = mongoose.model('Edge', EdgeSchema);
