import React, { useEffect, useRef, useState, useCallback } from 'react';
import DNALoader from './DNALoader';
import { loadSettings } from './SettingsPage';
import { DB } from '../storage/Database.js';
import { msgBus, BUS_EVENTS } from '../storage/MessageBus.js';
import { FiCpu, FiCheckCircle, FiDatabase, FiLoader, FiTerminal, FiSearch, FiMessageSquare, FiActivity } from 'react-icons/fi';
import { FaBrain, FaNetworkWired, FaCodeBranch, FaMagic, FaRegLightbulb } from 'react-icons/fa';

// ── Audio click sound ───────────────────────────────────────────────────────
function playClick() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(1100, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(350, ac.currentTime + 0.04);
    g.gain.setValueAtTime(0.12, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05);
    o.start(); o.stop(ac.currentTime + 0.05);
  } catch { }
}

function playTikTik() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const playTone = (time) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = 'triangle';
      o.frequency.setValueAtTime(3000, time);
      o.frequency.exponentialRampToValueAtTime(800, time + 0.02);
      g.gain.setValueAtTime(0.15, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
      o.start(time); o.stop(time + 0.03);
    };
    const now = ac.currentTime;
    playTone(now);
    playTone(now + 0.08);
  } catch { }
}

// ── Female TTS ──────────────────────────────────────────────────────────────
export function speakFemale(text, settings) {
  if (!settings?.voiceEnabled) return;
  // If there's an ongoing speech, cancel it first
  window.speechSynthesis.cancel();
  
  const utt = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const chosen = settings?.voiceName
    ? voices.find(v => v.name === settings.voiceName)
    : voices.find(v => /samantha|victoria|karen|zira|google.*female|female|fiona/i.test(v.name) && v.lang.startsWith('en'))
    || voices.find(v => v.lang.startsWith('en-') && v.default === false)
    || voices.find(v => v.lang.startsWith('en'));
  
  if (chosen) utt.voice = chosen;
  utt.pitch = settings?.voicePitch ?? 1.15;
  utt.rate = settings?.voiceSpeed ?? 0.95;
  window.speechSynthesis.speak(utt);
}

export function stopSpeaking() {
  window.speechSynthesis.cancel();
}

