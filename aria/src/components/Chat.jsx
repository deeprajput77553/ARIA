import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AriaStore, FILE_TYPE } from '../storage/AriaStore';
import { loadSettings } from './SettingsPage';
import { speakFemale } from './Logs';

const CHAT_KEY = 'main';
const now = () => new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});

const INIT = [
  { id:1, role:'ai', text:'Hello — ARIA online. Ask me anything.', time:'00:00',
    steps:[{label:'System initialized',status:'done'}] }
];

// ── Single message bubble ─────────────────────────────────────────────────────
const Bubble = ({ msg }) => {
  const [open, setOpen] = useState(false);
  const isAI = msg.role === 'ai';
  return (
    <div className={`chat-bubble-wrap ${isAI ? 'ai-side' : 'user-side'}`}>
      <div className={`chat-bubble ${isAI?'chat-bubble-ai':'chat-bubble-user'}`}
           onClick={() => msg.steps && setOpen(o=>!o)}>
        <div className="chat-bubble-meta">
          <span className="chat-bubble-role">{isAI ? '⬡ ARIA' : '👤 You'}</span>
          <span className="chat-bubble-time">{msg.time}</span>
          {msg.steps && <span style={{marginLeft:'auto',fontSize:'10px'}}>{open?'▴':'▾'}</span>}
        </div>
        <p className="chat-bubble-text">
          {msg.text || <span className="typing-cursor">▌</span>}
        </p>
      </div>
      {open && msg.steps && (
        <div className="chat-steps">
          {msg.steps.map((s,i) => (
            <div key={i} className={`chat-step ${s.status}`}>
              <span>{s.status==='done'?'✓':s.status==='running'?'⟳':'○'}</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main Chat Component ───────────────────────────────────────────────────────
const Chat = ({ onClose }) => {
  const settings = loadSettings();
  const [msgs,    setMsgs]    = useState(INIT);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded,  setLoaded]  = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // ── Load history from IndexedDB on mount ─────────────────────────────────
  useEffect(() => {
    AriaStore.load('chat', CHAT_KEY, INIT).then(saved => {
      setMsgs(saved && saved.length ? saved : INIT);
      setLoaded(true);
    });
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  // ── Persist to IndexedDB whenever msgs change ─────────────────────────────
  useEffect(() => {
    if (loaded) AriaStore.save('chat', CHAT_KEY, msgs);
  }, [msgs, loaded]);

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  // ── Send message ──────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setLoading(true);

    const userId = Date.now();
    const aiId   = userId + 1;

    setMsgs(prev => [
      ...prev,
      { id: userId, role:'user', text, time: now() },
      { id: aiId,   role:'ai',  text:'', time: now(),
        steps:[
          {label:'Parsing intent',     status:'running'},
          {label:'Querying knowledge', status:'pending'},
          {label:'Generating response',status:'pending'},
        ]
      },
    ]);

    const upd = (steps) => setMsgs(p => p.map(m => m.id===aiId ? {...m,steps} : m));

    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ model: settings.model||'llama3.2', prompt: text, stream:true }),
      });

      upd([
        {label:'Parsing intent',     status:'done'},
        {label:'Querying knowledge', status:'running'},
        {label:'Generating response',status:'pending'},
      ]);

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let full     = '';

      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        for (const line of dec.decode(value).split('\n').filter(Boolean)) {
          try {
            const j = JSON.parse(line);
            if (j.response) {
              full += j.response;
              setMsgs(p => p.map(m => m.id===aiId ? {...m, text:full} : m));
            }
          } catch {}
        }
      }

      upd([
        {label:'Parsing intent',     status:'done'},
        {label:'Querying knowledge', status:'done'},
        {label:'Generating response',status:'done'},
      ]);
      speakFemale(full, settings);

    } catch {
      setMsgs(p => p.map(m => m.id===aiId
        ? {...m, text:'⚠ Ollama offline. Run: ollama serve'}
        : m
      ));
    }
    setLoading(false);
  }, [input, loading, settings]);

  const onKey = e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  // ── Clear history ─────────────────────────────────────────────────────────
  const clearHistory = () => {
    if (confirm('Clear all chat history?')) { setMsgs(INIT); }
  };

  return (
    <div className="chat-overlay">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="chat-orb-dot"/>
          <span className="chat-title">ARIA Chat</span>
          <span className="chat-subtitle">Autonomous Intelligence</span>
        </div>
        <div className="chat-header-actions">
          <button className="chat-action-btn" onClick={clearHistory} title="Clear history">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            </svg>
          </button>
          <button className="chat-close-btn" onClick={onClose} title="Back to Orb">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {msgs.map(m => <Bubble key={m.id} msg={m}/>)}
        {loading && (
          <div className="chat-bubble-wrap ai-side">
            <div className="chat-bubble chat-bubble-ai">
              <div className="typing-dots"><span/><span/><span/></div>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div className="chat-input-bar">
        <textarea
          ref={inputRef}
          className="chat-textarea"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask ARIA anything…"
          rows={2}
          disabled={loading}
        />
        <button className="chat-send-btn" onClick={send} disabled={loading || !input.trim()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Chat;
