import React, { useEffect, useRef, useState, useCallback } from 'react';
import { loadSettings } from './SettingsPage';

// ── Soft chime sound ─────────────────────────────────────────────────────────
function playChime() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1100].forEach((freq, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, ac.currentTime + i * 0.08);
      g.gain.linearRampToValueAtTime(0.05, ac.currentTime + i * 0.08 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.08 + 0.22);
      o.start(ac.currentTime + i * 0.08);
      o.stop(ac.currentTime + i * 0.08 + 0.25);
    });
  } catch {}
}

// ── Female TTS ───────────────────────────────────────────────────────────────
export function speakFemale(text, settings) {
  if (!settings?.voiceEnabled) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const chosen = settings?.voiceName
    ? voices.find(v => v.name === settings.voiceName)
    : voices.find(v => /samantha|victoria|karen|zira|google.*female|fiona/i.test(v.name) && v.lang.startsWith('en'))
    || voices.find(v => v.lang.startsWith('en'));
  if (chosen) utt.voice = chosen;
  utt.pitch = settings?.voicePitch ?? 1.15;
  utt.rate  = settings?.voiceSpeed  ?? 0.95;
  window.speechSynthesis.speak(utt);
}

// ── DNA Helix Canvas ─────────────────────────────────────────────────────────
const DNAHelixCanvas = () => {
  const ref  = useRef(null);
  const sRef = useRef({ phi:0, last:null, breathT:0, scrollVel:0, lastClickTs:0 });

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio||1,2);
    const N=34, RPM=6, TW=9.5, TW_BACK=TW*0.32, SM_MAX=8, SM_MIN=2.5, BW=4.5;
    const COL_A=[0,140,255], COL_B=[220,30,80];
    const lerp=(a,b,t)=>a+(b-a)*t, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const smooth5=t=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
    const resize=()=>{ cv.width=cv.clientWidth*DPR; cv.height=cv.clientHeight*DPR; ctx.setTransform(DPR,0,0,DPR,0,0); };
    resize(); window.addEventListener('resize',resize);
    const tube=(x1,y1,d1,x2,y2,d2,rgb,alpha)=>{ const [r,g,b]=rgb, w1=lerp(TW_BACK,TW,d1), w2=lerp(TW_BACK,TW,d2); const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1, nx=-dy/L,ny=dx/L; const avgD=(d1+d2)*0.5, al=lerp(0.3,0.85,avgD)*alpha; const wMax=Math.max(w1,w2), mx=(x1+x2)/2, my=(y1+y2)/2; const gr=ctx.createLinearGradient(mx+nx*wMax*1.35,my+ny*wMax*1.35,mx-nx*wMax*1.35,my-ny*wMax*1.35); gr.addColorStop(0,`rgba(${r},${g},${b},${al*0.08})`); gr.addColorStop(0.42,`rgba(${r},${g},${b},${al})`); gr.addColorStop(0.56,`rgba(255,255,255,${al*0.65})`); gr.addColorStop(1,`rgba(${r},${g},${b},${al*0.06})`); ctx.save(); ctx.beginPath(); ctx.arc(x1,y1,w1,Math.atan2(ny,nx),Math.atan2(ny,nx)+Math.PI,false); ctx.arc(x2,y2,w2,Math.atan2(-ny,-nx),Math.atan2(-ny,-nx)+Math.PI,false); ctx.closePath(); ctx.fillStyle=gr; ctx.fill(); ctx.restore(); };
    const sphere=(x,y,depth,rgb,alpha)=>{ const [r,g,b]=rgb, rad=lerp(SM_MIN,SM_MAX,depth), al=lerp(0.35,0.95,depth)*alpha; ctx.save(); if(depth>0.2){ctx.shadowColor=`rgba(${r},${g},${b},${depth*0.25})`;ctx.shadowBlur=rad*2;} const lg=ctx.createRadialGradient(x-rad*0.34,y-rad*0.38,rad*0.02,x+rad*0.06,y+rad*0.10,rad*1.1); lg.addColorStop(0,`rgba(255,255,255,0.95)`); lg.addColorStop(0.4,`rgba(${r},${g},${b},${al})`); lg.addColorStop(1,`rgba(${Math.max(r-60,0)},${Math.max(g-60,0)},${Math.max(b-60,0)},${al*0.3})`); ctx.beginPath(); ctx.arc(x,y,rad,0,Math.PI*2); ctx.fillStyle=lg; ctx.fill(); ctx.shadowColor='transparent'; ctx.strokeStyle=`rgba(255,255,255,${0.28+depth*0.3})`; ctx.lineWidth=1.2; ctx.stroke(); ctx.restore(); };
    const bridge=(xA,yA,xB,yB,dA,dB,alpha)=>{ const avgD=(dA+dB)*0.5, dx=xB-xA,dy=yB-yA,L=Math.hypot(dx,dy)||1; const nx=-dy/L,ny=dx/L, hw=BW*lerp(0.4,1.0,avgD), al=lerp(0.2,0.65,avgD)*alpha; const P=[{x:xA+nx*hw,y:yA+ny*hw},{x:xA-nx*hw,y:yA-ny*hw},{x:xB-nx*hw,y:yB-ny*hw},{x:xB+nx*hw,y:yB+ny*hw}]; const bg=ctx.createLinearGradient(xA,yA,xB,yB); bg.addColorStop(0,`rgba(0,140,255,${al})`); bg.addColorStop(0.5,`rgba(240,240,255,${al*0.85})`); bg.addColorStop(1,`rgba(220,30,80,${al})`); ctx.save(); ctx.beginPath(); ctx.moveTo(P[0].x,P[0].y); for(let i=1;i<4;i++) ctx.lineTo(P[i].x,P[i].y); ctx.closePath(); ctx.fillStyle=bg; ctx.fill(); ctx.restore(); };
    let fid;
    const render=(ts)=>{ fid=requestAnimationFrame(render); const s=sRef.current; if(s.last===null) s.last=ts; const dt=Math.min((ts-s.last)/1000,0.05); s.last=ts; s.scrollVel*=0.92; const rpm=RPM+Math.abs(s.scrollVel)*3; s.phi+=(rpm/60)*Math.PI*2*dt+s.scrollVel*dt*2; s.breathT+=dt*0.38; const scale=1+Math.sin(s.breathT)*0.013; const CW=cv.clientWidth, CH=cv.clientHeight, CX=CW/2, cy=CH/2; const GAP=CH/(N-1), RAD=Math.min(CX*0.55,90); ctx.clearRect(0,0,CW,CH); const eg=ctx.createLinearGradient(0,cy,CW,cy); eg.addColorStop(0,'rgba(120,80,255,0)'); eg.addColorStop(0.15,'rgba(168,100,255,0.5)'); eg.addColorStop(0.5,'rgba(200,150,255,1)'); eg.addColorStop(0.85,'rgba(168,100,255,0.5)'); eg.addColorStop(1,'rgba(120,80,255,0)'); ctx.save(); ctx.shadowColor='rgba(160,100,255,0.5)'; ctx.shadowBlur=10; ctx.beginPath(); ctx.moveTo(0,cy); ctx.lineTo(CW,cy); ctx.strokeStyle=eg; ctx.lineWidth=1.8; ctx.stroke(); ctx.restore(); const nodes=[]; for(let i=0;i<N;i++){ const y=i*GAP, t=s.phi+(i/(N-1))*Math.PI*4; const xA=CX+Math.cos(t)*RAD*scale, xB=CX+Math.cos(t+Math.PI)*RAD*scale; const dA=smooth5((Math.sin(t)+1)/2), dB=smooth5((Math.sin(t+Math.PI)+1)/2); const distFromCenter=Math.abs(y-cy)/(CH/2); const alpha=Math.pow(clamp(1-distFromCenter,0,1),1.6); nodes.push({y,xA,xB,dA,dB,alpha}); } const segs=[]; for(let i=0;i<N-1;i++){ const n0=nodes[i],n1=nodes[i+1]; segs.push({k:'A',i,d:(n0.dA+n1.dA)/2,a:(n0.alpha+n1.alpha)/2}); segs.push({k:'B',i,d:(n0.dB+n1.dB)/2,a:(n0.alpha+n1.alpha)/2}); } segs.sort((a,b)=>a.d-b.d); for(const sg of segs){ const n0=nodes[sg.i],n1=nodes[sg.i+1]; if(sg.k==='A') tube(n0.xA,n0.y,n0.dA,n1.xA,n1.y,n1.dA,COL_A,sg.a); else tube(n0.xB,n0.y,n0.dB,n1.xB,n1.y,n1.dB,COL_B,sg.a); } const items=[]; for(let i=0;i<N;i++){ const n=nodes[i]; items.push({k:'br',i,d:(n.dA+n.dB)/2,a:n.alpha}); items.push({k:'sA',i,d:n.dA,a:n.alpha}); items.push({k:'sB',i,d:n.dB,a:n.alpha}); } items.sort((a,b)=>a.d-b.d); for(const it of items){ const n=nodes[it.i]; if(it.k==='br') bridge(n.xA,n.y,n.xB,n.y,n.dA,n.dB,it.a); else if(it.k==='sA') sphere(n.xA,n.y,n.dA,COL_A,it.a); else sphere(n.xB,n.y,n.dB,COL_B,it.a); } };
    requestAnimationFrame(render);
    return()=>{ cancelAnimationFrame(fid); window.removeEventListener('resize',resize); };
  },[]);

  return <canvas ref={ref} style={{width:'100%',height:'100%',display:'block'}}/>;
};

