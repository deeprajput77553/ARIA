/**
 * ARIA User Profile Engine
 * 
 * Automatically extracts and builds a user profile from conversations.
 * - Parses messages for user's name, occupation, interests, tone
 * - Stores profile in IndexedDB (user_profile store)
 * - Loaded and injected into every AI prompt as context
 * - Saves to .aria binary file periodically
 */

import { DB } from './Database.js';

// ── Default empty profile ─────────────────────────────────────────────────────
export const EMPTY_PROFILE = {
  id: 'main',
  name: null,
  occupation: null,
  interests: [],
  projects: [],
  location: null,
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  persona_preference: 'friend',
  activity_hours: [],
  last_topics: [],
  session_count: 0,
  gender: null, // 'male' | 'female' | null
  first_seen: Date.now(),
  notes: [],
};

// ── Load profile ──────────────────────────────────────────────────────────────
export async function loadProfile() {
  const stored = await DB.getProfile();
  return stored ? { ...EMPTY_PROFILE, ...stored } : { ...EMPTY_PROFILE };
}

// ── Save profile ──────────────────────────────────────────────────────────────
export async function saveProfile(profile) {
  await DB.saveProfile(profile);
}

// ── Build system prompt context from profile ──────────────────────────────────
export function buildProfileContext(profile) {
  if (!profile) return '';
  const lines = ['[ARIA USER PROFILE — loaded from memory]'];
  const salutation = profile.gender === 'male' ? 'Sir' : profile.gender === 'female' ? 'Ma\'am' : 'Sir/Ma\'am';
  
  if (profile.name)       lines.push(`User name: ${profile.name}`);
  if (profile.gender)     lines.push(`User gender: ${profile.gender}`);
  lines.push(`Preferred Salutation: ${salutation}`);
  if (profile.occupation) lines.push(`Occupation: ${profile.occupation}`);
  if (profile.location)   lines.push(`Location: ${profile.location}`);
  if (profile.interests?.length) lines.push(`Known interests: ${profile.interests.join(', ')}`);
  if (profile.projects?.length)  lines.push(`Active projects: ${profile.projects.join(', ')}`);
  if (profile.last_topics?.length) lines.push(`Recent topics: ${profile.last_topics.slice(-5).join(', ')}`);
  lines.push(`Persona mode: ${profile.persona_preference}`);
  lines.push(`Session count: ${profile.session_count}`);
  lines.push('[End of profile context]\n');
  return lines.join('\n');
}

// ── Extract profile data from a message using the AI ─────────────────────────
// This runs in the background after each user message
export async function extractProfileFromMessage(userMessage, currentProfile, model = 'llama3.2') {
  const prompt = `You are an AI that extracts personal information from user messages.

Given this user message: "${userMessage}"

Current known profile:
${JSON.stringify(currentProfile, null, 2)}

Extract any NEW personal information from the message that would help personalize future responses.
Only extract information explicitly mentioned. 
IMPORTANT: If the user provides their name, or if you already have their name in the profile, infer the gender ('male' or 'female') if possible.

Return ONLY a JSON object with these optional fields (omit fields you can't extract):
{
  "name": "string or null",
  "gender": "male | female | null",
  "occupation": "string or null", 
  "location": "string or null",
  "interests": ["array of new interests to ADD"],
  "projects": ["array of new projects to ADD"],
  "notes": ["important personal facts to remember"]
}

Return {} if no new information found.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const raw  = json.response?.trim() || '{}';
    // Extract JSON from response (model might wrap it in ```json ... ```)
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// ── Merge extracted data into existing profile ────────────────────────────────
export function mergeProfileData(existing, extracted) {
  if (!extracted || Object.keys(extracted).length === 0) return existing;
  const merged = { ...existing };
  if (extracted.name       && !merged.name)       merged.name       = extracted.name;
  if (extracted.occupation && !merged.occupation) merged.occupation = extracted.occupation;
  if (extracted.location   && !merged.location)   merged.location   = extracted.location;
  if (extracted.gender     && !merged.gender)     merged.gender     = extracted.gender;
  if (extracted.interests?.length) {
    merged.interests = [...new Set([...( merged.interests||[]), ...extracted.interests])];
  }
  if (extracted.projects?.length) {
    merged.projects = [...new Set([...(merged.projects||[]), ...extracted.projects])];
  }
  if (extracted.notes?.length) {
    merged.notes = [...(merged.notes||[]), ...extracted.notes].slice(-50); // keep last 50
  }
  return merged;
}

// ── Update topic tracking ─────────────────────────────────────────────────────
export function trackTopic(profile, topic) {
  const topics = [...(profile.last_topics || []), topic].slice(-20); // keep last 20
  return { ...profile, last_topics: topics };
}

// ── Build proactive greeting based on profile + time ─────────────────────────
export function buildProactiveGreeting(profile) {
  const h    = new Date().getHours();
  const day  = new Date().toLocaleDateString('en-US', { weekday:'long' });
  const sal  = profile.gender === 'male' ? 'Sir' : profile.gender === 'female' ? 'Ma\'am' : 'Sir'; // Default to Sir if unknown
  const name = profile?.name ? ` ${profile.name}` : '';

  if (h >= 5  && h < 9)  return `Good morning, ${sal}${name}! It's ${day} — ready to get started?`;
  if (h >= 9  && h < 12) return `Hey ${sal}${name}! It's a ${day} morning. What are we working on?`;
  if (h >= 12 && h < 14) return `Afternoon, ${sal}${name}. Taking a break or diving in?`;
  if (h >= 14 && h < 17) return `Hey ${sal}${name} — ${day} afternoon. Still on track?`;
  if (h >= 17 && h < 20) return `Evening, ${sal}${name}. Wrapping up for the day or something on your mind?`;
  if (h >= 20 && h < 23) return `Late evening, ${sal}${name}. Anything you want to capture before you sleep?`;
  return `Hey ${sal}${name}, you're up late on ${day}. Something on your mind?`;
}

// ── Increment session count ───────────────────────────────────────────────────
export async function incrementSession(profile) {
  const updated = { ...profile, session_count: (profile.session_count || 0) + 1, last_seen: Date.now() };
  await saveProfile(updated);
  return updated;
}
