/**
 * ARIA Long-Term Memory System
 * 
 * Manages the Knowledge Graph and Vector-style search (simulated via IndexedDB).
 * See FEATURES.md F-16 and F-17 for the specification.
 */

import { DB } from '../storage/Database.js';

class MemoryEngine {
  constructor() {
    this.summarizationThreshold = 20; // Summarize every 20 messages
  }

  /**
   * Process new messages to extract memory nodes
   */
  async processRecentMessages() {
    const messages = await DB.getMessages();
    const unindexed = messages.filter(m => !m.isIndexed);
    
    if (unindexed.length < this.summarizationThreshold) return;

    // Call LLM to summarize and extract nodes
    const summary = await this.summarizeMessages(unindexed);
    
    // Store as a Knowledge Node
    const node = {
      id: `mem_${Date.now()}`,
      type: 'conversation_summary',
      content: summary,
      sourceIds: unindexed.map(m => m.id),
      timestamp: Date.now()
    };
    
    await DB.putNode(node);

    // Mark messages as indexed
    for (const msg of unindexed) {
      await DB.updateMessage(msg.id, { isIndexed: true });
    }

    await DB.logAudit({
      event_type: 'memory_consolidation',
      action_description: `Consolidated ${unindexed.length} messages into memory node ${node.id}`
    });
  }

  async summarizeMessages(messages) {
    const text = messages.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
    const prompt = `Summarize the following conversation in a concise, bulleted format. 
Focus on key decisions, technical details, and user preferences.
    
CONVERSATION:
${text}

SUMMARY:`;

    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false })
      });
      const data = await res.json();
      return data.response;
    } catch (e) {
      return `[Summarization failed: ${e.message}]`;
    }
  }

  /**
   * Search memory for relevant context
   */
  async searchMemory(query) {
    const nodes = await DB.getNodes();
    // For now, simple keyword search (since local vector search requires more libs)
    const keywords = query.toLowerCase().split(' ').filter(w => w.length > 3);
    
    return nodes
      .filter(n => {
        const content = n.content.toLowerCase();
        return keywords.some(k => content.includes(k));
      })
      .slice(0, 3); // Top 3 results
  }
}

export const memoryEngine = new MemoryEngine();
