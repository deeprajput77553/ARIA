import React, { useEffect, useRef, useState, useCallback } from 'react';

// ─── AUDIO CLICK ─────────────────────────────────────────────────────────────
function createClickSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.04);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.05);
}

// ─── DNA CANVAS COMPONENT ─────────────────────────────────────────────────────
const DNACanvas = ({ messages, onNodeActivate }) => {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    phi: 0,
    last: null,
    breathT: 0,
    scrollVel: 0,
    lastScrollTime: 0,
    lastClickedNode: -1,
    lastClickTime: 0,
  });

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');

    const N = 34;
    const RPM_BASE = 6;
    const TW = 9.5;
    const TW_BACK = TW * 0.32;
    const SM_MAX = 8;
    const SM_MIN = 2.5;
    const BW = 4.5;

    const COL_A = [0, 140, 255];    // AI — blue
    const COL_B = [220, 30, 80];    // User — red

    const lerp  = (a, b, t) => a + (b - a) * t;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const smooth5 = t => { t = clamp(t, 0, 1); return t*t*t*(t*(t*6 - 15) + 10); };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width  = cv.clientWidth  * dpr;
      cv.height = cv.clientHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    // ── TUBE ──
    const tubeFill = (x1,y1,d1, x2,y2,d2, rgb, alpha) => {
      const [r,g,b] = rgb;
      const w1 = lerp(TW_BACK, TW, d1);
      const w2 = lerp(TW_BACK, TW, d2);
      const dx = x2-x1, dy = y2-y1;
      const L  = Math.hypot(dx, dy) || 1;
      const nx = -dy/L, ny = dx/L;
      const avgD = (d1+d2)*0.5;
      const al   = lerp(0.3, 0.85, avgD) * alpha;
      const wMax = Math.max(w1, w2);
      const mx = (x1+x2)/2, my = (y1+y2)/2;

      const gr = ctx.createLinearGradient(
        mx + nx*wMax*1.35, my + ny*wMax*1.35,
        mx - nx*wMax*1.35, my - ny*wMax*1.35
      );
      gr.addColorStop(0,    `rgba(${r},${g},${b},${al*0.08})`);
      gr.addColorStop(0.18, `rgba(${r},${g},${b},${al*0.50})`);
      gr.addColorStop(0.42, `rgba(${r},${g},${b},${al})`);
      gr.addColorStop(0.56, `rgba(255,255,255,${al*0.65})`);
      gr.addColorStop(0.70, `rgba(${r},${g},${b},${al})`);
      gr.addColorStop(0.88, `rgba(${r},${g},${b},${al*0.45})`);
      gr.addColorStop(1,    `rgba(${r},${g},${b},${al*0.06})`);

      ctx.save();
      ctx.beginPath();
      const a1 = Math.atan2(ny, nx);
      ctx.arc(x1, y1, w1, a1, a1 + Math.PI, false);
      const a2 = Math.atan2(-ny, -nx);
      ctx.arc(x2, y2, w2, a2, a2 + Math.PI, false);
      ctx.closePath();
      ctx.fillStyle = gr;
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.12 + avgD*0.18})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.restore();
    };

    // ── SPHERE ──
    const drawSphere = (x, y, depth, rgb, alpha, isActive, label) => {
      const [r,g,b] = rgb;
      const rad = lerp(SM_MIN, SM_MAX, depth) * (isActive ? 1.5 : 1);
      const al  = lerp(0.35, 0.95, depth) * alpha;

      ctx.save();
      if (depth > 0.2) {
        ctx.shadowColor   = `rgba(${r},${g},${b},${depth * 0.25})`;
        ctx.shadowBlur    = rad * 2;
        ctx.shadowOffsetY = rad * 0.25;
      }
      if (isActive) {
        ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
        ctx.shadowBlur  = rad * 4;
      }

      const lg = ctx.createRadialGradient(
        x - rad*0.34, y - rad*0.38, rad*0.02,
        x + rad*0.06, y + rad*0.10, rad*1.1
      );
      lg.addColorStop(0,    `rgba(255,255,255,${0.9 + depth*0.1})`);
      lg.addColorStop(0.16, `rgba(${Math.min(r+70,255)},${Math.min(g+70,255)},${Math.min(b+70,255)},${al})`);
      lg.addColorStop(0.55, `rgba(${r},${g},${b},${al})`);
      lg.addColorStop(0.85, `rgba(${Math.max(r-40,0)},${Math.max(g-40,0)},${Math.max(b-40,0)},${al*0.7})`);
      lg.addColorStop(1,    `rgba(${Math.max(r-70,0)},${Math.max(g-70,0)},${Math.max(b-70,0)},${al*0.3})`);

      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI*2);
      ctx.fillStyle = lg;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = `rgba(255,255,255,${0.28 + depth*0.3})`;
      ctx.lineWidth   = isActive ? 2 : 1.2;
      ctx.stroke();
      ctx.restore();
    };

    // ── BRIDGE ──
    const drawBridge = (xA,yA,xB,yB,dA,dB,alpha) => {
      const avgD = (dA+dB)*0.5;
      const dx = xB-xA, dy = yB-yA, L = Math.hypot(dx,dy)||1;
      const nx = -dy/L, ny = dx/L;
      const hw = BW * lerp(0.4, 1.0, avgD);
      const al = lerp(0.2, 0.65, avgD) * alpha;

      const P = [
        {x:xA+nx*hw, y:yA+ny*hw},
        {x:xA-nx*hw, y:yA-ny*hw},
        {x:xB-nx*hw, y:yB-ny*hw},
        {x:xB+nx*hw, y:yB+ny*hw}
      ];

      const bGrad = ctx.createLinearGradient(xA,yA,xB,yB);
      bGrad.addColorStop(0,    `rgba(0,140,255,${al})`);
      bGrad.addColorStop(0.38, `rgba(100,200,255,${al*1.1})`);
      bGrad.addColorStop(0.50, `rgba(240,240,255,${al*0.85})`);
      bGrad.addColorStop(0.62, `rgba(255,140,180,${al*1.1})`);
      bGrad.addColorStop(1,    `rgba(220,30,80,${al})`);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(P[0].x, P[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(P[i].x, P[i].y);
      ctx.closePath();
      ctx.fillStyle = bGrad;
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.22 + avgD*0.2})`;
      ctx.lineWidth   = 0.5;
      ctx.stroke();
      ctx.restore();
    };

    // ── CENTER LINE ──
    const drawCenterLine = (CX, CH) => {
      const cy = CH / 2;
      const grad = ctx.createLinearGradient(0, cy, CX * 2, cy);
      grad.addColorStop(0,    'rgba(120,80,255,0)');
      grad.addColorStop(0.15, 'rgba(120,80,255,0.4)');
      grad.addColorStop(0.4,  'rgba(168,120,255,0.8)');
      grad.addColorStop(0.5,  'rgba(200,160,255,1.0)');
      grad.addColorStop(0.6,  'rgba(168,120,255,0.8)');
      grad.addColorStop(0.85, 'rgba(120,80,255,0.4)');
      grad.addColorStop(1,    'rgba(120,80,255,0)');

      ctx.save();
      ctx.shadowColor = 'rgba(160,100,255,0.5)';
      ctx.shadowBlur  = 8;
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(CX * 2, cy);
      ctx.strokeStyle = grad;
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      // Equator glow pulse
      ctx.shadowBlur = 20;
      ctx.lineWidth  = 3;
      ctx.globalAlpha = 0.2 + Math.sin(Date.now() * 0.003) * 0.1;
      ctx.stroke();
      ctx.restore();
    };

    // ── BUILD NODES with equatorial fade ──
    const buildNodes = (scale, CX, CH) => {
      const pts = [];
      const GAP = CH / (N - 1);
      const cy  = CH / 2;
      const RAD = Math.min(CX * 0.55, 90);

      for (let i = 0; i < N; i++) {
        const y = i * GAP;
        const t = stateRef.current.phi + (i / (N-1)) * Math.PI * 4;
        const xA = CX + Math.cos(t) * RAD * scale;
        const xB = CX + Math.cos(t + Math.PI) * RAD * scale;
        const dA = smooth5((Math.sin(t) + 1) / 2);
        const dB = smooth5((Math.sin(t + Math.PI) + 1) / 2);

        // Equatorial fade: full alpha at center, near-zero at poles
        const distFromCenter = Math.abs(y - cy) / (CH / 2);
        const alpha = Math.pow(clamp(1 - distFromCenter, 0, 1), 1.6);

        pts.push({ y, xA, xB, dA, dB, alpha, index: i });
      }
      return pts;
    };

    // ── RENDER ──
    let frameId;
    const render = (ts) => {
      frameId = requestAnimationFrame(render);
      const s = stateRef.current;
      if (s.last === null) s.last = ts;
      const dt = Math.min((ts - s.last) / 1000, 0.05);
      s.last = ts;

      // Decay scroll velocity
      s.scrollVel *= 0.92;
      const rpm = RPM_BASE + Math.abs(s.scrollVel) * 3;

      s.phi += (rpm / 60) * Math.PI * 2 * dt + s.scrollVel * dt * 2;
      s.breathT += dt * 0.38;
      const scale = 1 + Math.sin(s.breathT) * 0.013;

      const CW = cv.clientWidth;
      const CH = cv.clientHeight;
      const CX = CW / 2;

      ctx.clearRect(0, 0, CW, CH);

      // Center equator line (drawn first)
      drawCenterLine(CX, CH);

      const nodes = buildNodes(scale, CX, CH);

      // ── Pass 1: tubes sorted by depth ──
      const GAP = CH / (N - 1);
      const segs = [];
      for (let i = 0; i < N-1; i++) {
        const n0 = nodes[i], n1 = nodes[i+1];
        segs.push({ k:'A', i, d:(n0.dA+n1.dA)/2, a:(n0.alpha+n1.alpha)/2 });
        segs.push({ k:'B', i, d:(n0.dB+n1.dB)/2, a:(n0.alpha+n1.alpha)/2 });
      }
      segs.sort((a,b) => a.d - b.d);
      for (const seg of segs) {
        const n0 = nodes[seg.i], n1 = nodes[seg.i+1];
        if (seg.k==='A') tubeFill(n0.xA,n0.y,n0.dA, n1.xA,n1.y,n1.dA, COL_A, seg.a);
        else             tubeFill(n0.xB,n0.y,n0.dB, n1.xB,n1.y,n1.dB, COL_B, seg.a);
      }

      // ── Pass 2: bridges + spheres sorted by depth ──
      const items = [];
      const cy = CH / 2;
      for (let i = 0; i < N; i++) {
        const n = nodes[i];
        items.push({ k:'br', i, d:(n.dA+n.dB)/2, a:n.alpha });
        items.push({ k:'sA', i, d:n.dA, a:n.alpha });
        items.push({ k:'sB', i, d:n.dB, a:n.alpha });
      }
      items.sort((a,b) => a.d - b.d);

      // Find the node closest to center (active nodes)
      let closestAIdx = -1, closestBIdx = -1;
      let closestADist = Infinity, closestBDist = Infinity;
      for (let i = 0; i < N; i++) {
        const n = nodes[i];
        const dist = Math.abs(n.y - cy);
        if (dist < closestADist) { closestADist = dist; closestAIdx = i; }
        if (dist < closestBDist) { closestBDist = dist; closestBIdx = i; }
      }

      for (const it of items) {
        const n = nodes[it.i];
        const isActiveA = it.i === closestAIdx && closestADist < GAP;
        const isActiveB = it.i === closestBIdx && closestBDist < GAP;

        if (it.k==='br')      drawBridge(n.xA,n.y,n.xB,n.y,n.dA,n.dB,it.a);
        else if (it.k==='sA') drawSphere(n.xA,n.y,n.dA,COL_A,it.a,isActiveA);
        else                   drawSphere(n.xB,n.y,n.dB,COL_B,it.a,isActiveB);
      }

      // Notify about active node for message display
      if (closestAIdx !== s.lastClickedNode && closestADist < GAP * 0.4) {
        s.lastClickedNode = closestAIdx;
      }
    };

    requestAnimationFrame(render);

    // Wheel scroll
    const onWheel = (e) => {
      e.preventDefault();
      stateRef.current.scrollVel += e.deltaY * 0.002;
      // Click sound per "tick" of scroll
      const now = Date.now();
      if (now - stateRef.current.lastScrollTime > 60) {
        stateRef.current.lastScrollTime = now;
        try { createClickSound(); } catch {}
      }
    };
    cv.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      cv.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="dna-canvas"
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
};

// ─── DNA CHAT PAGE ────────────────────────────────────────────────────────────
const DNAChat = () => {
  const [messages, setMessages] = useState([
    { id: 1, role: 'ai',   text: 'Hello! I am ARIA. How can I assist you today?' },
    { id: 2, role: 'user', text: 'Tell me about the universe.' },
    { id: 3, role: 'ai',   text: 'The universe is 13.8 billion years old, spanning at least 93 billion light-years. It contains over 2 trillion galaxies, each with billions of stars.' },
    { id: 4, role: 'user', text: 'That is incredible. What is dark matter?' },
    { id: 5, role: 'ai',   text: 'Dark matter is a hypothetical form of matter that does not interact with the electromagnetic field. It constitutes ~27% of the universe\'s mass-energy.' },
    { id: 6, role: 'user', text: 'Can you explain quantum entanglement?' },
    { id: 7, role: 'ai',   text: 'Quantum entanglement occurs when particles become correlated so that the quantum state of each cannot be described independently of the others, even across vast distances.' },
  ]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [model, setModel] = useState('llama3.2');

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('http://localhost:11434/api/tags');
        if (res.ok) {
          const data = await res.json();
          setOllamaAvailable(true);
          const models = data.models?.map(m => m.name) || [];
          const preferred = ['llama3.3','llama3.2','llama3.1','llama3','mistral','phi3','gemma3'];
          for (const p of preferred) {
            const found = models.find(m => m.toLowerCase().includes(p));
            if (found) { setModel(found); break; }
          }
        }
      } catch {}
    };
    check();
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg = { id: Date.now(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    scrollToBottom();

    const aiId = Date.now() + 1;
    setMessages(prev => [...prev, { id: aiId, role: 'ai', text: '' }]);

    if (ollamaAvailable) {
      try {
        const res = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt: text, stream: true })
        });
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value).split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const j = JSON.parse(line);
              if (j.response) {
                setMessages(prev => prev.map(m =>
                  m.id === aiId ? { ...m, text: m.text + j.response } : m
                ));
                scrollToBottom();
              }
            } catch {}
          }
        }
      } catch {
        setMessages(prev => prev.map(m =>
          m.id === aiId ? { ...m, text: 'Ollama is not reachable. Please start it with: ollama serve' } : m
        ));
      }
    } else {
      setTimeout(() => {
        setMessages(prev => prev.map(m =>
          m.id === aiId ? { ...m, text: `Ollama is offline. Start it to get real responses. (Model: ${model})` } : m
        ));
        scrollToBottom();
      }, 600);
    }

    setIsTyping(false);
    scrollToBottom();
  }, [input, isTyping, ollamaAvailable, model, scrollToBottom]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="dna-chat-page">
      {/* Left: AI messages */}
      <div className="dna-message-col ai-col">
        <div className="col-header">
          <span className="col-dot ai-dot"/>
          <span>ARIA</span>
        </div>
        <div className="message-list" ref={listRef}>
          {messages.filter(m => m.role === 'ai').map((m, idx) => (
            <div key={m.id} className="message-bubble ai-bubble" style={{ '--delay': `${idx * 0.05}s` }}>
              <div className="bubble-content">{m.text || <span className="typing-cursor">▌</span>}</div>
            </div>
          ))}
          {isTyping && (
            <div className="message-bubble ai-bubble typing">
              <div className="typing-dots"><span/><span/><span/></div>
            </div>
          )}
        </div>
      </div>

      {/* Center: DNA helix */}
      <div className="dna-center">
        <DNACanvas messages={messages} />
      </div>

      {/* Right: User messages */}
      <div className="dna-message-col user-col">
        <div className="col-header">
          <span className="col-dot user-dot"/>
          <span>You</span>
        </div>
        <div className="message-list">
          {messages.filter(m => m.role === 'user').map((m, idx) => (
            <div key={m.id} className="message-bubble user-bubble" style={{ '--delay': `${idx * 0.05}s` }}>
              <div className="bubble-content">{m.text}</div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="chat-input-row">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask ARIA anything..."
            rows={2}
          />
          <button className="send-btn" onClick={sendMessage} disabled={isTyping || !input.trim()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DNAChat;