// ── DNA Canvas ──────────────────────────────────────────────────────────────
const DNAHelixCanvas = () => {
  const ref = useRef(null);
  const sRef = useRef({ phi: 0, last: null, breathT: 0, scrollVel: 0, lastClickTs: 0 });

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const N = 34, RPM = 6, TW = 9.5, TW_BACK = TW * 0.32, SM_MAX = 8, SM_MIN = 2.5, BW = 4.5;
    const COL_A = [0, 140, 255], COL_B = [220, 30, 80];
    const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const smooth5 = t => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };

    const resize = () => {
      cv.width = cv.clientWidth * DPR; cv.height = cv.clientHeight * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize(); window.addEventListener('resize', resize);

    const tube = (x1, y1, d1, x2, y2, d2, rgb, alpha) => {
      const [r, g, b] = rgb, w1 = lerp(TW_BACK, TW, d1), w2 = lerp(TW_BACK, TW, d2);
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      const avgD = (d1 + d2) * 0.5, al = lerp(0.3, 0.85, avgD) * alpha;
      const wMax = Math.max(w1, w2), mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const gr = ctx.createLinearGradient(mx + nx * wMax * 1.35, my + ny * wMax * 1.35, mx - nx * wMax * 1.35, my - ny * wMax * 1.35);
      gr.addColorStop(0, `rgba(${r},${g},${b},${al * 0.08})`);
      gr.addColorStop(0.42, `rgba(${r},${g},${b},${al})`);
      gr.addColorStop(0.56, `rgba(255,255,255,${al * 0.65})`);
      gr.addColorStop(1, `rgba(${r},${g},${b},${al * 0.06})`);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x1, y1, w1, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, false);
      ctx.arc(x2, y2, w2, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, false);
      ctx.closePath(); ctx.fillStyle = gr; ctx.fill(); ctx.restore();
    };

    const sphere = (x, y, depth, rgb, alpha) => {
      const [r, g, b] = rgb, rad = lerp(SM_MIN, SM_MAX, depth), al = lerp(0.35, 0.95, depth) * alpha;
      ctx.save();
      if (depth > 0.2) { ctx.shadowColor = `rgba(${r},${g},${b},${depth * 0.25})`; ctx.shadowBlur = rad * 2; }
      const lg = ctx.createRadialGradient(x - rad * 0.34, y - rad * 0.38, rad * 0.02, x + rad * 0.06, y + rad * 0.10, rad * 1.1);
      lg.addColorStop(0, `rgba(255,255,255,0.95)`);
      lg.addColorStop(0.4, `rgba(${r},${g},${b},${al})`);
      lg.addColorStop(1, `rgba(${Math.max(r - 60, 0)},${Math.max(g - 60, 0)},${Math.max(b - 60, 0)},${al * 0.3})`);
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fillStyle = lg; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = `rgba(255,255,255,${0.28 + depth * 0.3})`; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();
    };

    const bridge = (xA, yA, xB, yB, dA, dB, alpha) => {
      const avgD = (dA + dB) * 0.5, dx = xB - xA, dy = yB - yA, L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L, ny = dx / L, hw = BW * lerp(0.4, 1.0, avgD), al = lerp(0.2, 0.65, avgD) * alpha;
      const P = [{ x: xA + nx * hw, y: yA + ny * hw }, { x: xA - nx * hw, y: yA - ny * hw }, { x: xB - nx * hw, y: yB - ny * hw }, { x: xB + nx * hw, y: yB + ny * hw }];
      const bg = ctx.createLinearGradient(xA, yA, xB, yB);
      bg.addColorStop(0, `rgba(0,140,255,${al})`);
      bg.addColorStop(0.5, `rgba(240,240,255,${al * 0.85})`);
      bg.addColorStop(1, `rgba(220,30,80,${al})`);
      ctx.save(); ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(P[i].x, P[i].y);
      ctx.closePath(); ctx.fillStyle = bg; ctx.fill(); ctx.restore();
    };

    let fid;
    const render = (ts) => {
      fid = requestAnimationFrame(render);
      const s = sRef.current;
      if (s.last === null) s.last = ts;
      const dt = Math.min((ts - s.last) / 1000, 0.05); s.last = ts;
      s.scrollVel *= 0.92;
      const rpm = RPM + Math.abs(s.scrollVel) * 3;
      s.phi += (rpm / 60) * Math.PI * 2 * dt + s.scrollVel * dt * 2;
      s.breathT += dt * 0.38;
      const scale = 1 + Math.sin(s.breathT) * 0.013;

      const CW = cv.clientWidth, CH = cv.clientHeight, CX = CW / 2, cy = CH / 2;
      const GAP = CH / (N - 1), RAD = Math.min(CX * 0.55, 90);
      ctx.clearRect(0, 0, CW, CH);

      // Center equator line
      const eg = ctx.createLinearGradient(0, cy, CW, cy);
      eg.addColorStop(0, 'rgba(120,80,255,0)');
      eg.addColorStop(0.15, 'rgba(168,100,255,0.5)');
      eg.addColorStop(0.5, 'rgba(200,150,255,1)');
      eg.addColorStop(0.85, 'rgba(168,100,255,0.5)');
      eg.addColorStop(1, 'rgba(120,80,255,0)');
      ctx.save();
      ctx.shadowColor = 'rgba(160,100,255,0.5)'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(CW, cy);
      ctx.strokeStyle = eg; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.restore();

      // Build nodes
      const nodes = [];
      for (let i = 0; i < N; i++) {
        const y = i * GAP, t = s.phi + (i / (N - 1)) * Math.PI * 4;
        const xA = CX + Math.cos(t) * RAD * scale, xB = CX + Math.cos(t + Math.PI) * RAD * scale;
        const dA = smooth5((Math.sin(t) + 1) / 2), dB = smooth5((Math.sin(t + Math.PI) + 1) / 2);
        const distFromCenter = Math.abs(y - cy) / (CH / 2);
        const alpha = Math.pow(clamp(1 - distFromCenter, 0, 1), 1.6);
        nodes.push({ y, xA, xB, dA, dB, alpha });
      }

      // Tubes
      const segs = [];
      for (let i = 0; i < N - 1; i++) {
        const n0 = nodes[i], n1 = nodes[i + 1];
        segs.push({ k: 'A', i, d: (n0.dA + n1.dA) / 2, a: (n0.alpha + n1.alpha) / 2 });
        segs.push({ k: 'B', i, d: (n0.dB + n1.dB) / 2, a: (n0.alpha + n1.alpha) / 2 });
      }
      segs.sort((a, b) => a.d - b.d);
      for (const sg of segs) {
        const n0 = nodes[sg.i], n1 = nodes[sg.i + 1];
        if (sg.k === 'A') tube(n0.xA, n0.y, n0.dA, n1.xA, n1.y, n1.dA, COL_A, sg.a);
        else tube(n0.xB, n0.y, n0.dB, n1.xB, n1.y, n1.dB, COL_B, sg.a);
      }

      // Bridges + spheres
      const items = [];
      for (let i = 0; i < N; i++) {
        const n = nodes[i];
        items.push({ k: 'br', i, d: (n.dA + n.dB) / 2, a: n.alpha });
        items.push({ k: 'sA', i, d: n.dA, a: n.alpha });
        items.push({ k: 'sB', i, d: n.dB, a: n.alpha });
      }
      items.sort((a, b) => a.d - b.d);
      for (const it of items) {
        const n = nodes[it.i];
        if (it.k === 'br') bridge(n.xA, n.y, n.xB, n.y, n.dA, n.dB, it.a);
        else if (it.k === 'sA') sphere(n.xA, n.y, n.dA, COL_A, it.a);
        else sphere(n.xB, n.y, n.dB, COL_B, it.a);
      }
    };
    requestAnimationFrame(render);

    const onDNAWheel = e => {
      sRef.current.scrollVel += e.detail.deltaY * 0.002;
      const now = Date.now();
      if (now - sRef.current.lastClickTs > 55) { sRef.current.lastClickTs = now; playClick(); }
    };
    window.addEventListener('dna-scroll', onDNAWheel);

    return () => { cancelAnimationFrame(fid); window.removeEventListener('resize', resize); window.removeEventListener('dna-scroll', onDNAWheel); };
  }, []);

  return <canvas ref={ref} className="dna-canvas" style={{ width: '100%', height: '100%' }} />;
};

