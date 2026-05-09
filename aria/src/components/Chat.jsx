import React, { useState, useEffect, useRef, useCallback } from 'react';
<<<<<<< HEAD
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
=======
import { DB } from '../storage/Database';
import { msgBus, BUS_EVENTS } from '../storage/MessageBus';
import { loadSettings } from './SettingsPage';
import { speakFemale } from './Logs';

const Chat = ({ onNavigate }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  // --- OLLAMA HOOK (Synced with Orb.jsx) ---
  const [isAvailable, setIsAvailable] = useState(false);
  const [model, setModel] = useState(() => loadSettings().model || 'llama3.2');

  useEffect(() => {
    const checkOllama = async () => {
      try {
        const res = await fetch('http://localhost:11434/api/tags');
        if (res.ok) {
          const data = await res.json();
          setIsAvailable(true);
          const models = data.models?.map(m => m.name) || [];
          const preferred = ['llama3.3', 'llama3.2', 'llama3.1', 'llama3', 'mistral', 'phi3', 'gemma3', 'deepseek-r1'];
          for (const p of preferred) {
            const found = models.find(m => m.toLowerCase().includes(p.toLowerCase()));
            if (found) { setModel(found); break; }
          }
        }
      } catch { setIsAvailable(false); }
    };
    checkOllama();
    const interval = setInterval(checkOllama, 15000);
    return () => clearInterval(interval);
  }, []);

  const refreshMessages = useCallback(async () => {
    const data = await DB.getMessages();
    setMessages(data.sort((a, b) => (a.timestamp || a.id) - (b.timestamp || b.id)));
  }, []);

  useEffect(() => {
    refreshMessages();
    const unsubNew = msgBus.on(BUS_EVENTS.NEW_MESSAGE, refreshMessages);
    const unsubUpd = msgBus.on(BUS_EVENTS.UPDATE_MESSAGE, refreshMessages);
    return () => { unsubNew(); unsubUpd(); };
  }, [refreshMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = {
      id: Date.now(),
      role: 'user',
      text: input,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };

    setInput('');
    await DB.putMessage(userMsg);
    msgBus.emit(BUS_EVENTS.NEW_MESSAGE, userMsg);

    setIsTyping(true);
    let aiText = '';
    const aiMsgId = Date.now() + 1;
    const aiMsg = {
      id: aiMsgId,
      role: 'ai',
      text: '',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now() + 1
    };

    await DB.putMessage(aiMsg);
    msgBus.emit(BUS_EVENTS.NEW_MESSAGE, aiMsg);

    try {
      console.log(`Sending prompt to Ollama [${model}]:`, input);
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: input, stream: true })
      });

      if (!res.ok) throw new Error(`Ollama error: ${res.status} ${res.statusText}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const j = JSON.parse(line);
            if (j.response) {
              aiText += j.response;
              const updatedAiMsg = { ...aiMsg, text: aiText };
              await DB.putMessage(updatedAiMsg);
              msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE, updatedAiMsg);
            }
            if (j.error) throw new Error(j.error);
          } catch (e) {
            console.warn('Chunk parse error:', e, line);
          }
        }
      }
      
      if (aiText) speakFemale(aiText, loadSettings());
      else throw new Error("Ollama returned an empty response.");

    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg = { ...aiMsg, text: `Error: ${err.message}. Ensure Ollama is running and model "${model}" is pulled.` };
      await DB.putMessage(errorMsg);
      msgBus.emit(BUS_EVENTS.UPDATE_MESSAGE, errorMsg);
    } finally {
      setIsTyping(false);
>>>>>>> 703a2f0 (Refine ARIA Logs with DB sync, restore original DNA, and stabilize chat integration)
    }
  };

  return (
<<<<<<< HEAD
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
=======
    <div className="chat-container">
      <header className="chat-header">
        <button className="back-btn" onClick={() => onNavigate('orb')} title="Back to Orb">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2.5" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="chat-header-info">
          <h1>ARIA Chat</h1>
          <span className="status-indicator">
            <span className={`pulse-dot ${isAvailable ? 'online' : 'offline'}`}></span> 
            {isAvailable ? 'Online' : 'Ollama Offline'}
          </span>
        </div>
        <div className="model-badge">{model}</div>
      </header>

      <div className="messages-list" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="empty-icon">⬡</div>
            <h2>Start a conversation</h2>
            <p>ARIA is ready to assist you. Type something below.</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`message-wrapper ${m.role}`}>
            <div className="message-bubble">
              <div className="message-meta">
                <span className="role-label">{m.role === 'ai' ? 'ARIA' : 'YOU'}</span>
                <span className="time-label">{m.time}</span>
              </div>
              <div className="message-content">{m.text || '...'}</div>
            </div>
          </div>
        ))}
        {isTyping && !messages.find(m => m.id > Date.now() - 1000 && m.role === 'ai' && m.text) && (
          <div className="message-wrapper ai typing">
            <div className="message-bubble">
              <div className="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}
      </div>

      <form className="chat-input-area" onSubmit={handleSend}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isTyping}
        />
        <button type="submit" disabled={!input.trim() || isTyping} className="send-btn">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </form>

      <style>{`
        .chat-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #06040c;
          color: white;
          font-family: 'Outfit', sans-serif;
          position: relative;
          overflow: hidden;
        }

        .chat-header {
          display: flex;
          align-items: center;
          padding: 20px 30px;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          z-index: 10;
        }

        .back-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          margin-right: 20px;
          transition: all 0.3s ease;
        }

        .back-btn:hover {
          background: rgba(56, 189, 248, 0.15);
          border-color: rgba(56, 189, 248, 0.4);
          color: #38bdf8;
          transform: translateX(-3px);
        }

        .chat-header-info h1 {
          font-size: 18px;
          margin: 0;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .status-indicator {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 2px;
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
          margin-right: 2px;
        }

        .pulse-dot.online {
          background: #10b981;
          box-shadow: 0 0 10px #10b981;
          animation: pulse 2s infinite;
        }

        .pulse-dot.offline {
          background: #ef4444;
          box-shadow: 0 0 10px #ef4444;
        }

        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }

        .model-badge {
          margin-left: auto;
          background: rgba(56, 189, 248, 0.1);
          border: 1px solid rgba(56, 189, 248, 0.2);
          color: #38bdf8;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .messages-list {
          flex: 1;
          overflow-y: auto;
          padding: 30px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          scroll-behavior: smooth;
        }

        .messages-list::-webkit-scrollbar {
          width: 5px;
        }

        .messages-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }

        .message-wrapper {
          display: flex;
          width: 100%;
        }

        .message-wrapper.user {
          justify-content: flex-end;
        }

        .message-bubble {
          max-width: 75%;
          padding: 16px 20px;
          border-radius: 20px;
          position: relative;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          animation: messageIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
        }

        .message-wrapper.user .message-bubble {
          background: rgba(56, 189, 248, 0.1);
          border-color: rgba(56, 189, 248, 0.2);
          border-bottom-right-radius: 4px;
        }

        .message-wrapper.ai .message-bubble {
          background: rgba(255, 255, 255, 0.04);
          border-bottom-left-radius: 4px;
        }

        @keyframes messageIn {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .message-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          opacity: 0.6;
        }

        .message-wrapper.user .role-label { color: #38bdf8; }
        .message-wrapper.ai .role-label { color: #f472b6; }

        .message-content {
          font-size: 15px;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .chat-input-area {
          padding: 24px 30px;
          display: flex;
          gap: 15px;
          background: rgba(255, 255, 255, 0.02);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
        }

        .chat-input-area input {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 15px 20px;
          border-radius: 14px;
          color: white;
          font-family: inherit;
          font-size: 15px;
          transition: all 0.3s ease;
        }

        .chat-input-area input:focus {
          outline: none;
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(56, 189, 248, 0.5);
          box-shadow: 0 0 15px rgba(56, 189, 248, 0.1);
        }

        .send-btn {
          width: 54px;
          height: 54px;
          border-radius: 14px;
          background: #38bdf8;
          color: white;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .send-btn:hover:not(:disabled) {
          transform: scale(1.05) translateY(-2px);
          background: #0ea5e9;
          box-shadow: 0 5px 15px rgba(56, 189, 248, 0.4);
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: rgba(255, 255, 255, 0.1);
        }

        .chat-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          opacity: 0.3;
          text-align: center;
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 20px;
          animation: float 4s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
          padding: 4px 0;
        }

        .typing-indicator span {
          width: 6px;
          height: 6px;
          background: rgba(255, 255, 255, 0.5);
          border-radius: 50%;
          animation: typing 1.4s infinite;
        }

        .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes typing {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.4); opacity: 1; }
        }
      `}</style>
>>>>>>> 703a2f0 (Refine ARIA Logs with DB sync, restore original DNA, and stabilize chat integration)
    </div>
  );
};

export default Chat;
