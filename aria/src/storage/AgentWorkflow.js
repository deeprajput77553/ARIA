/**
 * ARIA Agent Workflow Engine
 * 
 * Multi-level workflow for every user message:
 *   Level 1 — Intent Classification
 *   Level 2 — Profile Context Injection
 *   Level 3 — Knowledge Graph Query
 *   Level 4 — Response Generation (streaming)
 *   Level 5 — Background: Profile Update + Node Creation + Audit Log
 * 
 * Each level's status is shown in real-time in the Logs UI.
 */

import { DB } from './Database.js';
import {
  loadProfile, saveProfile, extractProfileFromMessage,
  mergeProfileData, buildProfileContext, trackTopic,
} from './UserProfile.js';

const OLLAMA = 'http://localhost:11434/api/generate';

// ── Workflow Step Definitions ─────────────────────────────────────────────────
export const WORKFLOW_STEPS = [
  { id: 'intent',    label: 'Classifying intent'       },
  { id: 'context',   label: 'Loading user context'     },
  { id: 'knowledge', label: 'Querying knowledge graph' },
  { id: 'generate',  label: 'Generating response'      },
  { id: 'memory',    label: 'Updating memory'          },
];

function mkStep(id, label, status = 'pending') {
  return { id, label, status };
}

// ── Main Workflow Runner ──────────────────────────────────────────────────────
/**
 * @param {string}   userText        - The raw user input
 * @param {string}   model           - Ollama model name
 * @param {Function} onStepUpdate    - (steps[]) => void — called on each step state change
 * @param {Function} onToken         - (partialText) => void — called as tokens stream in
 * @returns {Promise<{fullResponse, steps, profile}>}
 */
export async function runWorkflow(userText, model, onStepUpdate, onToken) {
  const steps = WORKFLOW_STEPS.map(s => mkStep(s.id, s.label));
  const update = (id, status) => {
    const idx = steps.findIndex(s => s.id === id);
    if (idx >= 0) steps[idx] = { ...steps[idx], status };
    onStepUpdate([...steps]);
  };

  // ── Level 1: Intent Classification ─────────────────────────────────────────
  update('intent', 'running');
  const intent = classifyIntent(userText);
  update('intent', 'done');

  // ── Level 2: Load Profile Context ──────────────────────────────────────────
  update('context', 'running');
  const profile = await loadProfile();
  const profileCtx = buildProfileContext(profile);
  update('context', 'done');

  // ── Level 3: Query Knowledge Graph ─────────────────────────────────────────
  update('knowledge', 'running');
  const relevantNodes = await queryKnowledge(userText);
  const knowledgeCtx  = buildKnowledgeContext(relevantNodes);
  update('knowledge', 'done');

  // ── Level 4: Generate Response (streaming) ─────────────────────────────────
  update('generate', 'running');
  const systemPrompt = buildSystemPrompt(profile, profileCtx, knowledgeCtx, intent);
  let fullResponse = '';

  try {
    const res = await fetch(OLLAMA, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        model,
        prompt: `${systemPrompt}\n\nUser: ${userText}\n\nARIA:`,
        stream: true,
      }),
    });

    const reader = res.body.getReader();
    const dec    = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of dec.decode(value).split('\n').filter(Boolean)) {
        try {
          const j = JSON.parse(line);
          if (j.response) { fullResponse += j.response; onToken(fullResponse); }
        } catch {}
      }
    }
    update('generate', 'done');
  } catch {
    fullResponse = '⚠ Ollama is offline. Run: ollama serve';
    update('generate', 'done');
  }

  // ── Level 5: Background — Profile + Memory + Audit ─────────────────────────
  update('memory', 'running');
  runBackgroundUpdates(userText, fullResponse, profile, model).then(() => {
    update('memory', 'done');
  });

  return { fullResponse, steps, profile };
}

