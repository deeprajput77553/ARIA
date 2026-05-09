/**
 * ARIA Database Layer — IndexedDB
 * 
 * Storage Architecture:
 *  - All data lives in IndexedDB (no size limit, no cloud)
 *  - Binary .aria files for export/backup (XOR encoded, not human-readable)
 *  - User profile auto-extracted by AI and stored in 'user_profile' store
 * 
 * Stores:
 *  - messages    : Full conversation log
 *  - nodes       : Knowledge graph nodes (ideas, tasks, memory)
 *  - edges       : Connections between nodes
 *  - user_profile: Auto-extracted user data (name, prefs, patterns)
 *  - audit_log   : Every action ARIA takes
 *  - tasks       : Multi-step task queue
 *  - sessions    : Session tracking
 */

const DB_NAME    = 'ARIA_COGNITIVE_OS';
const DB_VERSION = 1;
const STORES     = ['messages', 'nodes', 'edges', 'user_profile', 'audit_log', 'tasks', 'sessions'];

// ── XOR Key — makes exported .aria files unreadable to humans ─────────────────
const XOR_KEY = new Uint8Array([
  0xAB,0xCD,0x42,0x77,0x13,0xF9,0xE2,0x5C,
  0x88,0x71,0xA3,0xD4,0x29,0x6B,0x10,0xFE,
  0x55,0x9C,0x3E,0x87,0x1D,0xC7,0x44,0xB2,
  0x6F,0x95,0xE8,0x21,0x7A,0x4C,0xD3,0x09,
]);

const xor = (bytes) => {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ XOR_KEY[i % XOR_KEY.length];
  return out;
};

// ── ARIA Binary File Format ───────────────────────────────────────────────────
// Header: [MAGIC:4][VERSION:1][TYPE:1][TIMESTAMP:8][DATALEN:4]
// Body:   XOR-encoded UTF-8 JSON
export const FILE_TYPE = { MESSAGES:0x01, NODES:0x02, EDGES:0x03, PROFILE:0x04, AUDIT:0x05, FULL_BACKUP:0x06 };

function buildARIAFile(type, data) {
  const encoded = xor(new TextEncoder().encode(JSON.stringify(data)));
  const buf  = new ArrayBuffer(18 + encoded.length);
  const view = new DataView(buf);
  const u8   = new Uint8Array(buf);
  u8[0]=0x41; u8[1]=0x52; u8[2]=0x49; u8[3]=0x41; // 'ARIA'
  view.setUint8(4, 0x02);                             // version 2
  view.setUint8(5, type);
  view.setBigUint64(6, BigInt(Date.now()), true);
  view.setUint32(14, encoded.length, true);
  u8.set(encoded, 18);
  return buf;
}

function parseARIAFile(buf) {
  const u8   = new Uint8Array(buf);
  const view = new DataView(buf);
  if (u8[0]!==0x41||u8[1]!==0x52||u8[2]!==0x49||u8[3]!==0x41) throw new Error('Invalid ARIA file');
  const type    = view.getUint8(5);
  const ts      = Number(view.getBigUint64(6, true));
  const dataLen = view.getUint32(14, true);
  const data    = JSON.parse(new TextDecoder().decode(xor(u8.slice(18, 18 + dataLen))));
  return { type, timestamp: ts, data };
}

// ── DB Connection (singleton) ─────────────────────────────────────────────────
let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      STORES.forEach(s => {
        if (!db.objectStoreNames.contains(s)) {
          const store = db.createObjectStore(s, { keyPath: 'id' });
          if (s === 'nodes')     { store.createIndex('type', 'type'); store.createIndex('tier', 'tier'); }
          if (s === 'edges')     { store.createIndex('from_node', 'from_node'); store.createIndex('to_node', 'to_node'); }
          if (s === 'audit_log') { store.createIndex('event_type', 'event_type'); }
          if (s === 'tasks')     { store.createIndex('status', 'status'); }
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
    r.onsuccess = e => res(e.target.result);
    r.onerror   = e => rej(e.target.error);
  });
}

