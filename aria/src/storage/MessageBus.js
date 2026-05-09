/**
 * ARIA Message Bus — cross-component sync
 * 
 * Uses BroadcastChannel (browser-native) to sync message state
 * between Orb, Chat, and Logs without any server.
 * 
 * Usage:
 *   import { msgBus } from '../storage/MessageBus.js';
 *   msgBus.on('new_message', (msg) => setMsgs(prev => [...prev, msg]));
 *   msgBus.emit('new_message', msg);
 */

class MessageBus {
  constructor() {
    this._channel = new BroadcastChannel('aria_msg_bus');
    this._listeners = {};
    this._channel.onmessage = (e) => {
      const { type, payload } = e.data;
      (this._listeners[type] || []).forEach(fn => fn(payload));
    };
  }

  emit(type, payload) {
    // Notify self (same tab)
    (this._listeners[type] || []).forEach(fn => fn(payload));
    // Notify other tabs/components
    this._channel.postMessage({ type, payload });
  }

  on(type, fn) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    this._listeners[type] = (this._listeners[type] || []).filter(f => f !== fn);
  }
}

export const msgBus = new MessageBus();

// ── Event types ────────────────────────────────────────────────────────────────
export const BUS_EVENTS = {
  NEW_MESSAGE:      'new_message',       // { message }
  UPDATE_MESSAGE:   'update_message',    // { id, updates }
  MESSAGES_CLEARED: 'messages_cleared',
  STEP_UPDATE:      'step_update',       // { messageId, steps }
  SANDBOX_EVENT:    'sandbox_event',     // { phase, label, status, output }
};
