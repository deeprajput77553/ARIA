import React, { useState, useEffect, useRef, useCallback } from 'react';
import { loadSettings } from './SettingsPage';
import { speakFemale } from './Logs';
import { DB } from '../storage/Database.js';
import { msgBus, BUS_EVENTS } from '../storage/MessageBus.js';
import { runWorkflow, WORKFLOW_STEPS } from '../storage/AgentWorkflow';
import { loadProfile, incrementSession, buildProactiveGreeting } from '../storage/UserProfile';

const nowStr = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

// ── Message Bubble (Premium) ──────────────────────────────────────────────────
const Bubble = ({ msg }) => {
  const [open, setOpen] = useState(false);
  const isAI = msg.role === 'ai';
  
  return (
    <div className={`premium-bubble-wrap ${isAI ? 'ai' : 'user'}`}>
      <div className="bubble-avatar">{isAI ? '⬡' : '👤'}</div>
      <div className="bubble-body" onClick={() => msg.steps && setOpen(!open)}>
        <div className="bubble-meta">
          <span className="bubble-role">{isAI ? 'ARIA' : 'You'}</span>
          <span className="bubble-time">{msg.time}</span>
          {msg.steps && <span className="bubble-chevron">{open ? '▴' : '▾'}</span>}
        </div>
        <p className="bubble-text">{msg.text || <span className="typing-cursor">▌</span>}</p>
        
        {open && msg.steps && (
          <div className="bubble-steps">
            {msg.steps.map((s, i) => (
              <div key={i} className={`bubble-step ${s.status}`}>
                <span className="step-icon">{s.status === 'done' ? '✓' : s.status === 'running' ? '⟳' : '○'}</span>
                <span className="step-label">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Chat Component (v2.0) ─────────────────────────────────────────────────────
const Chat = ({ onClose }) => {
  const settings = loadSettings();
  const [profile, setProfile] = useState(null);
  const [msgs,    setMsgs]    = useState([]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Sync with DB
  const refreshMessages = useCallback(async () => {
    const data = await DB.getMessages();
    setMsgs(data || []);
  }, []);

  useEffect(() => {
    (async () => {
      const p = await loadProfile();
      const updated = await incrementSession(p);
      setProfile(updated);
      
      const existing = await DB.getMessages();
      if (existing && existing.length > 0) {
        setMsgs(existing);
      } else {
        // Only if empty, trigger first greeting
        const text = buildProactiveGreeting(updated);
        const greeting = {
          id: Date.now(),
          role: 'ai',
          text,
          time: nowStr(),
          timestamp: Date.now(),
          steps: WORKFLOW_STEPS.map(s => ({ ...s, status: 'done' }))
        };
        await DB.putMessage(greeting);
        setMsgs([greeting]);
        speakFemale(text, settings);
      }
      setTimeout(() => inputRef.current?.focus(), 200);
    })();

    // Listen for DB changes if needed (or just refresh on send)
  }, [settings]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setLoading(true);

    const userId = Date.now();
    const aiId   = userId + 1;
    const userMsg = { id: userId, role: 'user', text, time: nowStr(), timestamp: userId };
    const aiMsg   = {
      id: aiId, role: 'ai', text: '', time: nowStr(), timestamp: aiId,
      steps: WORKFLOW_STEPS.map(s => ({ ...s, status: 'pending' }))
    };

    // Optimistic UI + DB Save
    await DB.putMessage(userMsg);
    await DB.putMessage(aiMsg);
    setMsgs(prev => [...prev, userMsg, aiMsg]);
    msgBus.emit(BUS_EVENTS.NEW_MESSAGE, { message: userMsg });
    msgBus.emit(BUS_EVENTS.NEW_MESSAGE, { message: aiMsg });

    try {
      const { fullResponse } = await runWorkflow(
        text,
        settings.model || 'llama3.2',
        async (updatedSteps) => {
          const updatedAiMsg = { ...aiMsg, steps: updatedSteps };
          await DB.putMessage(updatedAiMsg);
          setMsgs(prev => prev.map(m => m.id === aiId ? updatedAiMsg : m));
        },
        async (partial) => {
          setMsgs(prev => prev.map(m => m.id === aiId ? { ...m, text: partial } : m));
        },
      );
      
      // Save final streamed response to DB
      const finalAiMsg = { ...aiMsg, text: fullResponse, steps: WORKFLOW_STEPS.map(s => ({ ...s, status: 'done' })) };
      await DB.putMessage(finalAiMsg);
      setMsgs(prev => prev.map(m => m.id === aiId ? finalAiMsg : m));
      msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE, { id: aiId, updates: finalAiMsg });
      
      speakFemale(fullResponse, settings);
    } catch (err) {
      const errorMsg = { ...aiMsg, text: '⚠ Ollama offline — run: ollama serve' };
      await DB.putMessage(errorMsg);
      setMsgs(prev => prev.map(m => m.id === aiId ? errorMsg : m));
    }
    setLoading(false);
  }, [input, loading, settings]);

  const onKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  const clearHistory = async () => {
    if (confirm('Clear all chat history?')) {
      await DB.clearMessages();
      msgBus.emit(BUS_EVENTS.MESSAGES_CLEARED);
      const p = await loadProfile();
      const text = buildProactiveGreeting(p);
      const greeting = {
        id: Date.now(), role: 'ai', text, time: nowStr(),
        steps: [{ label: 'Context evaluated', status: 'done' }, { label: 'Greeting generated', status: 'done' }]
      };
      await DB.putMessage(greeting);
      setMsgs([greeting]);
      msgBus.emit(BUS_EVENTS.NEW_MESSAGE, { message: greeting });
    }
  };

  return (
    <div className="chat-fullscreen">
      {/* Header */}
      <div className="cf-header">
        <div className="cf-header-left">
          <div className="cf-orb-dot"/>
          <div>
            <div className="cf-title">ARIA Intelligence</div>
            <div className="cf-subtitle">Context-Aware Cognitive Pipeline</div>
          </div>
        </div>
        <div className="cf-header-right">
          <button className="cf-icon-btn" onClick={clearHistory} title="Clear history">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />
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
      <div className="cf-messages premium-scroll">
        {msgs.map(m => <Bubble key={m.id} msg={m}/>)}
        {loading && (
          <div className="premium-bubble-wrap ai loading">
            <div className="bubble-avatar">⬡</div>
            <div className="bubble-body">
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
          placeholder="Type your command..."
          rows={1}
          disabled={loading}
        />
        <button className="cf-send-btn" onClick={send} disabled={loading || !input.trim()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Chat;
