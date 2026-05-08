// ── ARIA Binary Storage System ────────────────────────────────────────────────
// Format: [MAGIC(4)][VER(1)][TYPE(1)][TS(8)][LEN(4)][XOR-ENCODED JSON]
// Files use .aria extension — XOR-encoded, not human-readable

export const FILE_TYPE = { CHAT:0x01, SETTINGS:0x02, MEMORY:0x03, TASKS:0x04, AUDIT:0x05 };
const TYPE_NAME = { 1:'chat', 2:'settings', 3:'memory', 4:'tasks', 5:'audit' };

// 32-byte XOR key — makes files unreadable without this decoder
const KEY = new Uint8Array([
  0xAB,0xCD,0x42,0x77,0x13,0xF9,0xE2,0x5C,
  0x88,0x71,0xA3,0xD4,0x29,0x6B,0x10,0xFE,
  0x55,0x9C,0x3E,0x87,0x1D,0xC7,0x44,0xB2,
  0x6F,0x95,0xE8,0x21,0x7A,0x4C,0xD3,0x09,
]);

const xor = (bytes) => { const o=new Uint8Array(bytes.length); for(let i=0;i<bytes.length;i++) o[i]=bytes[i]^KEY[i%KEY.length]; return o; };

// ── Build / Parse binary buffer ───────────────────────────────────────────────
function buildBuffer(type, data) {
  const encoded = xor(new TextEncoder().encode(JSON.stringify(data)));
  const buf  = new ArrayBuffer(18 + encoded.length);
  const view = new DataView(buf);
  const u8   = new Uint8Array(buf);
  // Magic: ARIA
  u8[0]=0x41; u8[1]=0x52; u8[2]=0x49; u8[3]=0x41;
  view.setUint8(4, 0x01);                             // version
  view.setUint8(5, type);                             // type
  view.setBigUint64(6, BigInt(Date.now()), true);     // timestamp
  view.setUint32(14, encoded.length, true);           // data length
  u8.set(encoded, 18);
  return buf;
}

function parseBuffer(buf) {
  const u8   = new Uint8Array(buf);
  const view = new DataView(buf);
  if (u8[0]!==0x41||u8[1]!==0x52||u8[2]!==0x49||u8[3]!==0x41)
    throw new Error('Invalid ARIA file — wrong magic bytes');
  const type    = view.getUint8(5);
  const ts      = Number(view.getBigUint64(6, true));
  const dataLen = view.getUint32(14, true);
  const data    = JSON.parse(new TextDecoder().decode(xor(u8.slice(18, 18+dataLen))));
  return { type, typeName: TYPE_NAME[type]||'unknown', timestamp: ts, data };
}

// ── IndexedDB (primary storage — no size limit) ───────────────────────────────
const IDB_NAME = 'aria_cognitive_os';
const IDB_STORES = ['chat','settings','memory','tasks','audit'];

function openIDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      IDB_STORES.forEach(s => { if(!db.objectStoreNames.contains(s)) db.createObjectStore(s,{keyPath:'id'}); });
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

async function idbPut(store, id, data) {
  const db = await openIDB();
  return new Promise((res,rej) => {
    const tx = db.transaction(store,'readwrite');
    tx.objectStore(store).put({ id, data, ts: Date.now() }).onsuccess = () => res(true);
    tx.onerror = e => rej(e.target.error);
  });
}

async function idbGet(store, id) {
  const db = await openIDB();
  return new Promise((res,rej) => {
    const req = db.transaction(store,'readonly').objectStore(store).get(id);
    req.onsuccess = e => res(e.target.result?.data ?? null);
    req.onerror   = e => rej(e.target.error);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────
export const AriaStore = {
  // IndexedDB read/write
  async save(store, id, data) { return idbPut(store, id, data); },
  async load(store, id, fallback=null) {
    try { const d = await idbGet(store, id); return d ?? fallback; }
    catch { return fallback; }
  },

  // Export: encode + download as .aria file
  async exportFile(type, data, name) {
    const buf  = buildBuffer(type, data);
    const blob = new Blob([buf], { type:'application/octet-stream' });
    const fname = name || `aria_${TYPE_NAME[type]||'data'}_${Date.now()}.aria`;
    if ('showSaveFilePicker' in window) {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: fname,
          types:[{description:'ARIA Data File',accept:{'application/octet-stream':['.aria']}}] });
        const w = await h.createWritable();
        await w.write(blob); await w.close();
        return { ok: true };
      } catch(e) { if(e.name==='AbortError') return {ok:false}; throw e; }
    }
    // Fallback: simple browser download
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'),{href:url,download:fname});
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    return { ok: true };
  },

  // Import: read + decode .aria file
  async importFile() {
    const parse = async (file) => {
      const buf = await file.arrayBuffer(); return parseBuffer(buf);
    };
    if ('showOpenFilePicker' in window) {
      try {
        const [h] = await window.showOpenFilePicker({
          types:[{description:'ARIA Data File',accept:{'application/octet-stream':['.aria']}}]
        });
        return parse(await h.getFile());
      } catch(e) { if(e.name==='AbortError') return null; throw e; }
    }
    return new Promise(res => {
      const inp = Object.assign(document.createElement('input'),{type:'file',accept:'.aria'});
      inp.onchange = async () => { res(inp.files[0] ? parse(inp.files[0]) : null); };
      inp.click();
    });
  },
};

// ── Auto-save scheduler ───────────────────────────────────────────────────────
let _timer = null;

export async function runAutoSave() {
  const chat     = await AriaStore.load('chat','main',[]);
  const settings = await AriaStore.load('settings','main',{});
  if (chat.length)    await AriaStore.exportFile(FILE_TYPE.CHAT,     chat,     `aria_chat_${Date.now()}.aria`);
  if (Object.keys(settings).length) await AriaStore.exportFile(FILE_TYPE.SETTINGS, settings, `aria_settings_${Date.now()}.aria`);
}

export function startAutoSave(intervalMinutes=15) {
  stopAutoSave();
  _timer = setInterval(runAutoSave, intervalMinutes * 60_000);
}
export function stopAutoSave() { if(_timer){ clearInterval(_timer); _timer=null; } }
