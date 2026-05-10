/**
 * ARIA Proactive Engine
 * 
 * Monitors user behavior, time, and tasks to initiate conversations.
 * See ARIA_main.md Section 4 for the specification.
 */

import { DB } from '../storage/Database.js';
import { loadProfile, buildProactiveGreeting } from '../storage/UserProfile.js';
import { msgBus, BUS_EVENTS } from '../storage/MessageBus.js';
import { loadSettings } from '../components/SettingsPage.jsx';
import { memoryEngine } from './MemoryEngine.js';

class ProactiveEngine {
  constructor() {
    this.interval = null;
    this.lastProactiveTime = 0;
    this.minInterval = 120 * 60 * 1000; // 2 hours by default
  }

  start() {
    if (this.interval) return;
    // Check every 60 seconds as per spec
    this.interval = setInterval(() => this.tick(), 60000);
    this.tick(); // Initial check
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
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

    // Check 2: Stale Tasks (simplified check)
    // TODO: Implement task stale check once tasks store is fully used
  }

  async initiateGreeting(profile) {
    const greeting = buildProactiveGreeting(profile);
    
    // Log the proactive initiation
    await DB.logAudit({
      event_type: 'proactive_initiation',
      initiated_by: 'ai',
      action_description: `Initiated proactive greeting: ${greeting}`
    });

    // Add to chat
    const msg = await DB.addMessage('ai', greeting, [
      { label: 'Proactive check-in', status: 'done' }
    ]);
    
    msgBus.emit(BUS_EVENTS.NEW_MESSAGE, msg);
    this.lastProactiveTime = Date.now();
  }
}

export const proactiveEngine = new ProactiveEngine();
