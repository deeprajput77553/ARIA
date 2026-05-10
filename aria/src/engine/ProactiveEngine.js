/**
 * ARIA Proactive Engine
 * 
 * Monitors user behavior, time, and tasks to initiate conversations.
 * See ARIA_main.md Section 4 for the specification.
 */

import { DB } from '../storage/Database.js';
import { loadProfile, buildProactiveGreeting } from '../storage/UserProfile.js';
import { msgBus, BUS_EVENTS } from '../storage/MessageBus.js';
import { loadSettings } from '../components/SettingsPage';
import { memoryEngine } from './MemoryEngine.js';

class ProactiveEngine {
  constructor() {
    this.interval = null;
    this.lastProactiveTime = 0;
    this.minInterval = 120 * 60 * 1000; // 2 hours by default
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  start() {
    if (this.interval) return;
    // Check every 60 seconds as per spec
    this.interval = setInterval(() => this.tick(), 60000);
    this.tick(); // Initial check
  }

  async tick() {
    // 0. Consolidation Check
    await memoryEngine.processRecentMessages();

    const settings = loadSettings();
    if (!settings.proactiveMode) return;

    const now = Date.now();
    
    // Check if it's a new session or enough time has passed
    if (now - this.lastProactiveTime < this.minInterval) return;

    const profile = await loadProfile();
    const messages = await DB.getMessages();
    
    // Check 1: Startup Greeting
    if (messages.length === 0 || (now - (messages[messages.length-1]?.timestamp || 0) > 4 * 60 * 60 * 1000)) {
      this.initiateGreeting(profile);
      return;
    }

    // Check 2: Stale Tasks
    const tasks = await DB.getTasks('pending').catch(() => []);
    if (tasks.length > 0) {
      const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
      const stale = tasks.filter(t => (t.timestamp || t.created_at) < threeDaysAgo);
      if (stale.length > 0) {
        this.initiateProactive(`Heads up — "${stale[0].title}" has been sitting for over 3 days. Still relevant?`, 'stale_task');
        return;
      }
    }
  }

  async initiateProactive(message, type = 'general') {
    // Log the proactive initiation
    await DB.logAudit({
      event_type: 'proactive_initiation',
      initiated_by: 'ai',
      action_description: `Proactive (${type}): ${message}`
    });

    // Add to chat
    const msg = await DB.addMessage('ai', message, [
      { label: `Proactive: ${type.replace('_',' ')}`, status: 'done' }
    ]);
    
    msgBus.emit(BUS_EVENTS.NEW_MESSAGE, msg);
    this.lastProactiveTime = Date.now();
  }

  async initiateGreeting(profile) {
    const greeting = buildProactiveGreeting(profile);
    await this.initiateProactive(greeting, 'startup_greeting');
  }
}

export const proactiveEngine = new ProactiveEngine();
