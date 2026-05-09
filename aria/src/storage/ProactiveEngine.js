/**
 * ARIA Proactive Engine
 * 
 * Background context monitor — implements Section 3 & 4 of ARIA_main.md
 * 
 * Triggers (runs every 60s):
 *  1. New session greeting
 *  2. User inactive > 2 hours during active hours
 *  3. Overdue tasks (open > 3 days)
 *  4. Repeated topic (3+ times in a week)
 *  5. Pattern detection (behavioral patterns)
 */

import { DB } from './Database.js';
import { loadProfile } from './UserProfile.js';

const MIN_INTERVAL_MS = 120 * 60 * 1000; // 2 hours between proactive messages

// ── Session state ──────────────────────────────────────────────────────────────
let _lastProactiveTime = 0;
let _monitorInterval   = null;
let _onTrigger         = null;

// ── Start the background monitor ───────────────────────────────────────────────
export function startProactiveMonitor(onTriggerFn) {
  _onTrigger = onTriggerFn;
  if (_monitorInterval) clearInterval(_monitorInterval);
  _monitorInterval = setInterval(runChecks, 60_000); // every 60s
}

export function stopProactiveMonitor() {
  if (_monitorInterval) clearInterval(_monitorInterval);
  _monitorInterval = null;
}

// ── Main check loop ────────────────────────────────────────────────────────────
async function runChecks() {
  const now = Date.now();
  if (now - _lastProactiveTime < MIN_INTERVAL_MS) return; // throttle

  const profile  = await loadProfile();
  const trigger  = await evaluateTriggers(profile);
  if (!trigger) return;

  _lastProactiveTime = now;
  _onTrigger?.(trigger);

  // Log to audit
  await DB.logAudit({
    event_type:         'proactive_initiation',
    initiated_by:       'ai',
    action_description: `Proactive trigger: ${trigger.type} — "${trigger.message.slice(0,80)}"`,
    outcome:            'success',
  });
}

// ── Evaluate all trigger conditions ───────────────────────────────────────────
async function evaluateTriggers(profile) {
  const triggers = await Promise.all([
    checkStaleTasks(),
    checkRepeatedTopics(profile),
    checkPatternDetected(profile),
    checkInactivity(profile),
  ]);

  // Score and pick highest priority trigger
  const valid = triggers.filter(Boolean).sort((a, b) => b.urgency - a.urgency);
  return valid[0] || null;
}

// ── Trigger 1: Stale Tasks ─────────────────────────────────────────────────────
async function checkStaleTasks() {
  try {
    const tasks   = await DB.getTasks('pending');
    if (!tasks?.length) return null;
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const stale   = tasks.filter(t => t.created_at && t.created_at < threeDaysAgo);
    if (!stale.length) return null;
    const t = stale[0];
    return {
      type:    'stale_task',
      urgency:  8,
      message: `That task "${t.title || 'you started'}" has been sitting for over 3 days. Still relevant? Want to break it down differently?`,
    };
  } catch { return null; }
}

// ── Trigger 2: Repeated Topics ─────────────────────────────────────────────────
async function checkRepeatedTopics(profile) {
  try {
    const topics = profile?.last_topics || [];
    if (topics.length < 6) return null;
    // Count occurrences in last 20 topics
    const freq = {};
    topics.slice(-20).forEach(t => { freq[t] = (freq[t] || 0) + 1; });
    const repeated = Object.entries(freq).find(([, count]) => count >= 3);
    if (!repeated) return null;
    const [topic] = repeated;
    return {
      type:    'repeated_topic',
      urgency:  6,
      message: `You keep coming back to "${topic}" — want me to build a proper structured note on it?`,
    };
  } catch { return null; }
}

// ── Trigger 3: Pattern Detection ──────────────────────────────────────────────
async function checkPatternDetected(profile) {
  try {
    const h   = new Date().getHours();
    const day = new Date().getDay(); // 0=Sun, 2=Tue
    const sal = profile?.gender === 'female' ? "Ma'am" : 'Sir';
    if (day === 2 && h >= 19 && h <= 22) { // Tuesday evening
      return {
        type:    'pattern_detected',
        urgency:  4,
        message: `It's Tuesday evening again, ${sal} — you usually have a lot on your mind around now. What are we working on?`,
      };
    }
    if (h >= 22 && h <= 23) {
      return {
        type:    'late_night',
        urgency:  5,
        message: `It's getting late, ${sal}. Something on your mind keeping you up? I'm here — talk to me.`,
      };
    }
    return null;
  } catch { return null; }
}

