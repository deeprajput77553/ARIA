import React, { useState, useEffect } from 'react';
import { getCurrentName } from '../storage/UserProfile.js';
import { msgBus, BUS_EVENTS } from '../storage/MessageBus.js';

// The 4-petal star from aria_logo.svg, scaled to fit navbar
const StarLogo = ({ size = 36 }) => (
  <svg
    viewBox="75 351 355 307"
    width={size}
    height={size}
    xmlns="http://www.w3.org/2000/svg"
    style={{ overflow: 'visible', flexShrink: 0 }}
  >
    <defs>
      <linearGradient id="nl-tl" x1="250" y1="351" x2="75" y2="505" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stopColor="#f0abfc"><animate attributeName="stopColor" dur="3.2s" repeatCount="indefinite" values="#f0abfc;#fde68a;#7dd3fc;#a5b4fc;#f9a8d4;#f0abfc"/></stop>
        <stop offset="60%"  stopColor="#38bdf8"><animate attributeName="stopColor" dur="3.2s" repeatCount="indefinite" values="#38bdf8;#c084fc;#f0abfc;#fde68a;#7dd3fc;#38bdf8"/></stop>
        <stop offset="100%" stopColor="#818cf8"><animate attributeName="stopColor" dur="3.2s" repeatCount="indefinite" values="#818cf8;#38bdf8;#fde68a;#f0abfc;#c084fc;#818cf8"/></stop>
      </linearGradient>
      <linearGradient id="nl-tr" x1="253" y1="351" x2="430" y2="505" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stopColor="#c084fc"><animate attributeName="stopColor" dur="4s" repeatCount="indefinite" values="#c084fc;#7dd3fc;#e0f2fe;#fde68a;#f9a8d4;#c084fc"/></stop>
        <stop offset="100%" stopColor="#a5b4fc"><animate attributeName="stopColor" dur="4s" repeatCount="indefinite" values="#a5b4fc;#f9a8d4;#c084fc;#7dd3fc;#e0f2fe;#a5b4fc"/></stop>
      </linearGradient>
      <linearGradient id="nl-bl" x1="75" y1="511" x2="250" y2="658" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stopColor="#67e8f9"><animate attributeName="stopColor" dur="3.7s" repeatCount="indefinite" values="#67e8f9;#a78bfa;#f9a8d4;#fde68a;#38bdf8;#67e8f9"/></stop>
        <stop offset="100%" stopColor="#fde68a"><animate attributeName="stopColor" dur="3.7s" repeatCount="indefinite" values="#fde68a;#38bdf8;#67e8f9;#a78bfa;#f9a8d4;#fde68a"/></stop>
      </linearGradient>
      <linearGradient id="nl-br" x1="345" y1="508" x2="429" y2="658" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stopColor="#fde68a"><animate attributeName="stopColor" dur="4.5s" repeatCount="indefinite" values="#fde68a;#38bdf8;#c084fc;#f9a8d4;#7dd3fc;#fde68a"/></stop>
        <stop offset="100%" stopColor="#f9a8d4"><animate attributeName="stopColor" dur="4.5s" repeatCount="indefinite" values="#f9a8d4;#fde68a;#38bdf8;#7dd3fc;#c084fc;#f9a8d4"/></stop>
      </linearGradient>
      <filter id="nl-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <g filter="url(#nl-glow)">
      {/* Top-Left petal */}
      <path fill="url(#nl-tl)" fillRule="evenodd" d="M 244.667 351.667 C 244.300 352.033, 244 353.391, 244 354.683 C 244 359.122, 239.128 381.512, 236.206 390.502 C 233.214 399.710, 226.851 414.526, 223.969 419 C 209.921 440.806, 202.100 449.822, 187.913 460.566 C 179.227 467.144, 165.004 475.254, 153.472 480.205 C 145.773 483.510, 123.582 490.255, 116.500 491.443 C 114.850 491.720, 108.550 492.843, 102.500 493.940 C 96.450 495.036, 87.900 496.286, 83.500 496.717 L 75.500 497.500 75.500 501 L 75.500 504.500 120.500 504.459 C 159.281 504.424, 166.329 504.189, 171.500 502.757 C 174.800 501.844, 179.075 500.831, 181 500.507 C 189.456 499.085, 202.096 493.865, 211.570 487.882 C 219.363 482.960, 231.348 470.434, 236.250 462.086 C 238.313 458.574, 240 455.332, 240 454.881 C 240 454.430, 240.879 452.360, 241.953 450.281 C 243.027 448.201, 245.103 442, 246.565 436.500 C 249.161 426.734, 249.236 425.618, 249.742 388.750 L 250.260 351 247.797 351 C 246.442 351, 245.033 351.300, 244.667 351.667"/>
      {/* Top-Right petal */}
      <path fill="url(#nl-tr)" fillRule="evenodd" d="M 253.379 352.455 C 253.042 353.333, 252.995 370.352, 253.274 390.275 C 253.766 425.357, 253.864 426.809, 256.399 436.308 C 262.374 458.705, 273.856 475.795, 290.133 486.518 C 300.264 493.193, 318.224 500.967, 323.671 501.036 C 325.227 501.055, 329.200 501.779, 332.500 502.644 C 337.370 503.920, 347.034 504.312, 383.817 504.722 L 429.134 505.227 428.817 501.363 L 428.500 497.500 420.500 496.718 C 416.100 496.288, 407.615 495.023, 401.645 493.909 C 395.675 492.794, 389.178 491.675, 387.207 491.423 C 385.236 491.171, 380.736 490.072, 377.206 488.982 C 373.677 487.892, 369.993 487, 369.019 487 C 368.045 487, 364.705 485.875, 361.596 484.500 C 358.487 483.125, 355.240 482, 354.382 482 C 352.687 482, 322.875 467.365, 322.021 466.114 C 301.761 452.049, 286.266 433.410, 276.978 415.029 C 266.561 394.416, 264.616 388.316, 260.226 362.500 C 258.551 352.650, 258.127 351.467, 256.173 351.180 C 254.874 350.989, 253.743 351.505, 253.379 352.455"/>
      {/* Bottom-Left petal */}
      <path fill="url(#nl-bl)" fillRule="evenodd" d="M 75.182 511.096 C 75.483 514.144, 75.747 514.340, 80 514.666 C 99.209 516.137, 128.324 522.596, 149.831 530.158 C 179.452 540.573, 207.234 563.449, 222.127 589.686 C 233.715 610.101, 238.732 624.807, 243.387 652 C 244.410 657.975, 244.702 658.499, 247 658.489 L 249.500 658.477 249.792 634.489 C 250.199 601.093, 248.901 583.893, 245.154 573 C 239.505 556.577, 236.884 551.483, 229.205 542 C 215.609 525.211, 192.553 512.522, 169.998 509.416 C 167.524 509.075, 145.107 508.588, 120.182 508.334 L 74.864 507.871 75.182 511.096"/>
      {/* Bottom-Right petal */}
      <path fill="url(#nl-br)" fillRule="evenodd" d="M 344.917 508.383 C 344.688 508.593, 341.125 509.009, 337 509.306 C 324.886 510.178, 308.311 515.835, 294.570 523.786 C 287.048 528.140, 271.094 543.989, 267.590 550.588 C 266.156 553.290, 264.564 556.175, 264.052 557 C 262.291 559.841, 258 569.879, 257.987 571.188 C 257.980 571.910, 257.062 575.409, 255.948 578.965 C 254.128 584.770, 253.858 589.135, 253.300 621.715 L 252.678 658 254.839 658 C 256.028 658, 257.337 658.027, 257.750 658.061 C 258.163 658.094, 258.797 656.632, 259.160 654.811 C 259.522 652.990, 260.564 647.675, 261.474 643 C 268.594 606.441, 284.333 578.336, 310.610 555.257 C 319.278 547.644, 326.459 542.803, 336.749 537.637 C 348.572 531.700, 366.829 525.072, 375.500 523.569 C 377.150 523.283, 382.100 522.156, 386.500 521.065 C 393.780 519.260, 416.388 515.481, 425 514.629 C 428.102 514.323, 428.536 513.926, 428.813 511.142 L 429.127 508 387.230 508 C 364.187 508, 345.146 508.172, 344.917 508.383"/>
    </g>
  </svg>
);

const Navbar = ({ currentPage, onNavigate }) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [userName, setUserName] = useState('User');
  const [agentBusy, setAgentBusy] = useState(false);

  useEffect(() => {
    getCurrentName().then(setUserName);
    const unsub = msgBus.on(BUS_EVENTS.AGENT_STATUS, (p) => {
      setAgentBusy(p.status === 'busy');
    });
    return unsub;
  }, []);

  const nav = (page) => {
    onNavigate(page);
    setIsCollapsed(true);
  };

  return (
    <nav className={`navbar ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      <div className="navbar-top">
        <div className="navbar-logo" onClick={() => nav('orb')}>
          <div className="star-container">
            <StarLogo size={34} />
            {agentBusy && <div className="logo-pulse" />}
          </div>
          <span className="navbar-title" style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '0.05em' }}>ARIA</span>
        </div>
        
        <button className="nav-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
          <div className={`hamburger ${!isCollapsed ? 'open' : ''}`}>
            <span></span><span></span><span></span>
          </div>
        </button>
      </div>

      <div className="navbar-nav">
        <button className={`nav-btn ${currentPage === 'orb'  ? 'active' : ''}`} onClick={() => nav('orb')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
            <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3"/>
          </svg>
          <span>Orb</span>
        </button>
        <button className={`nav-btn ${currentPage === 'chat' ? 'active' : ''}`} onClick={() => nav('chat')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Chats</span>
        </button>
        <button className={`nav-btn ${currentPage === 'logs' ? 'active' : ''}`} onClick={() => nav('logs')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round"/>
          </svg>
          <span>Logs</span>
        </button>
        <button className={`nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`} onClick={() => nav('dashboard')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
            <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round"/>
            <path d="M7 12h10M7 8h6M7 16h4" strokeLinecap="round"/>
          </svg>
          <span>Dashboard</span>
        </button>
        <button className={`nav-btn ${currentPage === 'websearch' ? 'active' : ''}`} onClick={() => nav('websearch')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3" strokeLinecap="round"/>
          </svg>
          <span>Search</span>
        </button>
        <button className={`nav-btn ${currentPage === 'settings' ? 'active' : ''}`} onClick={() => nav('settings')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round"/>
          </svg>
          <span>Settings</span>
        </button>
      </div>

      <div className="navbar-user-section">
        <div className="navbar-user" onClick={() => setUserMenuOpen(o => !o)}>
          <div className="user-avatar">
            <svg viewBox="0 0 32 32" width="32" height="32">
              <defs>
                <linearGradient id="av-g" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#2563eb"/>
                </linearGradient>
              </defs>
              <circle cx="16" cy="16" r="16" fill="url(#av-g)"/>
              <circle cx="16" cy="12" r="5" fill="rgba(255,255,255,0.9)"/>
              <path d="M6 28c0-5.523 4.477-10 10-10s10 4.477 10 10" fill="rgba(255,255,255,0.85)"/>
            </svg>
          </div>
          <div className={`user-status-dot ${agentBusy ? 'busy' : 'online'}`}/>
          <span className="user-name-small">{userName}</span>
          {userMenuOpen && (
            <div className="user-dropdown">
              <div className="user-info">
                <span className="user-name">{userName}</span>
                <span className="user-role">System Operator</span>
              </div>
              <div className="dropdown-divider"/>
              <button className="dropdown-item" onClick={() => nav('settings')}>Settings</button>
              <button className="dropdown-item" onClick={() => nav('signin')}>Sign out</button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .star-container { position: relative; display: flex; align-items: center; justify-content: center; }
        .logo-pulse {
          position: absolute; width: 40px; height: 40px;
          border: 2px solid #a855f7; border-radius: 50%;
          animation: logo-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes logo-ping {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .user-status-dot.busy { background: #a855f7; box-shadow: 0 0 8px #a855f7; }
        .user-status-dot.online { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
      `}</style>
    </nav>
  );
};

export default Navbar;
