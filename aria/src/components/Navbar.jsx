import React, { useState } from 'react';

const Navbar = ({ currentPage, onNavigate }) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="navbar-logo" onClick={() => onNavigate('orb')}>
        <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="nav-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a78bfa"/>
              <stop offset="50%" stopColor="#38bdf8"/>
              <stop offset="100%" stopColor="#f0abfc"/>
            </linearGradient>
            <filter id="nav-glow">
              <feGaussianBlur stdDeviation="1.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <circle cx="20" cy="20" r="18" fill="none" stroke="url(#nav-grad)" strokeWidth="1.5" opacity="0.6"/>
          <circle cx="20" cy="20" r="12" fill="none" stroke="url(#nav-grad)" strokeWidth="1" opacity="0.4"/>
          <circle cx="20" cy="20" r="4" fill="url(#nav-grad)" filter="url(#nav-glow)"/>
          {[0, 60, 120, 180, 240, 300].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            const x = 20 + Math.cos(rad) * 12;
            const y = 20 + Math.sin(rad) * 12;
            return <circle key={i} cx={x} cy={y} r="2" fill="url(#nav-grad)" opacity={0.6 + i * 0.05}/>;
          })}
        </svg>
        <span className="navbar-title">ARIA</span>
      </div>

      <div className="navbar-nav">
        <button 
          className={`nav-btn ${currentPage === 'orb' ? 'active' : ''}`}
          onClick={() => onNavigate('orb')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
            <circle cx="12" cy="12" r="9"/>
            <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.4"/>
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2" strokeLinecap="round"/>
          </svg>
          <span>Orb</span>
        </button>
        <button 
          className={`nav-btn ${currentPage === 'chat' ? 'active' : ''}`}
          onClick={() => onNavigate('chat')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinejoin="round"/>
          </svg>
          <span>Chat</span>
        </button>
      </div>

      <div className="navbar-user" onClick={() => setUserMenuOpen(!userMenuOpen)}>
        <div className="user-avatar">
          <svg viewBox="0 0 32 32" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="avatar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7c3aed"/>
                <stop offset="100%" stopColor="#2563eb"/>
              </linearGradient>
            </defs>
            <circle cx="16" cy="16" r="16" fill="url(#avatar-grad)"/>
            <circle cx="16" cy="12" r="5" fill="rgba(255,255,255,0.85)"/>
            <path d="M6 28c0-5.523 4.477-10 10-10s10 4.477 10 10" fill="rgba(255,255,255,0.85)"/>
          </svg>
        </div>
        <div className="user-status-dot"></div>
        
        {userMenuOpen && (
          <div className="user-dropdown">
            <div className="user-info">
              <span className="user-name">Ajinkya</span>
              <span className="user-role">Admin</span>
            </div>
            <div className="dropdown-divider"/>
            <button className="dropdown-item">Settings</button>
            <button className="dropdown-item danger">Sign out</button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