// ── Trigger 4: Inactivity Check ────────────────────────────────────────────────
async function checkInactivity(profile) {
  try {
    const lastSeen  = profile?.last_seen || 0;
    const hoursAgo  = (Date.now() - lastSeen) / (60 * 60 * 1000);
    const h         = new Date().getHours();
    const isActive  = h >= 9 && h <= 17; // work hours
    const sal       = profile?.gender === 'female' ? "Ma'am" : 'Sir';
    if (isActive && hoursAgo > 2) {
      return {
        type:    'inactivity',
        urgency:  3,
        message: `Still there, ${sal}? You went quiet for a while. Everything okay?`,
      };
    }
    return null;
  } catch { return null; }
}

// ── Build LLM-generated contextual greeting ────────────────────────────────────
export async function buildContextualGreeting(profile, model = 'llama3.2') {
  const h         = new Date().getHours();
  const day       = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const name      = profile?.name || 'there';
  const sal       = profile?.gender === 'female' ? "Ma'am" : 'Sir';
  const tasks     = await DB.getTasks('pending').catch(() => []);
  const taskCount = tasks?.length || 0;
  const lastSeen  = profile?.last_seen;
  const hoursAgo  = lastSeen ? Math.round((Date.now() - lastSeen) / 3600000) : null;
  const topics    = (profile?.last_topics || []).slice(-3).join(', ') || 'nothing recently';

  const period =
    h >= 5  && h < 9  ? 'very_early_morning' :
    h >= 9  && h < 12 ? 'morning_start' :
    h >= 12 && h < 14 ? 'midday' :
    h >= 14 && h < 17 ? 'afternoon_work' :
    h >= 17 && h < 19 ? 'end_of_workday' :
    h >= 19 && h < 22 ? 'evening' :
    h >= 22            ? 'late_night' : 'deep_night';

  const prompt = `You are ARIA, a personal AI operating system. Generate a short, warm, natural greeting.

Context:
- Current time: ${new Date().toLocaleTimeString()}
- Time period: ${period}
- Day: ${day}
- User name: ${name}
- Salutation: ${sal}
- Pending tasks: ${taskCount}
- Last interaction: ${hoursAgo != null ? hoursAgo + ' hours ago' : 'unknown'}
- Recent topics: ${topics}

Rules:
- Sound like a trusted friend, not a corporate assistant
- Keep it under 2 sentences
- Address them as "${sal}" or "${name}"
- Reference specific context (tasks, topics) when available
- Never sound scripted or robotic
- Use casual, warm language

Generate ONLY the greeting text, nothing else.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
    });
    if (!res.ok) throw new Error();
    const json = await res.json();
    return json.response?.trim() || buildFallbackGreeting(profile, period, sal);
  } catch {
    return buildFallbackGreeting(profile, period, sal);
  }
}

function buildFallbackGreeting(profile, period, sal) {
  const name = profile?.name ? ` ${profile.name}` : '';
  const map  = {
    very_early_morning: `Whoa, you're up early, ${sal}${name}. Big day planned or just couldn't sleep? Either way, I'm here.`,
    morning_start:      `Good morning, ${sal}${name}! Ready to get started?`,
    midday:             `Afternoon, ${sal}${name}. Taking a break or diving in?`,
    afternoon_work:     `Hey ${sal}${name} — still on track for today?`,
    end_of_workday:     `Wrapping up, ${sal}${name}? Let me know what's on your mind.`,
    evening:            `Evening, ${sal}${name}. Anything you want to capture before it slips?`,
    late_night:         `Hey ${sal}${name}, it's getting late. Something on your mind?`,
    deep_night:         `Deep night hours, ${sal}${name}. Either you're really focused or something's bothering you. What's going on?`,
  };
  return map[period] || `Hey ${sal}${name}, I'm here. What's on your mind?`;
}
