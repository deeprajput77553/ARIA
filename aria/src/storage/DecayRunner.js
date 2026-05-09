/**
 * ARIA Decay Runner — Sections 10, 11, 12 of ARIA_main.md
 * 
 * Implements node aging, forgetting, and graph pruning.
 * Runs automatically on a nightly schedule (or manually triggered).
 */

import { DB } from './Database.js';

// ── Decay formula ──────────────────────────────────────────────────────────────
function calculateDecay(node) {
  const now           = Date.now();
  const daysSince     = (now - (node.last_accessed || node.created_at || now)) / 86_400_000;
  const recencyFactor = Math.max(0, 1.0 - 0.01 * daysSince);
  const accessFactor  = Math.min(1.0, (node.access_count || 0) * 0.1);
  const connectionFactor = Math.min(1.0, (node.connections?.length || 0) * 0.05);
  return Math.max(0, recencyFactor + accessFactor * 0.3 + connectionFactor * 0.2);
}

// ── Get tier from decay score ──────────────────────────────────────────────────
function getTierFromDecay(score) {
  if (score >= 0.7) return 'hot';
  if (score >= 0.4) return 'warm';
  if (score >= 0.2) return 'cold';
  return 'archived';
}

// ── Run decay cycle on all nodes ──────────────────────────────────────────────
export async function runDecayCycle() {
  const nodes   = await DB.getNodes();
  const results = { updated: 0, archived: 0, flaggedForReview: [], errors: 0 };

  for (const node of nodes) {
    try {
      const newDecay = calculateDecay(node);
      const newTier  = getTierFromDecay(newDecay);
      const updated  = { ...node, decay_score: newDecay, tier: newTier, updated_at: Date.now() };
      await DB.putNode(updated);

      if (newDecay < 0.2)       results.archived++;
      else if (newDecay < 0.4)  results.flaggedForReview.push({ id: node.id, summary: node.summary?.slice(0, 60) });
      results.updated++;
    } catch { results.errors++; }
  }

  await DB.logAudit({
    event_type:         'decay_cycle_run',
    initiated_by:       'ai',
    action_description: `Decay cycle: ${results.updated} nodes updated, ${results.archived} archived, ${results.flaggedForReview.length} flagged`,
    outcome:            'success',
  });

  return results;
}

// ── Update access count when a node is retrieved ──────────────────────────────
export async function touchNode(nodeId) {
  try {
    const node = await DB.getNodes().then(ns => ns.find(n => n.id === nodeId));
    if (!node) return;
    await DB.putNode({
      ...node,
      access_count:  (node.access_count || 0) + 1,
      last_accessed: Date.now(),
      decay_score:   Math.min(1.0, calculateDecay(node) + 0.1),
    });
  } catch {}
}

// ── Auto-link new node to similar existing nodes ──────────────────────────────
export async function autoLinkNode(newNode) {
  try {
    const allNodes = await DB.getNodes();
    const edges    = [];

    for (const existing of allNodes) {
      if (existing.id === newNode.id) continue;
      const sim = computeSimilarity(newNode, existing);
      if (sim < 0.3) continue;

      let relType = 'related_to';
      if (sim > 0.95)      relType = 'similar_idea';
      else if (sim > 0.8)  relType = 'related_to';

      const edge = {
        id:               `edge_${newNode.id}_${existing.id}`,
        from_node:        newNode.id,
        to_node:          existing.id,
        relationship_type: relType,
        weight:           sim,
        auto_generated:   true,
        confirmed_by_user: false,
        created_at:       Date.now(),
      };
      await DB.putEdge(edge);
      edges.push(edge);

      if (sim > 0.95) {
        console.log(`[ARIA] High similarity (${sim.toFixed(2)}) between "${newNode.summary?.slice(0,40)}" and "${existing.summary?.slice(0,40)}" — consider merging`);
      }
    }
    return edges;
  } catch { return []; }
}

// ── Simple keyword-based similarity (pre-embedding fallback) ──────────────────
function computeSimilarity(a, b) {
  const textA = `${a.content || ''} ${(a.tags || []).join(' ')}`.toLowerCase();
  const textB = `${b.content || ''} ${(b.tags || []).join(' ')}`.toLowerCase();
  const wordsA = new Set(textA.split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(textB.split(/\s+/).filter(w => w.length > 3));
  if (!wordsA.size || !wordsB.size) return 0;
  let intersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersection++;
  return intersection / Math.sqrt(wordsA.size * wordsB.size);
}

// ── Schedule nightly decay run (runs at 02:00) ────────────────────────────────
export function scheduleDecayRunner() {
  function timeUntilNextRun() {
    const now   = new Date();
    const next  = new Date();
    next.setHours(2, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next - now;
  }

  function scheduleNext() {
    setTimeout(async () => {
      await runDecayCycle();
      scheduleNext();
    }, timeUntilNextRun());
  }

  scheduleNext();
  console.log('[ARIA] Decay runner scheduled for 02:00 nightly');
}
