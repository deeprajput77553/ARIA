/**
 * ARIA Database Layer — Advanced IndexedDB
 * 
 * Storage Architecture:
 *  - All data lives in IndexedDB (no size limit, no cloud)
 *  - Binary .aria files for export/backup (XOR encoded, not human-readable)
 * 
 * Stores:
 *  - messages    : Full conversation log
 *  - nodes       : Knowledge graph nodes
 *  - edges       : Connections between nodes
 *  - user_profile: Auto-extracted user data
 *  - audit_log   : Action audit trail
 */

const DB_NAME    = 'ARIA_COGNITIVE_OS';
const DB_VERSION = 1;
const STORES     = ['messages', 'nodes', 'edges', 'user_profile', 'audit_log', 'tasks', 'sessions'];

const XOR_KEY = new Uint8Array([0xAB,0xCD,0x42,0x77,0x13,0xF9,0xE2,0x5C,0x88,0x71,0xA3,0xD4,0x29,0x6B,0x10,0xFE]);

const xor = (bytes) => {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ XOR_KEY[i % XOR_KEY.length];
  return out;
};

let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      STORES.forEach(s => {
        if (!db.objectStoreNames.contains(s)) {
          db.createObjectStore(s, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess = e => { _db = e.target.result; res(_db); };
    req.onerror   = e => rej(e.target.error);
  });
}

async function tx(store, mode, fn) {
  const db  = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const r = fn(s);
    if (r) {
      r.onsuccess = e => res(e.target.result);
      r.onerror   = e => rej(e.target.error);
    } else {
      t.oncomplete = () => res();
      t.onerror = e => rej(e.target.error);
    }
  });
}

export const DB = {
  // Messages
  async getMessages() { return tx('messages', 'readonly', s => s.getAll()); },
  async putMessage(msg) { return tx('messages', 'readwrite', s => s.put(msg)); },
  async clearMessages() { return tx('messages', 'readwrite', s => s.clear()); },

  // Helper for adding/updating messages (used by Chat/Logs)
  async addMessage(role, text, steps = []) {
    const msg = {
      id: Date.now(),
      role,
      text: String(text || ''),
      steps,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };
    await this.putMessage(msg);
    return msg;
  },

  async deleteMessage(id) {
    return tx('messages', 'readwrite', s => s.delete(id));
  },

  async updateMessage(id, updates) {
    const msgs = await this.getMessages();
    const existing = msgs.find(m => m.id === id);
    if (existing) {
      await this.putMessage({ ...existing, ...updates });
    }
  },

  // Knowledge Graph
  async getNodes() { return tx('nodes', 'readonly', s => s.getAll()); },
  async putNode(node) { return tx('nodes', 'readwrite', s => s.put({ ...node, updatedAt: Date.now() })); },
  
  // Profile
  async getProfile() { return tx('user_profile', 'readonly', s => s.get('main')); },
  async saveProfile(updates) {
    const existing = await this.getProfile() || { id: 'main' };
    return tx('user_profile', 'readwrite', s => s.put({ ...existing, ...updates, updatedAt: Date.now() }));
  },
  async deleteProfileKey(key) {
    const existing = await this.getProfile();
    if (existing) {
      delete existing[key];
      return tx('user_profile', 'readwrite', s => s.put({ ...existing, updatedAt: Date.now() }));
    }
  },

  // Audit
  async logAudit(entry) { return tx('audit_log', 'readwrite', s => s.put({ id: Date.now(), ...entry, timestamp: Date.now() })); },
  async getAuditLog() { return tx('audit_log', 'readonly', s => s.getAll()); },

  // Tasks
  async getTasks(status = null) {
    const all = await tx('tasks', 'readonly', s => s.getAll());
    return status ? all.filter(t => t.status === status) : all;
  },
  async putTask(task) { 
    return tx('tasks', 'readwrite', s => s.put({ id: task.id || Date.now(), ...task, created_at: task.created_at || Date.now() })); 
  }
};
