import React, { useEffect, useRef } from 'react';

// DNA Loader canvas — ported from dna-loader-buttons.html
const DNALoaderCanvas = ({ size = 22, running = true }) => {
  const ref = useRef(null);
  const stateRef = useRef({ phi: 0, last: null, time: 0, frameId: null });

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    cv.width  = size * DPR;
    cv.height = size * DPR;
    cv.style.width  = size + 'px';
    cv.style.height = size + 'px';
    const ctx = cv.getContext('2d');
    ctx.scale(DPR, DPR);

    const S = size, CX = S/2, CY = S/2;
    const VSPAN = S * 0.82, TOP = CY - VSPAN/2;
    const AMP = S * 0.22, SW = S * 0.10, RW = S * 0.10;
    const STEPS = 80, TURNS = 1, RUNGS = 5;
    const CA_FRONT = '#4facfe', CA_BACK = '#071828';
    const CB_FRONT = '#f64f59', CB_BACK = '#1e0008';
    const SCOLS = [
      {r:79,g:172,b:254},{r:0,g:242,b:195},
      {r:255,g:201,b:60},{r:246,g:79,b:89},{r:167,g:139,b:250}
    ];

    const speed = t => 0.30 + 7.0 * Math.pow(Math.max(0, Math.sin(t * 2.2)), 2.6);

    const sphere = (x, y, R, col, alpha) => {
      const {r,g,b} = col;
      const glow = ctx.createRadialGradient(x,y,0,x,y,R*2.8);
      glow.addColorStop(0, `rgba(${r},${g},${b},${alpha*0.35})`);
      glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.save(); ctx.beginPath(); ctx.arc(x,y,R*2.8,0,Math.PI*2);
      ctx.fillStyle = glow; ctx.fill(); ctx.restore();

      const gr = ctx.createRadialGradient(x-R*0.38,y-R*0.38,R*0.01,x+R*0.15,y+R*0.18,R*1.1);
      gr.addColorStop(0,'rgba(255,255,255,1)');
      gr.addColorStop(0.12,`rgba(${Math.min(r+100,255)},${Math.min(g+100,255)},${Math.min(b+100,255)},1)`);
      gr.addColorStop(0.45,`rgba(${r},${g},${b},1)`);
      gr.addColorStop(1,'rgba(0,0,0,0.85)');
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.arc(x,y,R,0,Math.PI*2);
      ctx.fillStyle = gr; ctx.fill(); ctx.restore();
    };

    const draw = (phi, time) => {
      const spd = speed(time);
      const fade = 0.50 + 0.28*(spd/7.5);
      ctx.fillStyle = `rgba(8,8,15,${fade})`;
      ctx.fillRect(0,0,S,S);
      ctx.save();
      ctx.translate(CX,CY); ctx.rotate(Math.PI/4); ctx.translate(-CX,-CY);

      const pts = (phase) => {
        const a = [];
        for (let i = 0; i <= STEPS; i++) {
          const f = i/STEPS, t = phi + phase + f*Math.PI*2*TURNS;
          a.push({x:CX+Math.cos(t)*AMP, y:TOP+f*VSPAN, depth:(Math.sin(t)+1)/2});
        }
        return a;
      };
      const pA = pts(0), pB = pts(Math.PI);

      const rungData = [];
      for (let ri = 0; ri < RUNGS; ri++) {
        const f = ri/(RUNGS-1), idx = Math.round(f*STEPS);
        const d = (pA[idx].depth + pB[idx].depth)/2;
        rungData.push({ri,d,xA:pA[idx].x,yA:pA[idx].y,xB:pB[idx].x,yB:pB[idx].y});
      }

      const dl = [];
      for (let i = 0; i < STEPS; i++) {
        dl.push({k:'sA',i,d:(pA[i].depth+pA[i+1].depth)/2});
        dl.push({k:'sB',i,d:(pB[i].depth+pB[i+1].depth)/2});
      }
      for (const rd of rungData) {
        dl.push({k:'bar',d:rd.d-0.01,rd});
        dl.push({k:'spA',d:rd.d+0.001,rd});
        dl.push({k:'spB',d:rd.d+0.001,rd});
      }
      dl.sort((a,b)=>a.d-b.d);

      for (const it of dl) {
        if (it.k==='sA'||it.k==='sB') {
          const p=it.k==='sA'?pA:pB, cF=it.k==='sA'?CA_FRONT:CB_FRONT, cB=it.k==='sA'?CA_BACK:CB_BACK;
          ctx.save(); ctx.globalAlpha = 0.28+it.d*0.72;
          ctx.beginPath(); ctx.moveTo(p[it.i].x,p[it.i].y); ctx.lineTo(p[it.i+1].x,p[it.i+1].y);
          ctx.strokeStyle = it.d>0.5?cF:cB;
          ctx.lineWidth = SW*(0.30+it.d*0.70); ctx.lineCap='round';
          ctx.stroke(); ctx.restore();
        } else if (it.k==='bar') {
          const {xA,yA,xB,yB,d,ri}=it.rd, c=SCOLS[ri%SCOLS.length];
          const gr=ctx.createLinearGradient(xA,yA,xB,yB);
          gr.addColorStop(0,`rgba(${c.r},${c.g},${c.b},${0.55+d*0.35})`);
          gr.addColorStop(0.5,`rgba(255,255,255,${0.40+d*0.40})`);
          gr.addColorStop(1,`rgba(${c.r},${c.g},${c.b},${0.55+d*0.35})`);
          ctx.save(); ctx.globalAlpha=0.70+d*0.30;
          ctx.beginPath(); ctx.moveTo(xA,yA); ctx.lineTo(xB,yB);
          ctx.strokeStyle=gr; ctx.lineWidth=SW*0.22; ctx.lineCap='round';
          ctx.stroke(); ctx.restore();
        } else {
          const {xA,yA,xB,yB,d,ri}=it.rd, c=SCOLS[ri%SCOLS.length];
          const R=RW*(0.55+d*0.45), al=0.60+d*0.40;
          sphere(it.k==='spA'?xA:xB, it.k==='spA'?yA:yB, R, c, al);
        }
      }
      ctx.restore();
    };

    const s = stateRef.current;
    const frame = (ts) => {
      if (!running) return;
      if (s.last===null) s.last=ts;
      const dt = Math.min((ts-s.last)/1000, 0.05);
      s.last=ts; s.time+=dt;
      const spd = speed(s.time);
      s.phi += dt * Math.PI*2*(18/60)*spd;
      draw(s.phi, s.time);
      s.frameId = requestAnimationFrame(frame);
    };
    s.frameId = requestAnimationFrame(frame);
    return () => { if (s.frameId) cancelAnimationFrame(s.frameId); };
  }, [size, running]);

  return <canvas ref={ref} style={{display:'block'}}/>;
};

export default DNALoaderCanvas;
