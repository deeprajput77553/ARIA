import React, { useState, useEffect, useRef, useCallback } from 'react';
import { loadSettings } from './SettingsPage';
import { speakFemale, loadLog, saveLog } from './Logs';
import { runWorkflow, WORKFLOW_STEPS } from '../storage/AgentWorkflow';
import { loadProfile, incrementSession, buildProactiveGreeting } from '../storage/UserProfile';

const nowStr = () => new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});

function getGreeting(profile) {
  return buildProactiveGreeting(profile);
}

// ── Message Bubble ────────────────────────────────────────────────────────────
const Bubble = ({ msg }) => {
  const [open, setOpen] = useState(false);
  const isAI = msg.role === 'ai';
  return (
    <div className={`cf-wrap ${isAI ? 'cf-ai-wrap' : 'cf-user-wrap'}`}>
      <div className="cf-avatar">{isAI ? '⬡' : '👤'}</div>
      <div className="cf-bubble" onClick={() => msg.steps && setOpen(o=>!o)}>
        <div className="cf-meta">
          <span className="cf-role">{isAI ? 'ARIA' : 'You'}</span>
          <span className="cf-time">{msg.time}</span>
          {msg.steps && <span className="cf-chevron">{open?'▴':'▾'}</span>}
        </div>
        <p className="cf-text">{msg.text || <span className="typing-cursor">▌</span>}</p>
        {open && msg.steps && (
          <div className="cf-steps">
            {msg.steps.map((s,i) => (
              <div key={i} className={`cf-step ${s.status}`}>
                <span>{s.status==='done'?'✓':s.status==='running'?'⟳':'○'}</span>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Chat Component ────────────────────────────────────────────────────────────
const Chat = ({ onClose }) => {
  const settings = loadSettings();
  const [profile, setProfile] = useState(null);
  const [msgs,    setMsgs]    = useState([]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Load shared history + profile + greet if empty
  useEffect(() => {
    (async () => {
      const p = await loadProfile();
      const updated = await incrementSession(p);
      setProfile(updated);
      const existing = loadLog();
      if (existing && existing.length > 0) {
        setMsgs(existing);
      } else {
        const greeting = {
          id: Date.now(), role:'ai', text: getGreeting(updated), time: nowStr(),
          steps: WORKFLOW_STEPS.map(s => ({...s, status:'done'}))
        };
        const initial = [greeting];
        setMsgs(initial); saveLog(initial);
      }
      setTimeout(() => inputRef.current?.focus(), 200);
    })();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [msgs]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setLoading(true);

    const userId = Date.now();
    const aiId   = userId + 1;
    const userMsg = { id:userId, role:'user', text, time:nowStr() };
    const aiMsg   = {
      id:aiId, role:'ai', text:'', time:nowStr(),
      steps: WORKFLOW_STEPS.map(s => ({...s, status:'pending'}))
    };

    setMsgs(prev => { const u=[...prev,userMsg,aiMsg]; saveLog(u); return u; });

    try {
      const { fullResponse } = await runWorkflow(
        text,
        settings.model || 'llama3.2',
        // onStepUpdate
        (updatedSteps) => {
          setMsgs(prev => { const u=prev.map(m=>m.id===aiId?{...m,steps:updatedSteps}:m); saveLog(u); return u; });
        },
        // onToken (streaming)
        (partial) => {
          setMsgs(prev => { const u=prev.map(m=>m.id===aiId?{...m,text:partial}:m); saveLog(u); return u; });
        },
      );
      speakFemale(fullResponse, settings);
    } catch {
      setMsgs(prev => { const u=prev.map(m=>m.id===aiId?{...m,text:'⚠ Ollama offline — run: ollama serve'}:m); saveLog(u); return u; });
    }
    setLoading(false);
  }, [input, loading, settings]);

  const onKey = e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  const clearHistory = () => {
    if (confirm('Clear all chat history?')) {
      const greeting = {
        id:Date.now(), role:'ai', text:getGreeting(), time:nowStr(),
        steps:[{label:'Context evaluated',status:'done'},{label:'Greeting generated',status:'done'}]
      };
      const initial = [greeting];
      setMsgs(initial); saveLog(initial);
    }
  };

  return (
    <div className="chat-fullscreen">
      {/* Header */}
      <div className="cf-header">
        <div className="cf-header-left">
          <div className="cf-orb-dot"/>
          <div>
            <div className="cf-title">ARIA Chat</div>
            <div className="cf-subtitle">Autonomous · Reasoning · Integration · Agent</div>
          </div>
        </div>
        <div className="cf-header-right">
          <button className="cf-icon-btn" onClick={clearHistory} title="Clear history">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            </svg>
          </button>
          <button className="cf-icon-btn cf-close" onClick={onClose} title="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="cf-messages">
        {msgs.map(m => <Bubble key={m.id} msg={m}/>)}
        {loading && (
          <div className="cf-wrap cf-ai-wrap">
            <div className="cf-avatar">⬡</div>
            <div className="cf-bubble">
              <div className="typing-dots"><span/><span/><span/></div>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div className="cf-input-bar">
        <textarea
          ref={inputRef}
          className="cf-textarea"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask ARIA anything…"
          rows={2}
          disabled={loading}
        />
        <button className="cf-send-btn" onClick={send} disabled={loading || !input.trim()}>
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