// ── Intent Classifier (local, no LLM needed) ──────────────────────────────────
function classifyIntent(text) {
  const t = text.toLowerCase();
  if (/remind|task|todo|do|schedule/.test(t)) return 'task';
  if (/remember|note|save|store/.test(t))      return 'memory';
  if (/who|what|when|where|how|why/.test(t))   return 'question';
  if (/search|find|look up|google/.test(t))    return 'search';
  if (/my name|i am|i'm|i work|i like/.test(t)) return 'personal_info';
  return 'general';
}

// ── Knowledge Graph Query ─────────────────────────────────────────────────────
async function queryKnowledge(query) {
  try {
    const nodes = await DB.getNodes();
    if (!nodes?.length) return [];
    const q = query.toLowerCase();
    // Simple keyword relevance scoring (future: vector embeddings)
    return nodes
      .map(n => ({
        ...n,
        score: scoreNode(n, q),
      }))
      .filter(n => n.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } catch {
    return [];
  }
}

function scoreNode(node, query) {
  const text  = `${node.content || ''} ${node.summary || ''} ${(node.tags||[]).join(' ')}`.toLowerCase();
  const words = query.split(/\s+/).filter(w => w.length > 3);
  return words.reduce((score, word) => score + (text.includes(word) ? 1 : 0), 0);
}

function buildKnowledgeContext(nodes) {
  if (!nodes?.length) return '';
  const lines = ['[Relevant memory nodes]'];
  nodes.forEach((n, i) => {
    lines.push(`${i+1}. [${n.type}] ${n.summary || n.content?.slice(0,100) || ''}`);
  });
  lines.push('[End of memory context]');
  return lines.join('\n');
}

// ── System Prompt Builder ─────────────────────────────────────────────────────
function buildSystemPrompt(profile, profileCtx, knowledgeCtx, intent) {
  const persona = profile?.persona_preference || 'friend';
  const personaInstructions = {
    friend:    'Be warm, casual, and conversational. Use natural language. Keep responses concise.',
    executive: 'Be concise, structured, and bullet-pointed. No fluff. Get to the point fast.',
    analyst:   'Be thorough, structured, and data-driven. Use clear headings and analysis.',
    coach:     'Be motivating, action-oriented, and positive. Break tasks into steps.',
  };

  return `You are ARIA — Autonomous Reasoning and Integration Agent.
You are a personal AI OS, not just a chatbot. You remember the user, track their tasks, and think proactively.

${profileCtx}
${knowledgeCtx}

Communication style: ${personaInstructions[persona] || personaInstructions.friend}
Detected intent: ${intent}

Rules:
- Sound like a trusted friend and intelligent assistant
- Reference user's name and context if known
- Keep responses focused and helpful
- If the user shares personal info, acknowledge it naturally
- Never sound robotic or corporate`;
}

// ── Background updates (after response is sent) ──────────────────────────────
async function runBackgroundUpdates(userText, aiResponse, currentProfile, model) {
  try {
    // 1. Extract any new profile data from this message
    const extracted = await extractProfileFromMessage(userText, currentProfile, model);
    if (extracted && Object.keys(extracted).length > 0) {
      const updated = mergeProfileData(currentProfile, extracted);
      await saveProfile(updated);
    }

    // 2. Create a knowledge node for this exchange
    const nodeId = `msg_${Date.now()}`;
    await DB.putNode({
      id:           nodeId,
      content:      `User: ${userText}\nARIA: ${aiResponse}`,
      summary:      userText.slice(0, 120),
      type:         'information',
      tags:         extractTags(userText),
      source:       'text',
      access_count: 0,
      decay_score:  1.0,
      tier:         'hot',
      created_at:   Date.now(),
      updated_at:   Date.now(),
    });

    // 3. Audit log
    await DB.logAudit({
      event_type:         'message_processed',
      initiated_by:       'user',
      action_description: `Processed: "${userText.slice(0,60)}"`,
      outcome:            'success',
      nodes_affected:     [nodeId],
    });
  } catch {}
}

// ── Simple tag extractor ──────────────────────────────────────────────────────
function extractTags(text) {
  const stopWords = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','is','are','was','were','have','has','i','you','we','they','it','this','that']);
  return [...new Set(
    text.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w))
  )].slice(0, 10);
}
