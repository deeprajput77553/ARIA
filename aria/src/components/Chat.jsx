import React, { useEffect, useRef, useState, useCallback } from 'react';
import { loadSettings } from './SettingsPage';
import { DB } from '../storage/Database.js';
import { msgBus, BUS_EVENTS } from '../storage/MessageBus.js';
import { speakFemale } from './Logs';
import { useOllama } from './Orb';
import { agentEngine } from '../engine/AgentEngine';

const Chat = ({ onNavigate }) => {
  const settings = loadSettings();
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const { chat, model } = useOllama();

  const refresh = useCallback(async () => {
    const data = await DB.getMessages();
    setMsgs(data.sort((a, b) => (a.timestamp || a.id) - (b.timestamp || b.id)));
  }, []);

  useEffect(() => {
    refresh();
    const unsubNew = msgBus.on(BUS_EVENTS.NEW_MESSAGE, refresh);
    const unsubUpd = msgBus.on(BUS_EVENTS.UPDATE_MESSAGE, refresh);
    return () => { unsubNew(); unsubUpd(); };
  }, [refresh]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [msgs]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setLoading(true);

    // Save user message
    const userMsg = await DB.addMessage('user', text);
    msgBus.emit(BUS_EVENTS.NEW_MESSAGE, userMsg);

    // Create placeholder AI message
    const aiMsg = await DB.addMessage('ai', '', [
      { label: 'Parsing intent', status: 'done' },
      { label: 'Synthesizing response', status: 'running' }
    ]);
    msgBus.emit(BUS_EVENTS.NEW_MESSAGE, aiMsg);

    try {
      await agentEngine.run(text, model, aiMsg.id);
      setLoading(false);
    } catch (err) {
      console.error(err);
      await DB.updateMessage(aiMsg.id, { 
        text: `⚠ Agent error: ${err.message}`,
        steps: [{ label: 'Error', status: 'error' }]
      });
      msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE);
      setLoading(false);
    }
  };

  const [confirmClear, setConfirmClear] = useState(false);

  const handleClearClick = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000); // Reset after 3s
      return;
    }
    
    // Confirmed
    try {
      await DB.clearMessages();
      setMsgs([]); // Force local update
      msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE); // Notify others (Logs)
      setConfirmClear(false);
    } catch (err) {
      console.error('Failed to clear messages:', err);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="chat-fullscreen">
      <header className="cf-header">
        <div className="cf-header-left">
          <div className="cf-orb-dot-container">
            <div className="cf-orb-dot" />
            <div className="cf-orb-ring" />
          </div>
          <div>
            <div className="cf-title">ARIA Cognitive Chat</div>
            <div className="cf-subtitle">Real-time Neural Interface</div>
          </div>
        </div>
        <div className="cf-header-right">
          <button 
            className={`cf-icon-btn cf-clear ${confirmClear ? 'confirming' : ''}`} 
            onClick={handleClearClick} 
            title={confirmClear ? "Click again to confirm" : "Clear Chat"}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 6L18 19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6M4 6h16M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
          <button 
            className="cf-icon-btn cf-snapshot" 
            onClick={async () => {
              const res = await fetch('http://localhost:3001/git/snapshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Manual snapshot from Chat' })
              });
              const data = await res.json();
              if (data.ok) alert('Git Snapshot created: ' + data.message);
              else alert('Snapshot failed: ' + data.error);
            }} 
            title="Create Git Snapshot"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
          <button className="cf-icon-btn cf-close" onClick={() => onNavigate('orb')}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </header>

      <div className="cf-messages premium-scroll" ref={scrollRef}>
        {msgs.map((m) => (
          <div key={m.id} className={`cf-wrap ${m.role === 'user' ? 'cf-user-wrap' : 'cf-ai-wrap'}`}>
            <div className={`cf-avatar ${m.role}-avatar`}>
              {m.role === 'user' ? (
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>
              )}
            </div>
            <div className="cf-bubble">
              <div className="cf-meta">
                <span className={`cf-status-pill ${m.role}`}>
                  <span className="pill-dot" />
                  {m.role === 'user' ? 'Operator' : 'ARIA Core'}
                </span>
                <span className="cf-time">{m.time}</span>
                
                {/* Message Actions */}
                <div className="cf-message-actions">
                  <button onClick={() => {
                    navigator.clipboard.writeText(m.text);
                  }} title="Copy Message">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                  {m.role === 'user' && (
                    <button onClick={() => {
                      setInput(m.text);
                      DB.deleteMessage(m.id).then(refresh);
                      inputRef.current?.focus();
                    }} title="Edit Message">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  )}
                  {m.role === 'ai' && (
                    <button onClick={async () => {
                      const userMsg = msgs.slice(0, msgs.indexOf(m)).reverse().find(msg => msg.role === 'user');
                      if (userMsg) {
                        await DB.updateMessage(m.id, { text: '', steps: [{ label: 'Regenerating...', status: 'running' }] });
                        refresh();
                        agentEngine.run(userMsg.text, model, m.id);
                      }
                    }} title="Regenerate Response">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                    </button>
                  )}
                  <button onClick={() => {
                    setInput(`About this message: "${m.text.substring(0, 50)}${m.text.length > 50 ? '...' : ''}"\n\n`);
                    inputRef.current?.focus();
                  }} title="Ask ARIA about this">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  </button>
                  <button className="cf-delete-msg" onClick={async () => {
                    await DB.deleteMessage(m.id);
                    refresh();
                  }} title="Delete Message">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  </button>
                </div>
              </div>
              {m.text && <p className="cf-text">{typeof m.text === 'string' ? m.text : JSON.stringify(m.text)}</p>}
              {!m.text && m.role === 'ai' && <div className="cf-text typing-cursor-inline">▌</div>}
              {m.steps && m.steps.length > 0 && (
                <div className="cf-steps">
                  {m.steps.map((s, i) => (
                    <div key={i} className={`cf-step ${s.status}`}>
                      <span className="cf-step-icon">
                        {s.status === 'done' ? (
                          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="3" fill="none"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : s.status === 'running' ? (
                          <svg className="spinning-icon" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="3" fill="none"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.67-1.36"/></svg>
                        ) : s.status === 'error' ? (
                          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="3" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="3" fill="none"><circle cx="12" cy="12" r="10"/></svg>
                        )}
                      </span>
                      <span>{s.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && msgs[msgs.length-1]?.role === 'user' && (
          <div className="cf-wrap cf-ai-wrap">
            <div className="cf-avatar ai-avatar">
               <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>
            </div>
            <div className="cf-bubble">
              <div className="typing-dots"><span/><span/><span/></div>
            </div>
          </div>
        )}
      </div>

      <div className="cf-input-bar">
        <textarea
          ref={inputRef}
          className="cf-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Describe your intent..."
          rows={1}
          disabled={loading}
        />
        <button className="cf-send-btn" onClick={send} disabled={loading || !input.trim()}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Chat;
