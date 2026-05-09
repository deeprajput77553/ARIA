import React, { useEffect, useRef, useState, useCallback } from 'react';
import { DB } from '../storage/Database.js';
import { runDecayCycle } from '../storage/DecayRunner.js';

// ── Color by node type ────────────────────────────────────────────────────────
const TYPE_COLORS = {
  idea:        '#a78bfa',
  task:        '#f472b6',
  study:       '#38bdf8',
  information: '#34d399',
  personal:    '#fbbf24',
  document:    '#fb923c',
  web_data:    '#60a5fa',
  image:       '#e879f9',
};
const TIER_OPACITY = { hot: 1, warm: 0.75, cold: 0.4, archived: 0.2 };

const KnowledgeGraph = () => {
  const canvasRef  = useRef(null);
  const [nodes,  setNodes]  = useState([]);
  const [edges,  setEdges]  = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState({ type: 'all', minWeight: 0.3 });
  const [stats, setStats] = useState({ total: 0, hot: 0, warm: 0, cold: 0, archived: 0 });
  const [running, setRunning] = useState(false);
  const posRef   = useRef({});  // node positions
  const dragRef  = useRef(null);
  const animRef  = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0, scale: 1 });
  const isPanning = useRef(false);
  const panStart  = useRef({ x: 0, y: 0 });

  // ── Load data ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const [n, e] = await Promise.all([DB.getNodes(), DB.getEdges()]);
    setNodes(n || []);
    setEdges(e || []);
    const st = { total: n.length };
    n.forEach(nd => { st[nd.tier || 'warm'] = (st[nd.tier || 'warm'] || 0) + 1; });
    setStats(st);
    // Assign positions if new
    n.forEach(nd => {
      if (!posRef.current[nd.id]) {
        posRef.current[nd.id] = {
          x: 100 + Math.random() * 600,
          y: 100 + Math.random() * 400,
          vx: 0, vy: 0,
        };
      }
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Canvas draw loop ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const { x: ox, y: oy, scale } = offsetRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      const bg = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, canvas.width);
      bg.addColorStop(0, '#0d0820');
      bg.addColorStop(1, '#070410');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(scale, scale);

      const visibleNodes = filter.type === 'all' ? nodes : nodes.filter(n => n.type === filter.type);
      const nodeIds = new Set(visibleNodes.map(n => n.id));

      // Draw edges
      edges.forEach(e => {
        if (e.weight < filter.minWeight) return;
        if (!nodeIds.has(e.from_node) || !nodeIds.has(e.to_node)) return;
        const pa = posRef.current[e.from_node];
        const pb = posRef.current[e.to_node];
        if (!pa || !pb) return;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = `rgba(167,139,250,${e.weight * 0.6})`;
        ctx.lineWidth   = e.weight * 3;
        ctx.stroke();
      });

      // Draw nodes
      visibleNodes.forEach(node => {
        const p   = posRef.current[node.id];
        if (!p) return;
        const col = TYPE_COLORS[node.type] || '#a78bfa';
        const opa = TIER_OPACITY[node.tier || 'warm'];
        const r   = 8 + (node.access_count || 0) * 0.5;
        const isSel = selected?.id === node.id;

        // Glow
        if (isSel || (node.tier === 'hot')) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
          g.addColorStop(0, col + '55');
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(p.x, p.y, isSel ? r * 1.4 : r, 0, Math.PI * 2);
        ctx.fillStyle   = col + Math.round(opa * 255).toString(16).padStart(2,'0');
        ctx.strokeStyle = isSel ? '#fff' : col;
        ctx.lineWidth   = isSel ? 2.5 : 1;
        ctx.fill();
        ctx.stroke();

        // Label
        if (scale > 0.5 || isSel) {
          ctx.fillStyle   = `rgba(255,255,255,${opa * 0.85})`;
          ctx.font        = `${isSel ? 12 : 10}px Inter, sans-serif`;
          ctx.textAlign   = 'center';
          ctx.fillText((node.summary || node.content || '').slice(0, 22), p.x, p.y + r + 14);
        }
      });

      ctx.restore();
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [nodes, edges, selected, filter]);

  // ── Force-directed layout (simple) ────────────────────────────────────────
  useEffect(() => {
    if (!nodes.length) return;
    const step = () => {
      const pos = posRef.current;
      nodes.forEach(a => {
        if (!pos[a.id]) return;
        nodes.forEach(b => {
          if (a.id === b.id || !pos[b.id]) return;
          const dx = pos[a.id].x - pos[b.id].x;
          const dy = pos[a.id].y - pos[b.id].y;
          const d  = Math.sqrt(dx*dx + dy*dy) || 1;
          const f  = Math.min(2000 / (d * d), 5);
          pos[a.id].vx += (dx / d) * f;
          pos[a.id].vy += (dy / d) * f;
        });
      });
      edges.forEach(e => {
        if (!pos[e.from_node] || !pos[e.to_node]) return;
        const dx = pos[e.to_node].x - pos[e.from_node].x;
        const dy = pos[e.to_node].y - pos[e.from_node].y;
        const d  = Math.sqrt(dx*dx + dy*dy) || 1;
        const strength = 0.01 * e.weight;
        pos[e.from_node].vx += dx * strength;
        pos[e.from_node].vy += dy * strength;
        pos[e.to_node].vx   -= dx * strength;
        pos[e.to_node].vy   -= dy * strength;
      });
      nodes.forEach(n => {
        if (!pos[n.id]) return;
        pos[n.id].vx *= 0.85;
        pos[n.id].vy *= 0.85;
        pos[n.id].x  += pos[n.id].vx;
        pos[n.id].y  += pos[n.id].vy;
        pos[n.id].x = Math.max(20, Math.min(780, pos[n.id].x));
        pos[n.id].y = Math.max(20, Math.min(480, pos[n.id].y));
      });
    };
    const id = setInterval(step, 50);
    return () => clearInterval(id);
  }, [nodes, edges]);

  // ── Mouse interaction ─────────────────────────────────────────────────────
  const getWorldPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const { x: ox, y: oy, scale } = offsetRef.current;
    return {
      x: (e.clientX - rect.left - ox) / scale,
      y: (e.clientY - rect.top  - oy) / scale,
    };
  };

  const onCanvasClick = (e) => {
    const { x, y } = getWorldPos(e);
    const hit = nodes.find(n => {
      const p = posRef.current[n.id];
      if (!p) return false;
      const r = 8 + (n.access_count || 0) * 0.5;
      return Math.hypot(p.x - x, p.y - y) <= r * 1.5;
    });
    setSelected(hit || null);
  };

  const onWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    offsetRef.current.scale = Math.max(0.2, Math.min(3, offsetRef.current.scale * factor));
  };

  const onMouseDown = (e) => { isPanning.current = true; panStart.current = { x: e.clientX - offsetRef.current.x, y: e.clientY - offsetRef.current.y }; };
  const onMouseMove = (e) => { if (!isPanning.current) return; offsetRef.current.x = e.clientX - panStart.current.x; offsetRef.current.y = e.clientY - panStart.current.y; };
  const onMouseUp   = () => { isPanning.current = false; };

  const runDecay = async () => {
    setRunning(true);
    await runDecayCycle();
    await load();
    setRunning(false);
  };

  return (
    <div style={{ display:'flex', height:'100vh', background:'#07040f', color:'#fff', fontFamily:'Inter,sans-serif', overflow:'hidden' }}>
      {/* Sidebar */}
      <div style={{ width:260, flexShrink:0, borderRight:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column', background:'rgba(0,0,0,0.3)' }}>
        <div style={{ padding:'20px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#a78bfa', letterSpacing:'0.1em', textTransform:'uppercase' }}>Knowledge Graph</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:4 }}>{stats.total || 0} nodes</div>
        </div>

        {/* Stats */}
        <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          {[
            ['🔥 Hot',      stats.hot,      '#f97316'],
            ['🌡 Warm',     stats.warm,     '#fbbf24'],
            ['❄️ Cold',     stats.cold,     '#38bdf8'],
            ['📦 Archived', stats.archived, '#6b7280'],
          ].map(([label, count, color]) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:12 }}>
              <span style={{ color:'rgba(255,255,255,0.6)' }}>{label}</span>
              <span style={{ color, fontWeight:600 }}>{count || 0}</span>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:8, letterSpacing:'0.05em' }}>FILTER</div>
          <select
            value={filter.type}
            onChange={e => setFilter(f => ({...f, type: e.target.value}))}
            style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', borderRadius:8, padding:'6px 10px', fontSize:12, marginBottom:8 }}
          >
            <option value="all">All Types</option>
            {Object.keys(TYPE_COLORS).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>Min Edge Weight: {filter.minWeight}</div>
          <input type="range" min="0" max="1" step="0.05" value={filter.minWeight}
            onChange={e => setFilter(f => ({...f, minWeight: parseFloat(e.target.value)}))}
            style={{ width:'100%' }}
          />
        </div>

        {/* Legend */}
        <div style={{ padding:'12px 16px', flex:1, overflowY:'auto' }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:8, letterSpacing:'0.05em' }}>LEGEND</div>
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <div key={type} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, cursor:'pointer' }}
              onClick={() => setFilter(f => ({...f, type: f.type === type ? 'all' : type}))}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:color, flexShrink:0 }}/>
              <span style={{ fontSize:12, color:'rgba(255,255,255,0.6)', textTransform:'capitalize' }}>{type.replace('_',' ')}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={runDecay} disabled={running}
            style={{ width:'100%', padding:'8px 12px', background:'rgba(124,58,237,0.2)', border:'1px solid rgba(124,58,237,0.4)', color:'#a78bfa', borderRadius:8, cursor:'pointer', fontSize:12 }}>
            {running ? '⟳ Running Decay...' : '⚡ Run Decay Cycle'}
          </button>
          <button onClick={load}
            style={{ width:'100%', marginTop:8, padding:'8px 12px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.6)', borderRadius:8, cursor:'pointer', fontSize:12 }}>
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex:1, position:'relative' }}>
        <canvas ref={canvasRef} style={{ width:'100%', height:'100%', cursor:'grab', display:'block' }}
          onClick={onCanvasClick}
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />
        {nodes.length === 0 && (
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
            <div style={{ fontSize:48, opacity:0.15 }}>🧠</div>
            <div style={{ fontSize:14, color:'rgba(255,255,255,0.25)', marginTop:12 }}>No knowledge nodes yet</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.15)', marginTop:4 }}>Start chatting with ARIA to build the graph</div>
          </div>
        )}
      </div>

      {/* Selected node panel */}
      {selected && (
        <div style={{ width:280, flexShrink:0, borderLeft:'1px solid rgba(255,255,255,0.07)', background:'rgba(0,0,0,0.4)', padding:20, overflowY:'auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
            <span style={{ fontSize:12, fontWeight:700, color: TYPE_COLORS[selected.type] || '#a78bfa', textTransform:'uppercase', letterSpacing:'0.1em' }}>{selected.type}</span>
            <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:16 }}>✕</button>
          </div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,0.85)', lineHeight:1.6, marginBottom:12 }}>{selected.summary || selected.content?.slice(0,200) || '—'}</div>
          {[
            ['Tier', selected.tier],
            ['Decay', selected.decay_score?.toFixed(2)],
            ['Accessed', selected.access_count + 'x'],
            ['Source', selected.source],
            ['Tags', (selected.tags || []).join(', ') || '—'],
          ].map(([k, v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:11 }}>
              <span style={{ color:'rgba(255,255,255,0.4)' }}>{k}</span>
              <span style={{ color:'rgba(255,255,255,0.7)' }}>{v || '—'}</span>
            </div>
          ))}
          {selected.content && (
            <div style={{ marginTop:12, padding:'10px 12px', background:'rgba(255,255,255,0.03)', borderRadius:8, fontSize:12, color:'rgba(255,255,255,0.55)', lineHeight:1.6, maxHeight:200, overflowY:'auto' }}>
              {selected.content}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraph;
