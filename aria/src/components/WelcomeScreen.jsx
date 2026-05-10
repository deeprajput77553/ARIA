import React, { useEffect, useState, useRef } from 'react';

const WelcomeScreen = ({ onComplete }) => {
  const [phase, setPhase] = useState('enter'); // enter → hold → exit
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      const x = (clientX / window.innerWidth - 0.5) * 20;
      const y = (clientY / window.innerHeight - 0.5) * 20;
      setMousePos({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);

    const t1 = setTimeout(() => setPhase('exit'), 4000);
    const t2 = setTimeout(onComplete, 5200);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  return (
    <div className={`ws-root ${phase}`} ref={containerRef}>
      {/* Dynamic Cosmic Background with Parallax */}
      <div className="ws-bg-glow ws-glow-1" style={{ transform: `translate(${mousePos.x * -1.5}px, ${mousePos.y * -1.5}px)` }} />
      <div className="ws-bg-glow ws-glow-2" style={{ transform: `translate(${mousePos.x * 1.2}px, ${mousePos.y * 1.2}px)` }} />
      <div className="ws-bg-glow ws-glow-3" style={{ transform: `translate(${mousePos.x * 0.8}px, ${mousePos.y * -0.8}px)` }} />
      
      {/* Ambient background rings */}
      <div className="ws-ring ws-ring-1" style={{ transform: `translate(${mousePos.x * 0.3}px, ${mousePos.y * 0.3}px) rotate(0deg)` }}/>
      <div className="ws-ring ws-ring-2" style={{ transform: `translate(${mousePos.x * -0.2}px, ${mousePos.y * -0.2}px) rotate(0deg)` }}/>
      
      {/* Floating Energy Orbs */}
      <div className="ws-energy-orb orb-1" />
      <div className="ws-energy-orb orb-2" />
      <div className="ws-energy-orb orb-3" />

      <div className="ws-particles">
        {Array.from({length: 40}).map((_,i) => (
          <div key={i} className="ws-particle" style={{
            '--i': i,
            '--x': `${Math.random()*100}%`,
            '--y': `${Math.random()*100}%`,
            '--d': `${4 + Math.random()*6}s`,
            '--s': `${1 + Math.random()*2}px`,
            '--c': i % 3 === 0 ? '#c084fc' : i % 3 === 1 ? '#38bdf8' : '#f472b6'
          }}/>
        ))}
      </div>

      {/* Logo Container */}
      <div className="ws-logo-wrap" style={{ transform: `translate(${mousePos.x * 0.5}px, ${mousePos.y * 0.5}px)` }}>
        <div className="ws-svg-container">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1024 1024"
            className="ws-svg"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#d946ef"><animate attributeName="stopColor" dur="3s" repeatCount="indefinite" values="#d946ef;#3b82f6;#ec4899;#f59e0b;#d946ef"/></stop>
                <stop offset="50%"  stopColor="#3b82f6"><animate attributeName="stopColor" dur="3s" repeatCount="indefinite" values="#3b82f6;#ec4899;#f59e0b;#d946ef;#3b82f6"/></stop>
                <stop offset="100%" stopColor="#f59e0b"><animate attributeName="stopColor" dur="3s" repeatCount="indefinite" values="#f59e0b;#d946ef;#3b82f6;#ec4899;#f59e0b"/></stop>
              </linearGradient>
              <linearGradient id="g2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="#f472b6"><animate attributeName="stopColor" dur="4s" repeatCount="indefinite" values="#f472b6;#8b5cf6;#0ea5e9;#f472b6"/></stop>
                <stop offset="100%" stopColor="#6366f1"><animate attributeName="stopColor" dur="4s" repeatCount="indefinite" values="#6366f1;#0ea5e9;#f472b6;#6366f1"/></stop>
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="12" result="blur"/>
                <feComposite in="SourceGraphic" in2="blur" operator="over"/>
              </filter>
              <filter id="heavy-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="25" result="blur"/>
                <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="glow"/>
                <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* Ripple Waves */}
            <g transform="translate(252 505)" filter="url(#heavy-glow)">
              <circle r="10" fill="none" strokeWidth="2">
                <animate attributeName="r"            values="10;450"      dur="5s" begin="0s" repeatCount="indefinite" calcMode="spline" keySplines="0.1 0 0.2 1"/>
                <animate attributeName="opacity"      values="0.6;0"       dur="5s" begin="0s" repeatCount="indefinite" calcMode="spline" keySplines="0.1 0 0.2 1"/>
                <animate attributeName="stroke"       values="#d946ef;#3b82f6;#d946ef" dur="5s" repeatCount="indefinite"/>
              </circle>
              <circle r="10" fill="none" strokeWidth="2">
                <animate attributeName="r"            values="10;450"      dur="5s" begin="2.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.1 0 0.2 1"/>
                <animate attributeName="opacity"      values="0.6;0"       dur="5s" begin="2.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.1 0 0.2 1"/>
                <animate attributeName="stroke"       values="#3b82f6;#f59e0b;#3b82f6" dur="5s" repeatCount="indefinite"/>
              </circle>
            </g>

            {/* Central Paths */}
            <g filter="url(#glow)">
              <path fill="url(#g1)" fillRule="evenodd" d="M 244.667 351.667 C 244.300 352.033, 244 353.391, 244 354.683 C 244 359.122, 239.128 381.512, 236.206 390.502 C 233.214 399.710, 226.851 414.526, 223.969 419 C 209.921 440.806, 202.100 449.822, 187.913 460.566 C 179.227 467.144, 165.004 475.254, 153.472 480.205 C 145.773 483.510, 123.582 490.255, 116.500 491.443 C 114.850 491.720, 108.550 492.843, 102.500 493.940 C 96.450 495.036, 87.900 496.286, 83.500 496.717 L 75.500 497.500 75.500 501 L 75.500 504.500 120.500 504.459 C 159.281 504.424, 166.329 504.189, 171.500 502.757 C 174.800 501.844, 179.075 500.831, 181 500.507 C 189.456 499.085, 202.096 493.865, 211.570 487.882 C 219.363 482.960, 231.348 470.434, 236.250 462.086 C 238.313 458.574, 240 455.332, 240 454.881 C 240 454.430, 240.879 452.360, 241.953 450.281 C 243.027 448.201, 245.103 442, 246.565 436.500 C 249.161 426.734, 249.236 425.618, 249.742 388.750 L 250.260 351 247.797 351 C 246.442 351, 245.033 351.300, 244.667 351.667"/>
              <path fill="url(#g2)" fillRule="evenodd" d="M 253.379 352.455 C 253.042 353.333, 252.995 370.352, 253.274 390.275 C 253.766 425.357, 253.864 426.809, 256.399 436.308 C 262.374 458.705, 273.856 475.795, 290.133 486.518 C 300.264 493.193, 318.224 500.967, 323.671 501.036 C 325.227 501.055, 329.200 501.779, 332.500 502.644 C 337.370 503.920, 347.034 504.312, 383.817 504.722 L 429.134 505.227 428.817 501.363 L 428.500 497.500 420.500 496.718 C 416.100 496.288, 407.615 495.023, 401.645 493.909 C 395.675 492.794, 389.178 491.675, 387.207 491.423 C 385.236 491.171, 380.736 490.072, 377.206 488.982 C 373.677 487.892, 369.993 487, 369.019 487 C 368.045 487, 364.705 485.875, 361.596 484.500 C 358.487 483.125, 355.240 482, 354.382 482 C 352.687 482, 322.875 467.365, 322.021 466.114 C 301.761 452.049, 286.266 433.410, 276.978 415.029 C 266.561 394.416, 264.616 388.316, 260.226 362.500 C 258.551 352.650, 258.127 351.467, 256.173 351.180 C 254.874 350.989, 253.743 351.505, 253.379 352.455"/>
              <path fill="url(#g1)" fillRule="evenodd" d="M 75.182 511.096 C 75.483 514.144, 75.747 514.340, 80 514.666 C 99.209 516.137, 128.324 522.596, 149.831 530.158 C 179.452 540.573, 207.234 563.449, 222.127 589.686 C 233.715 610.101, 238.732 624.807, 243.387 652 C 244.410 657.975, 244.702 658.499, 247 658.489 L 249.500 658.477 249.792 634.489 C 250.199 601.093, 248.901 583.893, 245.154 573 C 239.505 556.577, 236.884 551.483, 229.205 542 C 215.609 525.211, 192.553 512.522, 169.998 509.416 C 167.524 509.075, 145.107 508.588, 120.182 508.334 L 74.864 507.871 75.182 511.096"/>
              <path fill="url(#g2)" fillRule="evenodd" d="M 344.917 508.383 C 344.688 508.593, 341.125 509.009, 337 509.306 C 324.886 510.178, 308.311 515.835, 294.570 523.786 C 287.048 528.140, 271.094 543.989, 267.590 550.588 C 266.156 553.290, 264.564 556.175, 264.052 557 C 262.291 559.841, 258 569.879, 257.987 571.188 C 257.980 571.910, 257.062 575.409, 255.948 578.965 C 254.128 584.770, 253.858 589.135, 253.300 621.715 L 252.678 658 254.839 658 C 256.028 658, 257.337 658.027, 257.750 658.061 C 258.163 658.094, 258.797 656.632, 259.160 654.811 C 259.522 652.990, 260.564 647.675, 261.474 643 C 268.594 606.441, 284.333 578.336, 310.610 555.257 C 319.278 547.644, 326.459 542.803, 336.749 537.637 C 348.572 531.700, 366.829 525.072, 375.500 523.569 C 377.150 523.283, 382.100 522.156, 386.500 521.065 C 393.780 519.260, 416.388 515.481, 425 514.629 C 428.102 514.323, 428.536 513.926, 428.813 511.142 L 429.127 508 387.230 508 C 364.187 508, 345.146 508.172, 344.917 508.383"/>
            </g>

            {/* R letter Reveal */}
            <g filter="url(#glow)" className="logo-letter">
              <path fill="url(#g1)" strokeWidth="0.5" stroke="white" strokeOpacity="0.2" fillRule="evenodd" d="M 396 421.890 C 396 422.379, 397.961 425.417, 400.358 428.640 C 407.033 437.617, 418.718 448.278, 425.500 451.579 L 431.500 454.500 512.500 455 C 572.301 455.369, 594.040 455.810, 595.563 456.685 C 596.697 457.337, 599.447 459.846, 601.673 462.261 C 612.324 473.816, 606.273 492.499, 590.456 496.891 C 587.746 497.643, 562.958 497.991, 511.750 497.994 C 430.202 498.001, 432.967 497.785, 440.750 503.532 C 442.813 505.055, 446.300 507.972, 448.500 510.015 C 450.700 512.057, 455.650 516.112, 459.500 519.026 C 463.350 521.939, 468.639 526.295, 471.254 528.705 L 476.007 533.087 536.754 532.793 L 597.500 532.498 605.154 529.822 C 622.422 523.785, 634.218 512.108, 639.709 495.619 C 641.620 489.879, 642 486.613, 642 475.915 C 642 465.052, 641.650 462.126, 639.709 456.780 C 635.115 444.122, 624.856 432.510, 613.056 426.610 C 602.094 421.129, 600.173 421.038, 493.750 421.018 C 437.291 421.008, 396 421.376, 396 421.890"/>
            </g>

            {/* Baseline underline */}
            <line className="logo-baseline" x1="75" y1="690" x2="978" y2="690" stroke="url(#g1)" strokeWidth="3" strokeDasharray="903" strokeDashoffset="903" />
          </svg>
        </div>

        {/* Tagline — Glassmorphism style */}
        <div className="ws-text-content">
          <div className="ws-tagline">
            <span>Autonomous</span>
            <span className="ws-sep">·</span>
            <span>Reasoning</span>
            <span className="ws-sep">·</span>
            <span>Integration</span>
            <span className="ws-sep">·</span>
            <span>Agent</span>
          </div>
          <div className="ws-sub-tagline">A.R.I.A — Your Cognitive Operating System</div>
        </div>
      </div>

      <style>{`
        .ws-root {
          position: fixed; inset: 0; z-index: 10000;
          display: flex; align-items: center; justify-content: center;
          background: #02010a;
          opacity: 1; transition: all 1.2s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
          perspective: 1500px;
        }
        .ws-root.exit { opacity: 0; filter: blur(20px); transform: scale(1.1) translateZ(100px); pointer-events: none; }

        /* Cosmic Glows */
        .ws-bg-glow {
          position: absolute; border-radius: 50%; filter: blur(120px); opacity: 0.25;
          transition: transform 0.6s cubic-bezier(0.1, 0, 0.1, 1);
          animation: glow-pulse 10s ease-in-out infinite alternate;
        }
        .ws-glow-1 { width: 70vw; height: 70vw; background: radial-gradient(circle, #4f46e5 0%, transparent 70%); left: -15%; top: -15%; }
        .ws-glow-2 { width: 60vw; height: 60vw; background: radial-gradient(circle, #9333ea 0%, transparent 70%); right: -10%; bottom: -10%; animation-delay: -3s; }
        .ws-glow-3 { width: 50vw; height: 50vw; background: radial-gradient(circle, #db2777 0%, transparent 70%); left: 30%; top: 15%; animation-delay: -5s; }

        @keyframes glow-pulse {
          from { opacity: 0.15; transform: scale(1); }
          to   { opacity: 0.35; transform: scale(1.15); }
        }

        /* energy orbs */
        .ws-energy-orb {
          position: absolute; border-radius: 50%; filter: blur(30px); opacity: 0.4;
          background: white; pointer-events: none;
        }
        .orb-1 { width: 100px; height: 100px; background: #c084fc; animation: orb-float-1 15s linear infinite; }
        .orb-2 { width: 80px; height: 80px; background: #38bdf8; animation: orb-float-2 20s linear infinite; }
        .orb-3 { width: 120px; height: 120px; background: #f472b6; animation: orb-float-3 18s linear infinite; }

        @keyframes orb-float-1 { 0% { transform: translate(-20vw, -20vh) rotate(0deg); } 100% { transform: translate(120vw, 120vh) rotate(360deg); } }
        @keyframes orb-float-2 { 0% { transform: translate(120vw, -10vh) rotate(0deg); } 100% { transform: translate(-20vw, 110vh) rotate(-360deg); } }
        @keyframes orb-float-3 { 0% { transform: translate(50vw, 120vh) rotate(0deg); } 100% { transform: translate(50vw, -20vh) rotate(360deg); } }

        /* rings */
        .ws-ring {
          position: absolute; border-radius: 50%; border: 1px solid transparent;
          transition: transform 0.8s cubic-bezier(0.1, 0, 0.1, 1);
        }
        .ws-ring-1 {
          width: 90vmin; height: 90vmin; border-color: rgba(168,85,247,0.15);
          box-shadow: 0 0 100px rgba(168,85,247,0.05) inset;
          animation: ring-spin 40s linear infinite;
        }
        .ws-ring-2 {
          width: 70vmin; height: 70vmin; border-color: rgba(56,189,248,0.1);
          animation: ring-spin 30s linear infinite reverse;
        }
        @keyframes ring-spin { to { transform: rotate(360deg); } }

        /* particles */
        .ws-particles { position: absolute; inset: 0; pointer-events: none; }
        .ws-particle {
          position: absolute; left: var(--x); top: var(--y);
          width: var(--s); height: var(--s); border-radius: 50%;
          background: var(--c); box-shadow: 0 0 12px var(--c);
          animation: particle-float var(--d) ease-in-out infinite alternate;
          opacity: 0.4;
        }
        @keyframes particle-float {
          from { transform: translate(0,0) scale(1); opacity: 0.2; }
          to   { transform: translate(40px, 40px) scale(2.5); opacity: 0.7; }
        }

        /* logo */
        .ws-logo-wrap {
          display: flex; flex-direction: column; align-items: center; gap: 50px;
          z-index: 10; transition: transform 0.4s cubic-bezier(0.1, 0, 0.1, 1);
        }
        .ws-svg-container {
          position: relative; animation: logo-sway 8s ease-in-out infinite;
        }
        @keyframes logo-sway { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-20px) rotate(1deg); } }
        
        .ws-svg {
          width: min(850px, 95vw); height: auto;
          filter: drop-shadow(0 0 50px rgba(168,85,247,0.45));
          animation: logo-reveal-premium 2s cubic-bezier(0.2, 0, 0, 1) both;
        }
        @keyframes logo-reveal-premium {
          from { opacity: 0; transform: scale(0.85) translateZ(-200px); filter: blur(20px); }
          to   { opacity: 1; transform: scale(1) translateZ(0); filter: blur(0); }
        }

        .logo-letter { animation: letter-glow 4s ease-in-out infinite alternate; }
        @keyframes letter-glow { from { opacity: 0.7; } to { opacity: 1; filter: drop-shadow(0 0 15px white); } }

        .logo-baseline {
          animation: baseline-draw 2s 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          opacity: 0;
        }
        @keyframes baseline-draw { from { stroke-dashoffset: 903; opacity: 0; } to { stroke-dashoffset: 0; opacity: 0.8; } }

        /* text content */
        .ws-text-content {
          display: flex; flex-direction: column; align-items: center;
          padding: 30px 60px; background: rgba(255,255,255,0.02);
          backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 30px; box-shadow: 0 30px 70px rgba(0,0,0,0.5);
          animation: text-reveal-premium 1.5s 1.2s cubic-bezier(0.2, 0, 0, 1) both;
        }
        @keyframes text-reveal-premium {
          from { opacity: 0; transform: translateY(50px) scale(0.95); filter: blur(10px); }
          to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }

        .ws-tagline {
          display: flex; gap: 20px; font-family: 'Outfit', sans-serif;
          font-size: 18px; font-weight: 700; letter-spacing: 0.3em;
          text-transform: uppercase; color: white; margin-bottom: 15px;
        }
        .ws-tagline span {
          background: linear-gradient(to bottom, #fff, #aaa);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .ws-sep { color: #a855f7 !important; -webkit-text-fill-color: #a855f7 !important; }
        
        .ws-sub-tagline {
          font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 400;
          letter-spacing: 0.2em; color: rgba(255,255,255,0.45);
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }
      `}</style>
    </div>
  );
};

export default WelcomeScreen;
