// models/UserContext.js — User preferences, behavior patterns, proactive settings
const mongoose = require('mongoose');

const UserContextSchema = new mongoose.Schema({
  user_id: { type: String, default: 'default', unique: true },
  preferences: {
    voice_speed:    { type: String, enum: ['slow','normal','fast'], default: 'normal' },
    default_mode:   { type: String, enum: ['voice','text'], default: 'voice' },
    language:       { type: String, default: 'en' },
    response_style: { type: String, enum: ['concise','detailed'], default: 'concise' },
    wake_word:      { type: String, default: 'Hey ARIA' },
    persona: {
      default:     { type: String, default: 'friend' },
      work_hours:  { type: String, default: 'executive' },
      late_night:  { type: String, default: 'friend' },
    },
    model:         { type: String, default: 'llama3.2' },
    voice_name:    { type: String, default: '' },
    voice_pitch:   { type: Number, default: 1.15 },
    voice_enabled: { type: Boolean, default: true },
    theme:         { type: String, default: 'dark' },
  },
  behavior_patterns: {
    most_active_hours:            { type: [String], default: [] },
    common_topics:                { type: [String], default: [] },
    preferred_tools:              { type: [String], default: [] },
    avg_session_length_mins:      { type: Number, default: 0 },
    typical_late_night_activity:  { type: Boolean, default: false },
  },
  proactive_settings: {
    enabled:                              { type: Boolean, default: true },
    min_interval_between_proactive_mins:  { type: Number, default: 120 },
    triggers_enabled:                     { type: [String], default: ['stale_task','repeated_topic','late_night','morning_brief'] },
  }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('UserContext', UserContextSchema);
