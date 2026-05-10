/**
 * ARIA Cognitive Dashboard
 * 
 * Provides a high-level view of the system's memory, audit logs, and performance.
 * See FEATURES.md F-11 for the specification.
 */

import React, { useEffect, useState } from 'react';
import { DB } from '../storage/Database.js';
import { loadProfile, getCurrentName } from '../storage/UserProfile.js';
import { msgBus, BUS_EVENTS } from '../storage/MessageBus.js';
import { useOllama } from '../hooks/useOllama';
import { FiActivity, FiShield, FiDatabase, FiCpu, FiEdit2, FiTrash2, FiRefreshCw } from 'react-icons/fi';
import WorkspaceExplorer from './WorkspaceExplorer.jsx';

const Dashboard = () => {
  const [stats, setStats] = useState({ nodes: 0, audit: [], messages: 0, profile: null });
  const [userName, setUserName] = useState('User');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isAvailable, model } = useOllama();

  const load = async () => {
    setIsRefreshing(true);
    const nodes = await DB.getNodes();
    const audit = await DB.getAuditLog();
    const msgs = await DB.getMessages();
    const profile = await DB.getProfile();
    const name = await getCurrentName();
    setUserName(name);
    setStats({
      nodes: nodes.length,
      audit: audit.sort((a, b) => b.timestamp - a.timestamp).slice(0, 15),
      messages: msgs.length,
      profile
    });
    setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => {
    load();
    const unsubProfile = msgBus.on(BUS_EVENTS.PROFILE_UPDATED, load);
    const unsubMsg = msgBus.on(BUS_EVENTS.NEW_MESSAGE, load);
    return () => { unsubProfile(); unsubMsg(); };
  }, []);

  const handleDeleteKey = async (key) => {
    if (confirm(`Are you sure you want to delete "${key}"?`)) {
      await DB.deleteProfileKey(key);
      await DB.logAudit({
        event_type: 'profile_deleted',
        initiated_by: 'user',
        action_description: `Deleted profile key: ${key}`,
        outcome: 'success'
      });
      load();
    }
  };

  const handleEditKey = async (key, currentVal) => {
    const newVal = prompt(`Edit value for "${key}":`, typeof currentVal === 'object' ? JSON.stringify(currentVal) : currentVal);
    if (newVal !== null) {
      let parsed = newVal;
      try { if (newVal.startsWith('{') || newVal.startsWith('[')) parsed = JSON.parse(newVal); } catch(e) {}
      await DB.saveProfile({ [key]: parsed });
      await DB.logAudit({
        event_type: 'profile_updated',
        initiated_by: 'user',
        action_description: `Updated profile key: ${key}`,
        outcome: 'success'
      });
      load();
    }
  };

  return (
    <div className="dashboard-page premium-scroll">
      <header className="dashboard-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Cognitive Dashboard</h1>
            <p>Real-time system integrity and memory metrics for {userName}.</p>
          </div>
          <button className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`} onClick={load}>
            <FiRefreshCw />
          </button>
        </div>
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
          <div className="stat-val">{stats.profile ? 'Synced' : 'Empty'}</div>
          <div className="stat-label">Neural Profile</div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="dashboard-column">
          <section className="audit-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
              <h3>System Audit Trail</h3>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>Last 15 events</span>
            </div>
            <div className="audit-list">
              {stats.audit.length > 0 ? stats.audit.map(a => (
                <div key={a.id} className="audit-item">
                  <span className="audit-time">{new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  <span className={`audit-type ${a.event_type}`}>{a.event_type.replace('_', ' ')}</span>
                  <span className="audit-desc">{a.action_description}</span>
                </div>
              )) : (
                <div className="audit-item empty">No audit logs found. Try interacting with ARIA.</div>
              )}
            </div>
          </section>
          
          <section className="profile-section" style={{ marginTop: '30px' }}>
            <h3>Personal Data Store</h3>
            <div className="profile-card">
              <div className="profile-main-data">
                <h3 className="profile-name">{userName}</h3>
                <p className="profile-role">System Operator</p>
              </div>
              {stats.profile ? (
                <div className="profile-details">
                  {Object.entries(stats.profile).filter(([k]) => k !== 'id' && k !== 'updatedAt').map(([k, v]) => (
                    <div key={k} className="profile-row">
                      <div className="profile-info">
                        <span className="profile-key">{k}</span>
                        <span className="profile-val">{typeof v === 'string' ? v : JSON.stringify(v)}</span>
                      </div>
                      <div className="profile-actions">
                        <button onClick={() => handleEditKey(k, v)} title="Edit Entry"><FiEdit2 /></button>
                        <button onClick={() => handleDeleteKey(k)} title="Delete Entry" className="delete-btn"><FiTrash2 /></button>
                      </div>
                    </div>
                  ))}
                  {Object.keys(stats.profile).length <= 1 && (
                    <p className="empty-hint">No specific traits recorded yet. Tell ARIA more about yourself!</p>
                  )}
                </div>
              ) : (
                <p className="empty-hint">Neural memory is currently empty. Say something like "my birthday is..." to begin.</p>
              )}
            </div>
          </section>
        </div>

        <div className="dashboard-column">
          <WorkspaceExplorer />
        </div>
      </div>

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

        .dashboard-content { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .profile-section h3 { font-size: 16px; color: white; margin-bottom: 16px; }
        .profile-card { background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); padding: 16px; min-height: 100px; }
        .profile-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.03); }
        .profile-info { display: flex; flex-direction: column; gap: 4px; }
        .profile-key { font-size: 11px; color: #a78bfa; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .profile-val { font-size: 14px; color: white; font-weight: 500; }
        
        .profile-actions { display: flex; gap: 8px; }
        .profile-actions button { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .profile-actions button:hover { background: rgba(167,139,250,0.15); border-color: #a78bfa; color: #a78bfa; transform: translateY(-2px); }
        .profile-actions button.delete-btn:hover { background: rgba(239,68,68,0.15); border-color: #ef4444; color: #ef4444; }

        .refresh-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 10px; border-radius: 12px; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; gap: 8px; }
        .refresh-btn:hover { background: rgba(255,255,255,0.1); transform: scale(1.05); }
        .refresh-btn.spinning svg { animation: spin 0.8s linear infinite; }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .empty-hint { font-size: 12px; color: rgba(255,255,255,0.25); font-style: italic; text-align: center; margin-top: 20px; }

        @media (max-width: 1100px) {
          .dashboard-content { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
