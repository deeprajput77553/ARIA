import React, { useEffect, useRef, useState, useCallback } from 'react';
import { loadSettings } from './SettingsPage';
import { DB } from '../storage/Database.js';
import { msgBus, BUS_EVENTS } from '../storage/MessageBus.js';
import { speakFemale } from './Logs';

const Chat = ({ onNavigate }) => {
  const settings = loadSettings();
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

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
      { label: 'Querying knowledge', status: 'running' },
      { label: 'Generating response', status: 'pending' },
    ]);
    msgBus.emit(BUS_EVENTS.NEW_MESSAGE, aiMsg);

    try {
      let targetModel = settings.model || 'llama3.2';
      
      // Auto-detect best model if the target isn't found
      try {
        const tagRes = await fetch('http://localhost:11434/api/tags');
        if (tagRes.ok) {
          const data = await tagRes.json();
          const models = data.models?.map(m => m.name) || [];
          if (!models.some(m => m === targetModel || m.startsWith(targetModel + ':'))) {
            const preferred = ['llama3.3', 'llama3.2', 'llama3.1', 'llama3', 'mistral', 'phi3', 'gemma3', 'deepseek-r1'];
            for (const p of preferred) {
              const found = models.find(m => m.toLowerCase().includes(p.toLowerCase()));
              if (found) { targetModel = found; break; }
            }
          }
        }
      } catch (e) {
        // Ignore tag fetch errors and proceed with targetModel
      }

      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: targetModel,
          prompt: text,
          stream: true
        }),
      });

      if (!res.ok) throw new Error('Ollama connection failed. Ensure `ollama serve` is running and the model is installed.');

      await DB.updateMessage(aiMsg.id, {
        steps: [
          { label: 'Parsing intent', status: 'done' },
          { label: 'Querying knowledge', status: 'done' },
          { label: 'Generating response', status: 'running' },
        ]
      });
      msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const j = JSON.parse(line);
            if (j.response) {
              fullText += j.response;
              // Optimization: throttle state updates if needed, but for now fluid streaming:
              await DB.updateMessage(aiMsg.id, { text: fullText });
              msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE);
            }
          } catch { }
        }
      }

      await DB.updateMessage(aiMsg.id, {
        steps: [
          { label: 'Parsing intent', status: 'done' },
          { label: 'Querying knowledge', status: 'done' },
          { label: 'Generating response', status: 'done' },
        ]
      });
      msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE);
      speakFemale(fullText, settings);

    } catch (err) {
      await DB.updateMessage(aiMsg.id, { 
        text: '⚠ Ollama connection failed. Ensure `ollama serve` is running.',
        steps: [{ label: 'Error', status: 'error' }]
      });
      msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE);
    } finally {
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
          <div className="cf-orb-dot" />
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
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 6L18 19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6M4 6h16M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
          <button className="cf-icon-btn cf-close" onClick={() => onNavigate('orb')}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </header>

      <div className="cf-messages premium-scroll" ref={scrollRef}>
        {msgs.map((m) => (
          <div key={m.id} className={`cf-wrap ${m.role === 'user' ? 'cf-user-wrap' : 'cf-ai-wrap'}`}>
            <div className="cf-avatar">
              {m.role === 'user' ? '👤' : '⬡'}
            </div>
            <div className="cf-bubble">
              <div className="cf-meta">
                <span className="cf-role">{m.role === 'user' ? 'You' : 'ARIA'}</span>
                <span className="cf-time">{m.time}</span>
              </div>
              <p className="cf-text">{m.text || <span className="typing-cursor">▌</span>}</p>
              {m.steps && m.steps.length > 0 && (
                <div className="cf-steps">
                  {m.steps.map((s, i) => (
                    <div key={i} className={`cf-step ${s.status}`}>
                      <span className="cf-step-icon">
                        {s.status === 'done' ? '✓' : s.status === 'running' ? '⟳' : '○'}
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
            <div className="cf-avatar">⬡</div>
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
