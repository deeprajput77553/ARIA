import React, { useEffect, useState, useCallback } from 'react';
import { DB } from '../storage/Database.js';

const EVENT_ICONS = {
  message_processed:    '💬',
  proactive_initiation: '🌙',
  node_created:         '🧠',
  edge_created:         '🔗',
  node_archived:        '📦',
  node_merged:          '🔀',
  decay_cycle_run:      '⏳',
  system_startup:       '🚀',
  tool_execution:       '⚙️',
  user_override:        '👤',
};

const EVENT_COLORS = {
  message_processed:    '#38bdf8',
  proactive_initiation: '#a78bfa',
  node_created:         '#34d399',
  edge_created:         '#60a5fa',
  node_archived:        '#6b7280',
  node_merged:          '#f472b6',
  decay_cycle_run:      '#fbbf24',
  system_startup:       '#4ade80',
  tool_execution:       '#fb923c',
  user_override:        '#e879f9',
};

const AuditLog = () => {
  const [logs,    setLogs]    = useState([]);
  const [filter,  setFilter]  = useState('all');
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await DB.getAuditLog().catch(() => []);
    setLogs((data || []).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = logs.filter(log => {
    if (filter !== 'all' && log.event_type !== filter) return false;
    if (search && !JSON.stringify(log).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const eventTypes = [...new Set(logs.map(l => l.event_type))];

  const formatTime = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('en-IN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' });
  };

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:'#07040f', color:'#fff', fontFamily:'Inter,sans-serif' }}>
      {/* Header */}
      <div style={{ padding:'20px 28px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(0,0,0,0.3)', backdropFilter:'blur(20px)', flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'#fff', letterSpacing:'0.04em' }}>🔒 Audit Log</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>Full transparency — every action ARIA has ever taken</div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>{filtered.length} / {logs.length} entries</span>
            <button onClick={load} style={{ padding:'6px 12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.6)', borderRadius:8, cursor:'pointer', fontSize:12 }}>
              ↺ Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:10, marginTop:14, alignItems:'center', flexWrap:'wrap' }}>
          <input
            placeholder="Search logs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex:1, minWidth:200, padding:'7px 12px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#fff', fontSize:12, outline:'none' }}
          />
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ padding:'7px 12px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', borderRadius:8, fontSize:12 }}
          >
            <option value="all">All Events</option>
            {eventTypes.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
          </select>
        </div>
      </div>

      {/* Log entries */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 28px' }}>
        {loading && (
          <div style={{ textAlign:'center', padding:40, color:'rgba(255,255,255,0.25)', fontSize:13 }}>Loading audit log...</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:60 }}>
            <div style={{ fontSize:48, opacity:0.15 }}>🔒</div>
            <div style={{ fontSize:14, color:'rgba(255,255,255,0.25)', marginTop:12 }}>No audit log entries yet</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.15)', marginTop:4 }}>ARIA will log every action here automatically</div>
          </div>
        )}
        {filtered.map((log, idx) => {
          const icon  = EVENT_ICONS[log.event_type] || '📋';
          const color = EVENT_COLORS[log.event_type] || '#a78bfa';
          return (
            <div key={log.id || idx} style={{
              display:'flex', gap:14, padding:'14px 16px', marginBottom:8,
              background:'rgba(255,255,255,0.03)', borderRadius:12,
              border:`1px solid rgba(255,255,255,0.05)`,
              borderLeft:`3px solid ${color}40`,
              transition:'all 0.2s',
            }}>
              {/* Icon */}
              <div style={{ fontSize:20, flexShrink:0, width:32, textAlign:'center', paddingTop:2 }}>{icon}</div>

              {/* Content */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                  <span style={{ fontSize:11, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.08em' }}>
                    {log.event_type?.replace(/_/g,' ') || 'unknown'}
                  </span>
                  <span style={{ fontSize:10, color:'rgba(255,255,255,0.25)', flexShrink:0, marginLeft:12 }}>
                    {formatTime(log.timestamp)}
                  </span>
                </div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.75)', lineHeight:1.5 }}>
                  {log.action_description || '—'}
                </div>
                <div style={{ display:'flex', gap:12, marginTop:6, flexWrap:'wrap' }}>
                  {log.initiated_by && (
                    <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)', padding:'2px 6px', background:'rgba(255,255,255,0.04)', borderRadius:4 }}>
                      by {log.initiated_by}
                    </span>
                  )}
                  {log.outcome && (
                    <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4,
                      background: log.outcome === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      color:      log.outcome === 'success' ? '#4ade80' : '#f87171',
                    }}>
                      {log.outcome}
                    </span>
                  )}
                  {log.nodes_affected?.length > 0 && (
                    <span style={{ fontSize:10, color:'rgba(255,255,255,0.25)' }}>
                      {log.nodes_affected.length} node{log.nodes_affected.length > 1 ? 's' : ''} affected
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AuditLog;