// ── Log Entry ─────────────────────────────────────────────────────────────────
const LogEntry = ({ entry, side }) => {
  const [open, setOpen] = useState(false);
  const isUser = side === 'user';
  return (
    <div className={`log-entry ${isUser?'log-user':'log-ai'}`}>
      <div className="log-bubble" onClick={() => entry.steps && setOpen(o=>!o)}>
        <div className="log-meta">
          <span className="log-role">{isUser ? '👤 You' : '⬡ ARIA'}</span>
          <span className="log-time">{entry.time}</span>
          {entry.steps && <span className="log-expand">{open?'▴':'▾'}</span>}
        </div>
        <p className="log-text">{entry.text || <span className="typing-cursor">▌</span>}</p>
      </div>
      {open && entry.steps && (
        <div className="log-steps">
          {entry.steps.map((s,i) => (
            <div key={i} className={`log-step ${s.status}`}>
              <span className="step-icon">{s.status==='done'?'✓':s.status==='running'?'⟳':'○'}</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Storage helpers ───────────────────────────────────────────────────────────
export const LOG_KEY = 'aria_conversation_log';
const nowStr = () => new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});

function getGreeting() {
  const h = new Date().getHours();
  const day = new Date().toLocaleDateString('en-US',{weekday:'long'});
  if (h>=5  && h<12) return `Good morning! It's ${day}. I'm ARIA — ready to assist you today.`;
  if (h>=12 && h<17) return `Good afternoon! Happy ${day}. What can I help you with?`;
  if (h>=17 && h<21) return `Good evening! Hope your ${day} was great. How can I help?`;
  return `Hello! Working late on ${day}? I'm always here for you.`;
}

export function loadLog() {
  try { const s=localStorage.getItem(LOG_KEY); return s ? JSON.parse(s) : null; }
  catch { return null; }
}
export function saveLog(log) {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch {}
}

// ── Build turns: group log into [user, ai] pairs ──────────────────────────────
function buildTurns(log) {
  const turns = [];
  let i = 0;
  while (i < log.length) {
    const turn = {};
    if (log[i]?.role === 'user') { turn.user = log[i]; i++; }
    if (i < log.length && log[i]?.role === 'ai') { turn.ai = log[i]; i++; }
    if (i < log.length && log[i]?.role === 'ai' && !turn.user) { turn.ai = log[i]; i++; }
    if (turn.user || turn.ai) turns.push(turn);
  }
  return turns;
}

// ── Logs Page ─────────────────────────────────────────────────────────────────
const Logs = () => {
  const settings = loadSettings();

  const initLog = () => {
    const existing = loadLog();
    if (existing && existing.length > 0) return existing;
    const greeting = [{ id:Date.now(), role:'ai', text:getGreeting(), time:nowStr(),
      steps:[{label:'Context evaluated',status:'done'},{label:'Greeting generated',status:'done'}] }];
    saveLog(greeting);
    return greeting;
  };

  const [log, setLog] = useState(initLog);
  const turns = buildTurns(log);

  const [focusedIdx, setFocusedIdx]   = useState(Math.max(0, turns.length - 1));
  const turnsLenRef = useRef(turns.length);
  const prevFocus   = useRef(focusedIdx);
  const wheelLock   = useRef(false);
  const containerRef = useRef(null);

  // Persist log
  useEffect(() => { saveLog(log); }, [log]);

  // Auto-focus latest turn when new messages arrive
  useEffect(() => {
    if (turns.length > turnsLenRef.current) {
      setFocusedIdx(turns.length - 1);
      turnsLenRef.current = turns.length;
    }
  });

  // Chime when turn changes
  useEffect(() => {
    if (prevFocus.current !== focusedIdx) { playChime(); prevFocus.current = focusedIdx; }
  }, [focusedIdx]);

  // Wheel → step between turns (throttled)
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      if (wheelLock.current) return;
      wheelLock.current = true;
      setTimeout(() => { wheelLock.current = false; }, 380);
      const dir = e.deltaY > 0 ? 1 : -1;
      setFocusedIdx(prev => Math.max(0, Math.min(turnsLenRef.current - 1, prev + dir)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Style for each turn — centered, shrink + fade away from focus
  const SLOT_H = 140;
  const getTurnStyle = (idx) => {
    const dist    = idx - focusedIdx;
    const absDist = Math.abs(dist);
    const ratio   = Math.max(0, 1 - absDist / 2.8);
    return {
      position:        'absolute',
      left:            0,
      right:           0,
      top:             `calc(50% + ${dist * SLOT_H}px)`,
      transform:       `translateY(-50%) scale(${0.65 + 0.35 * ratio})`,
      opacity:         absDist === 0 ? 1 : Math.max(0.08, ratio * 0.75),
      transformOrigin: 'center center',
      transition:      'top 0.42s cubic-bezier(0.16,1,0.3,1), transform 0.42s cubic-bezier(0.16,1,0.3,1), opacity 0.42s ease',
      zIndex:          Math.round(ratio * 10),
      pointerEvents:   absDist > 2 ? 'none' : 'auto',
    };
  };

  return (
    <div className="dna-chat-page" ref={containerRef}>
      {/* Equator highlight */}
      <div className="dna-equator-guide"/>

      {/* ── Left: USER logs ─────────────────────────────── */}
      <div className="dna-col user-col">
        <div className="col-header">
          <span className="col-dot user-dot"/>
          <span>User Logs</span>
          <span style={{marginLeft:'auto',fontSize:'10px',opacity:.4}}>{turns.length} turns</span>
        </div>
        <div className="message-list-sync">
          {turns.map((turn, idx) => (
            <div key={idx} style={getTurnStyle(idx)}>
              {turn.user
                ? <LogEntry entry={turn.user} side="user"/>
                : <div className="log-placeholder">—</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Center: DNA helix ───────────────────────────── */}
      <div className="dna-center">
        <DNAHelixCanvas/>
      </div>

      {/* ── Right: AI logs ──────────────────────────────── */}
      <div className="dna-col ai-col">
        <div className="col-header">
          <span className="col-dot ai-dot"/>
          <span>AI Logs</span>
        </div>
        <div className="message-list-sync">
          {turns.map((turn, idx) => (
            <div key={idx} style={getTurnStyle(idx)}>
              {turn.ai
                ? <LogEntry entry={turn.ai} side="ai"/>
                : <div className="log-placeholder">—</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Logs;
