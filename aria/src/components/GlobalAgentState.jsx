import React, { useEffect, useState } from 'react';
import { msgBus, BUS_EVENTS } from '../storage/MessageBus.js';

const GlobalAgentState = () => {
  const [state, setState] = useState({ status: 'idle', action: '' });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const unsub = msgBus.on(BUS_EVENTS.AGENT_STATUS, (payload) => {
      setState(payload);
      if (payload.status !== 'idle') {
        setVisible(true);
      } else {
        // Delay hiding to let user see "Finished" state
        setTimeout(() => {
          setState(s => s.status === 'idle' ? { ...s, action: 'Complete' } : s);
          setTimeout(() => setVisible(false), 2000);
        }, 1000);
      }
    });

    return unsub;
  }, []);

  if (!visible) return null;

  return (
    <div className={`gas-container ${state.status}`}>
      <div className="gas-glow" />
      <div className="gas-content">
        <div className="gas-spinner">
          <div className="gas-dot" />
          <div className="gas-ring" />
        </div>
        <div className="gas-text">
          <div className="gas-title">ARIA Core</div>
          <div className="gas-action">{state.action || 'Thinking...'}</div>
        </div>
      </div>

      <style>{`
        .gas-container {
          position: fixed; bottom: 24px; right: 24px; z-index: 9999;
          background: rgba(15, 10, 30, 0.85);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(168, 85, 247, 0.3);
          border-radius: 16px;
          padding: 12px 20px;
          display: flex; align-items: center; gap: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 20px rgba(168, 85, 247, 0.1);
          animation: gas-slide-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
          max-width: 300px;
        }
        @keyframes gas-slide-in {
          from { opacity: 0; transform: translateY(20px) scale(0.9); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .gas-container.error { border-color: #ef4444; }
        .gas-container.error .gas-ring { border-color: #ef4444; }
        .gas-container.error .gas-dot { background: #ef4444; box-shadow: 0 0 10px #ef4444; }

        .gas-glow {
          position: absolute; inset: -1px; border-radius: 16px;
          background: linear-gradient(45deg, #a855f7, #3b82f6, #ec4899);
          opacity: 0.15; z-index: -1;
          filter: blur(8px);
        }

        .gas-spinner { position: relative; width: 32px; height: 32px; flex-shrink: 0; }
        .gas-dot {
          position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
          width: 8px; height: 8px; background: #a855f7; border-radius: 50%;
          box-shadow: 0 0 10px #a855f7;
          animation: gas-ping 1.5s ease-in-out infinite;
        }
        @keyframes gas-ping {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; }
          50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; }
        }

        .gas-ring {
          position: absolute; inset: 0; border: 2px solid rgba(168, 85, 247, 0.2);
          border-top-color: #a855f7; border-radius: 50%;
          animation: gas-spin 1s linear infinite;
        }
        @keyframes gas-spin { to { transform: rotate(360deg); } }

        .gas-text { display: flex; flex-direction: column; gap: 2px; }
        .gas-title { font-size: 11px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.1em; }
        .gas-action { font-size: 13px; font-weight: 500; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      `}</style>
    </div>
  );
};

export default GlobalAgentState;