// ── CRUD helpers ──────────────────────────────────────────────────────────────
export const DB = {

  // Messages / Chat log
  async getMessages()          { return tx('messages','readonly', s => s.getAll()); },
  async putMessage(msg)        { return tx('messages','readwrite',s => s.put(msg)); },
  async clearMessages()        { return tx('messages','readwrite',s => s.clear()); },

  // Knowledge Graph Nodes
  async getNodes(type)         {
    if (!type) return tx('nodes','readonly', s => s.getAll());
    const db = await openDB();
    return new Promise((res, rej) => {
      const s = db.transaction('nodes','readonly').objectStore('nodes');
      const r = s.index('type').getAll(type);
      r.onsuccess = e => res(e.target.result);
      r.onerror   = e => rej(e.target.error);
    });
  },
  async putNode(node)          { return tx('nodes','readwrite', s => s.put({ ...node, updatedAt: Date.now() })); },
  async deleteNode(id)         { return tx('nodes','readwrite', s => s.delete(id)); },

  // Edges
  async getEdges()             { return tx('edges','readonly',  s => s.getAll()); },
  async putEdge(edge)          { return tx('edges','readwrite', s => s.put(edge)); },

  // User Profile (singleton — always id: 'main')
  async getProfile()           {
    try { return await tx('user_profile','readonly', s => s.get('main')); } catch { return null; }
  },
  async saveProfile(profile)   { return tx('user_profile','readwrite', s => s.put({ id:'main', ...profile, updatedAt: Date.now() })); },

  // Audit log
  async logAudit(entry)        { return tx('audit_log','readwrite', s => s.put({ id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, ...entry, timestamp: Date.now() })); },
  async getAuditLog()          { return tx('audit_log','readonly',  s => s.getAll()); },

  // Tasks
  async getTasks(status)       {
    if (!status) return tx('tasks','readonly', s => s.getAll());
    const db = await openDB();
    return new Promise((res,rej) => {
      const s = db.transaction('tasks','readonly').objectStore('tasks');
      const r = s.index('status').getAll(status);
      r.onsuccess = e => res(e.target.result);
      r.onerror   = e => rej(e.target.error);
    });
  },
  async putTask(task)          { return tx('tasks','readwrite', s => s.put(task)); },

  // ── Export: encode to binary .aria file ──────────────────────────────────
  async exportStore(storeName, fileType, suggestedName) {
    const data = await tx(storeName,'readonly', s => s.getAll());
    const buf  = buildARIAFile(fileType, data);
    const blob = new Blob([buf], { type:'application/octet-stream' });
    const fname = suggestedName || `aria_${storeName}_${Date.now()}.aria`;
    if ('showSaveFilePicker' in window) {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: fname,
          types:[{description:'ARIA Data File',accept:{'application/octet-stream':['.aria']}}] });
        const w = await h.createWritable(); await w.write(blob); await w.close();
        return { ok:true };
      } catch(e) { if(e.name==='AbortError') return {ok:false}; throw e; }
    }
    const url = URL.createObjectURL(blob);
    const a   = Object.assign(document.createElement('a'),{href:url,download:fname});
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    return { ok:true };
  },

  // ── Full backup: all stores in one file ───────────────────────────────────
  async exportFullBackup() {
    const backup = {};
    for (const s of ['messages','nodes','edges','user_profile','audit_log','tasks']) {
      backup[s] = await tx(s,'readonly', st => st.getAll());
    }
    const buf  = buildARIAFile(FILE_TYPE.FULL_BACKUP, backup);
    const blob = new Blob([buf], { type:'application/octet-stream' });
    const fname = `aria_full_backup_${new Date().toISOString().slice(0,10)}.aria`;
    const url = URL.createObjectURL(blob);
    const a   = Object.assign(document.createElement('a'),{href:url,download:fname});
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  },

  // ── Import from .aria file ────────────────────────────────────────────────
  async importFile() {
    return new Promise((resolve) => {
      const inp = Object.assign(document.createElement('input'),{type:'file',accept:'.aria'});
      inp.onchange = async () => {
        if (!inp.files[0]) { resolve(null); return; }
        try {
          const buf    = await inp.files[0].arrayBuffer();
          const parsed = parseARIAFile(buf);
          resolve(parsed);
        } catch(e) { resolve({ error: e.message }); }
      };
      inp.click();
    });
  },
};
