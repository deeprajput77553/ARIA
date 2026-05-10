/**
 * ARIA Cognitive Dashboard
 * 
 * Provides a high-level view of the system's memory, audit logs, and performance.
 * See FEATURES.md F-11 for the specification.
 */

import React, { useEffect, useState } from 'react';
import { DB } from '../storage/Database.js';
import { useOllama } from './Orb.jsx';
import { FiActivity, FiShield, FiDatabase, FiCpu } from 'react-icons/fi';

const Dashboard = () => {
  const [stats, setStats] = useState({ nodes: 0, audit: [], messages: 0 });
  const { isAvailable, model } = useOllama();

  useEffect(() => {
    const load = async () => {
      const nodes = await DB.getNodes();
      const audit = await DB.getAuditLog();
      const msgs = await DB.getMessages();
      setStats({
        nodes: nodes.length,
        audit: audit.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10),
        messages: msgs.length
      });
    };
    load();
  }, []);

  return (
    <div className="dashboard-page premium-scroll">
      <header className="dashboard-header">
        <h1>Cognitive Dashboard</h1>
        <p>Real-time system integrity and memory metrics.</p>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <FiDatabase className="stat-icon" />
          <div className="stat-val">{stats.nodes}</div>
          <div className="stat-label">Knowledge Nodes</div>
        </div>
        <div className="stat-card">
          <FiActivity className="stat-icon" />
          <div className="stat-val">{stats.messages}</div>
          <div className="stat-label">Total Interactions</div>
        </div>
        <div className="stat-card">
          <FiCpu className="stat-icon" style={{ color: isAvailable ? '#22c55e' : '#ef4444' }} />
          <div className="stat-val">{isAvailable ? 'Online' : 'Offline'}</div>
          <div className="stat-label">Core Intelligence ({model})</div>
        </div>
        <div className="stat-card">
          <FiShield className="stat-icon" style={{ color: '#38bdf8' }} />
          <div className="stat-val">Active</div>
          <div className="stat-label">Sandbox Safety</div>
        </div>
      </div>

      <section className="audit-section">
        <h3>System Audit Trail</h3>
        <div className="audit-list">
          {stats.audit.map(a => (
            <div key={a.id} className="audit-item">
              <span className="audit-time">{new Date(a.timestamp).toLocaleTimeString()}</span>
              <span className={`audit-type ${a.event_type}`}>{a.event_type}</span>
              <span className="audit-desc">{a.action_description}</span>
            </div>
          ))}
        </div>
      </section>

      <style>{`
        .dashboard-page { padding: 40px; height: 100%; overflow-y: auto; }
        .dashboard-header { margin-bottom: 32px; }
        .dashboard-header h1 { font-size: 28px; color: white; margin-bottom: 8px; }
        .dashboard-header p { color: rgba(255,255,255,0.4); }

        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .stat-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 24px; border-radius: 16px; text-align: center; }
        .stat-icon { font-size: 24px; color: #a78bfa; margin-bottom: 12px; }
        .stat-val { font-size: 24px; font-weight: 700; color: white; margin-bottom: 4px; }
        .stat-label { font-size: 12px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.05em; }

        .audit-section h3 { font-size: 16px; color: white; margin-bottom: 16px; }
        .audit-list { background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); }
        .audit-item { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); display: flex; align-items: center; gap: 16px; font-size: 13px; }
        .audit-time { color: rgba(255,255,255,0.3); min-width: 80px; }
        .audit-type { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; background: rgba(167,139,250,0.1); color: #a78bfa; }
        .audit-desc { color: rgba(255,255,255,0.7); }
      `}</style>
    </div>
  );
};

export default Dashboard;