// ── Premium Log Entry Card ──────────────────────────────────────────────────
const PremiumLogEntry = ({ entry, role, isOpen, onToggle }) => {
  const isUser = role === 'user';
  
  const displayText = isUser 
    ? entry.text 
    : (isOpen ? entry.text : (entry.text && entry.text.length > 65 ? entry.text.substring(0, 65) + '...' : entry.text)) 
      || 'Processing cognitive intent...';

  const handleToggle = () => {
    if (!isUser && entry.steps?.length > 0) {
      if (onToggle) onToggle();
      if (!isOpen) playTikTik();
    }
  };

  const getStepIcon = (step) => {
    if (step.status === 'done') return <FiCheckCircle />;
    const lbl = step.label.toLowerCase();
    if (lbl.includes('analyze') || lbl.includes('search')) return <FiSearch />;
    if (lbl.includes('response') || lbl.includes('reply')) return <FiMessageSquare />;
    if (lbl.includes('memory') || lbl.includes('database')) return <FiDatabase />;
    if (lbl.includes('think') || lbl.includes('synthesize') || lbl.includes('cognitive')) return <FaBrain />;
    if (lbl.includes('network') || lbl.includes('api') || lbl.includes('fetch')) return <FaNetworkWired />;
    if (lbl.includes('parse') || lbl.includes('logic')) return <FaCodeBranch />;
    if (lbl.includes('generate') || lbl.includes('create')) return <FaMagic />;
    if (lbl.includes('idea') || lbl.includes('plan')) return <FaRegLightbulb />;
    if (step.status === 'running') return <FiLoader className="spinning-icon" />;
    return <FiActivity />;
  };

  return (
    <div className={`premium-log-entry compact ${isUser ? 'user' : 'ai'} ${isOpen ? 'expanded' : ''}`}>
      <div className="premium-log-card" onClick={handleToggle}>
        <div className="premium-log-meta">
          <div className="meta-left">
            <div className={`meta-icon ${isUser ? 'user' : 'ai'}`}>
              {isUser ? (
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>
              )}
            </div>
          </div>
          <span className="meta-time">{entry.time}</span>
        </div>
        
        <p className="premium-text">{displayText || <span className="typing-cursor">▌</span>}</p>

        {!isUser && entry.steps && entry.steps.length > 0 && (
          <div className="premium-expand-hint">
            {isOpen ? 'Hide steps ▴' : 'View internal logs ▾'}
          </div>
        )}

        {isOpen && !isUser && entry.steps && entry.steps.length > 0 && (
          <div className="premium-steps-timeline">
            {entry.steps.map((s, i) => (
              <div key={i} className={`timeline-step ${s.status}`}>
                <div className="timeline-icon">{getStepIcon(s)}</div>
                <div className="timeline-content">
                  <span className="step-label">{typeof s.label === 'string' ? s.label : JSON.stringify(s.label)}</span>
                  {s.status === 'running' && <span className="step-running-dot" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Logs Page (Unified Scrolling Architecture) ───────────────────────────────
const Logs = () => {
  const [msgs, setMsgs] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const scrollRef = useRef(null);

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

  const interactions = React.useMemo(() => {
    const arr = [];
    let curr = { user: null, ai: null, id: null };
    msgs.forEach(m => {
      if (m.role === 'user') {
        if (curr.user) arr.push(curr);
        curr = { user: m, ai: null, id: m.id };
      } else {
        curr.ai = m;
        arr.push(curr);
        curr = { user: null, ai: null, id: m.id };
      }
    });
    if (curr.user || curr.ai) arr.push(curr);
    return arr;
  }, [msgs]);

  const updateFades = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const centerY = container.getBoundingClientRect().height / 2;
    const rows = container.querySelectorAll('.interaction-row');
    
    rows.forEach(row => {
      const rect = row.getBoundingClientRect();
      const rowCenter = rect.top + rect.height / 2 - container.getBoundingClientRect().top;
      const dist = Math.abs(centerY - rowCenter);
      
      const maxDist = 350; 
      let opacity = 1 - (dist / maxDist) * 0.85; 
      if (opacity < 0.15) opacity = 0.15;
      
      let scale = 1 - (dist / maxDist) * 0.15; 
      if (scale < 0.85) scale = 0.85;
      
      row.style.opacity = opacity;
      row.style.transform = `scale(${scale})`;
      
      if (dist < 100) {
        row.classList.add('focused-row');
      } else {
        row.classList.remove('focused-row');
      }
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current && interactions.length > 0) {
      const rows = scrollRef.current.querySelectorAll('.interaction-row');
      if (rows.length > 0) {
        rows[rows.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    setTimeout(updateFades, 50);
  }, [interactions.length, updateFades]);

  const handleScroll = (e) => {
    updateFades();
  };

  const handleWheel = (e) => {
    window.dispatchEvent(new CustomEvent('dna-scroll', { detail: { deltaY: e.deltaY } }));
  };

  return (
    <div className="dna-chat-page unified-layout">
      {/* Background DNA */}
      <div className="dna-bg-container">
        <div className="dna-equator-guide" />
        <DNAHelixCanvas />
        <div className="logs-footer">
          <div className="scroll-indicator"><div className="scroll-dot" /></div>
          <span>Cognitive Stream</span>
        </div>
      </div>

      {/* Foreground Scroll Container */}
      <div 
        className="unified-scroll-container premium-scroll" 
        ref={scrollRef} 
        onScroll={handleScroll}
        onWheel={handleWheel}
      >
        <div className="scroll-padding-top" />
        {interactions.map((interaction, idx) => (
          <div className="interaction-row" key={interaction.id || idx}>
            <div className="row-col user-col-item">
              {interaction.user && <PremiumLogEntry entry={interaction.user} role="user" />}
            </div>
            <div className="row-col center-gap"></div>
            <div className="row-col ai-col-item">
              {interaction.ai && (
                <PremiumLogEntry 
                  entry={interaction.ai} 
                  role="ai" 
                  isOpen={expandedId === interaction.ai.id}
                  onToggle={() => setExpandedId(expandedId === interaction.ai.id ? null : interaction.ai.id)}
                />
              )}
            </div>
          </div>
        ))}
        <div className="scroll-padding-bottom" />
      </div>
    </div>
  );
};

export default Logs;
