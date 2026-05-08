import React, { useEffect, useState } from 'react';

const WelcomeScreen = ({ onComplete }) => {
  const [phase, setPhase] = useState('enter'); // enter → hold → exit

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('exit'), 3200);
    const t2 = setTimeout(onComplete, 4400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onComplete]);

  return (
    <div className={`ws-root ${phase}`}>
      {/* Ambient background rings */}
      <div className="ws-ring ws-ring-1"/>
      <div className="ws-ring ws-ring-2"/>
      <div className="ws-ring ws-ring-3"/>
      <div className="ws-particles">
        {Array.from({length: 20}).map((_,i) => (
          <div key={i} className="ws-particle" style={{
            '--i': i,
            '--x': `${Math.random()*100}%`,
            '--y': `${Math.random()*100}%`,
            '--d': `${2 + Math.random()*4}s`,
            '--s': `${2 + Math.random()*4}px`,
          }}/>
        ))}
      </div>

      {/* Logo */}
      <div className="ws-logo-wrap">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1024 1024"
          className="ws-svg"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#c084fc"><animate attributeName="stopColor" dur="3s" repeatCount="indefinite" values="#c084fc;#38bdf8;#f0abfc;#fde68a;#c084fc"/></stop>
              <stop offset="50%"  stopColor="#38bdf8"><animate attributeName="stopColor" dur="3s" repeatCount="indefinite" values="#38bdf8;#f0abfc;#fde68a;#c084fc;#38bdf8"/></stop>
              <stop offset="100%" stopColor="#fde68a"><animate attributeName="stopColor" dur="3s" repeatCount="indefinite" values="#fde68a;#c084fc;#38bdf8;#f0abfc;#fde68a"/></stop>
            </linearGradient>
            <linearGradient id="g2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"   stopColor="#f9a8d4"><animate attributeName="stopColor" dur="4s" repeatCount="indefinite" values="#f9a8d4;#a78bfa;#38bdf8;#f9a8d4"/></stop>
              <stop offset="100%" stopColor="#818cf8"><animate attributeName="stopColor" dur="4s" repeatCount="indefinite" values="#818cf8;#38bdf8;#f9a8d4;#818cf8"/></stop>
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="8" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="glow2">
              <feGaussianBlur stdDeviation="14" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Star / spark center */}
          <g filter="url(#glow2)" transform="translate(252 505)">
            <circle r="10" fill="none" stroke="url(#g1)" strokeWidth="2">
              <animate attributeName="r" values="10;200;10" dur="3s" begin="0.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.2 0 0.8 1;0.2 0 0.8 1"/>
              <animate attributeName="opacity" values="0.8;0;0.8" dur="3s" begin="0.5s" repeatCount="indefinite"/>
            </circle>
            <circle r="10" fill="none" stroke="url(#g2)" strokeWidth="2">
              <animate attributeName="r" values="10;200;10" dur="3s" begin="1.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.2 0 0.8 1;0.2 0 0.8 1"/>
              <animate attributeName="opacity" values="0.7;0;0.7" dur="3s" begin="1.5s" repeatCount="indefinite"/>
            </circle>
          </g>

          {/* R letter */}
          <g filter="url(#glow)" opacity="0">
            <animate attributeName="opacity" from="0" to="1" dur="0.9s" begin="0.1s" fill="freeze"/>
            <path fill="url(#g1)" strokeWidth="1.5" stroke="url(#g1)" fillRule="evenodd" d="M 396 421.890 C 396 422.379, 397.961 425.417, 400.358 428.640 C 407.033 437.617, 418.718 448.278, 425.500 451.579 L 431.500 454.500 512.500 455 C 572.301 455.369, 594.040 455.810, 595.563 456.685 C 596.697 457.337, 599.447 459.846, 601.673 462.261 C 612.324 473.816, 606.273 492.499, 590.456 496.891 C 587.746 497.643, 562.958 497.991, 511.750 497.994 C 430.202 498.001, 432.967 497.785, 440.750 503.532 C 442.813 505.055, 446.300 507.972, 448.500 510.015 C 450.700 512.057, 455.650 516.112, 459.500 519.026 C 463.350 521.939, 468.639 526.295, 471.254 528.705 L 476.007 533.087 536.754 532.793 L 597.500 532.498 605.154 529.822 C 622.422 523.785, 634.218 512.108, 639.709 495.619 C 641.620 489.879, 642 486.613, 642 475.915 C 642 465.052, 641.650 462.126, 639.709 456.780 C 635.115 444.122, 624.856 432.510, 613.056 426.610 C 602.094 421.129, 600.173 421.038, 493.750 421.018 C 437.291 421.008, 396 421.376, 396 421.890"/>
            <path fill="url(#g2)" strokeWidth="1.5" stroke="url(#g2)" fillRule="evenodd" d="M 490.250 539.813 C 488.462 539.986, 487 540.526, 487 541.014 C 487 541.992, 499.122 552.487, 513.329 563.809 C 518.373 567.828, 524.075 572.584, 526 574.376 C 527.925 576.169, 534.900 582.002, 541.500 587.338 C 569.190 609.728, 574.771 614.293, 580 618.828 C 583.025 621.452, 587.975 624.697, 591 626.039 C 596.237 628.362, 597.587 628.491, 619.250 628.730 C 646.228 629.028, 646.365 628.944, 634.358 619.500 C 630.163 616.200, 624.056 611.250, 620.788 608.500 C 615.189 603.788, 602.557 593.371, 576 571.564 C 569.675 566.370, 560.900 559.146, 556.500 555.512 C 552.100 551.877, 545.999 546.940, 542.943 544.541 L 537.386 540.180 515.443 539.840 C 503.374 539.653, 492.038 539.641, 490.250 539.813"/>
          </g>

          {/* I letter */}
          <g filter="url(#glow)" opacity="0">
            <animate attributeName="opacity" from="0" to="1" dur="0.9s" begin="0.3s" fill="freeze"/>
            <path fill="url(#g1)" strokeWidth="1.5" stroke="url(#g1)" fillRule="evenodd" d="M 669.615 422.560 C 668.727 424.875, 668.886 626.272, 669.777 627.674 C 670.310 628.512, 675.669 628.798, 688.512 628.674 L 706.500 628.500 706.500 525 L 706.500 421.500 688.365 421.228 C 672.485 420.990, 670.154 421.155, 669.615 422.560"/>
          </g>

          {/* A letter */}
          <g filter="url(#glow)" opacity="0">
            <animate attributeName="opacity" from="0" to="1" dur="0.9s" begin="0.5s" fill="freeze"/>
            <path fill="url(#g2)" strokeWidth="1.5" stroke="url(#g2)" fillRule="evenodd" d="M 837.500 419.164 C 832.369 421.995, 828.148 427.577, 820.029 442.267 C 819.188 443.788, 815.913 449.297, 812.750 454.508 C 809.587 459.718, 807 464.250, 807 464.577 C 807 464.905, 805.715 467.047, 804.145 469.337 C 802.574 469.337, 799.479 476.650, 797.266 480.500 C 789.801 493.488, 775.226 518.471, 772.763 522.500 C 771.419 524.700, 766.534 533.139, 761.909 541.253 C 757.284 549.368, 751.815 558.818, 749.755 562.253 C 746.289 568.034, 742.813 574.049, 738.928 580.984 C 738.063 582.528, 735.519 586.875, 733.274 590.645 C 729.116 597.627, 724.416 605.744, 716.974 618.789 C 714.687 622.799, 713.060 626.713, 713.357 627.488 C 713.797 628.636, 717.531 628.893, 733.437 628.870 L 752.976 628.842 754.738 626.167 C 757.647 621.749, 758.874 619.696, 761.113 615.500 C 762.287 613.300, 765.784 607.225, 768.883 602 C 771.983 596.775, 775.301 591.150, 776.257 589.500 C 777.214 587.850, 780.810 581.655, 784.248 575.732 C 787.687 569.810, 791.175 563.735, 792 562.232 C 792.825 560.730, 794.879 557.250, 796.565 554.500 C 803.390 543.366, 807 537.166, 807 536.578 C 807 536.236, 808.057 534.279, 809.348 532.229 C 810.639 530.178, 813.677 525.144, 816.098 521.043 C 818.519 516.941, 821.050 512.666, 821.722 511.543 C 822.394 510.419, 823.523 508.375, 824.230 507 C 829.501 496.758, 837.644 484.570, 840.354 482.867 C 843.628 480.810, 849.969 480.842, 853.880 482.936 C 855.518 483.812, 864.888 498.870, 870.722 510 C 872.019 512.475, 876.116 519.675, 879.826 526 L 886.571 537.500 907.786 537.770 C 921.474 537.944, 929 537.684, 929 537.038 C 929 536.486, 927.258 533.189, 925.128 529.710 C 922.999 526.231, 920.944 522.398, 920.561 521.192 C 920.178 519.986, 919.476 519, 919 519 C 918.524 519, 917.814 517.987, 917.423 516.750 C 917.031 515.513, 915.046 511.800, 913.012 508.500 C 909.425 502.681, 905.168 495.407, 902.030 489.735 C 901.188 488.214, 897.575 482.014, 894 475.956 C 890.425 469.899, 886.822 463.718, 885.994 462.221 C 885.166 460.725, 881.578 454.550, 878.022 448.500 C 870.652 435.960, 869.393 433.781, 866.203 428.034 C 864.865 425.623, 861.967 422.667, 859.258 420.948 C 855.150 418.343, 853.729 418.004, 847.054 418.030 C 842.899 418.047, 838.600 418.557, 837.500 419.164"/>
            <path fill="url(#g1)" strokeWidth="1.5" stroke="url(#g1)" fillRule="evenodd" d="M 891.590 547.854 C 891.300 548.323, 892.400 550.816, 894.035 553.393 C 895.669 555.971, 897.687 559.524, 898.519 561.290 C 899.351 563.055, 901.534 566.975, 903.372 570 C 907.070 576.088, 913.169 586.488, 916.402 592.218 C 917.556 594.262, 921.836 601.687, 925.914 608.718 C 929.991 615.748, 934.142 623.142, 935.138 625.149 L 936.949 628.798 957.210 628.649 C 975.606 628.514, 977.501 628.340, 977.807 626.758 C 977.992 625.800, 975.914 621.300, 973.189 616.758 C 970.464 612.216, 967.268 606.700, 966.087 604.500 C 962.810 598.395, 958.738 591.180, 954.518 584 C 952.417 580.425, 949.639 575.475, 948.346 573 C 947.052 570.525, 945.548 567.825, 945.004 567 C 942.850 563.734, 935.332 550.397, 934.717 548.750 C 934.122 547.160, 932.148 547, 913.090 547 C 901.556 547, 891.881 547.384, 891.590 547.854"/>
          </g>

          {/* Baseline underline */}
          <line x1="75" y1="690" x2="978" y2="690" stroke="url(#g1)" strokeWidth="2" strokeDasharray="903" strokeDashoffset="903" opacity="0">
            <animate attributeName="strokeDashoffset" from="903" to="0" dur="1.2s" begin="0.8s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1" keyTimes="0;1"/>
            <animate attributeName="opacity" from="0" to="0.6" dur="0.4s" begin="0.8s" fill="freeze"/>
          </line>

          {/* Sparkle top */}
          <g opacity="0">
            <animate attributeName="opacity" from="0" to="1" dur="0.6s" begin="1s" fill="freeze"/>
            <line x1="252" y1="345" x2="252" y2="300" stroke="#c084fc" strokeWidth="2.5" strokeLinecap="round">
              <animate attributeName="y2" values="300;260;300" dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
              <animate attributeName="opacity" values="1;0.1;1" dur="2.8s" repeatCount="indefinite"/>
            </line>
            <circle cx="252" cy="300" r="4" fill="#c084fc">
              <animate attributeName="cy" values="300;260;300" dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
              <animate attributeName="opacity" values="1;0;1" dur="2.8s" repeatCount="indefinite"/>
            </circle>
          </g>
        </svg>

        {/* Tagline */}
        <div className="ws-tagline">
          <span>Adaptive</span>
          <span className="ws-sep">·</span>
          <span>Responsive</span>
          <span className="ws-sep">·</span>
          <span>Intelligent</span>
          <span className="ws-sep">·</span>
          <span>Agent</span>
        </div>
      </div>

      <style>{`
        .ws-root {
          position: fixed; inset: 0; z-index: 1000;
          display: flex; align-items: center; justify-content: center;
          background: radial-gradient(ellipse at 50% 50%, #140a2e 0%, #06040f 100%);
          opacity: 1; transition: opacity 1.2s cubic-bezier(0.4,0,0.2,1);
          overflow: hidden;
        }
        .ws-root.exit { opacity: 0; transform: scale(1.04); transition: opacity 1.2s ease, transform 1.2s ease; }

        /* rings */
        .ws-ring {
          position: absolute; border-radius: 50%; border: 1px solid transparent;
          animation: ring-spin linear infinite;
        }
        .ws-ring-1 {
          width: min(600px, 80vmin); height: min(600px, 80vmin);
          border-color: rgba(168,85,247,0.12);
          animation-duration: 18s;
          box-shadow: 0 0 60px rgba(168,85,247,0.06) inset;
        }
        .ws-ring-2 {
          width: min(420px, 58vmin); height: min(420px, 58vmin);
          border-color: rgba(56,189,248,0.1);
          animation-duration: 12s; animation-direction: reverse;
        }
        .ws-ring-3 {
          width: min(240px, 34vmin); height: min(240px, 34vmin);
          border-color: rgba(240,171,252,0.15);
          animation-duration: 8s;
        }
        @keyframes ring-spin { to { transform: rotate(360deg); } }

        /* particles */
        .ws-particles { position: absolute; inset: 0; pointer-events: none; }
        .ws-particle {
          position: absolute; left: var(--x); top: var(--y);
          width: var(--s); height: var(--s); border-radius: 50%;
          background: radial-gradient(circle, rgba(168,85,247,0.8), transparent);
          animation: particle-float var(--d) ease-in-out infinite alternate;
          animation-delay: calc(var(--i) * 0.3s);
        }
        @keyframes particle-float {
          from { transform: translate(0,0) scale(1); opacity: 0.2; }
          to   { transform: translate(calc((var(--i) - 10)*3px), calc(sin(var(--i))*20px)) scale(1.6); opacity: 0.8; }
        }

        /* logo */
        .ws-logo-wrap {
          display: flex; flex-direction: column; align-items: center; gap: clamp(16px,3vh,32px);
          padding: 20px;
          animation: logo-enter 1s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes logo-enter {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        .ws-svg {
          width: min(700px, 88vw); height: auto;
          max-height: 52vh;
          filter: drop-shadow(0 0 32px rgba(168,85,247,0.35)) drop-shadow(0 0 80px rgba(56,189,248,0.15));
        }

        /* tagline */
        .ws-tagline {
          display: flex; gap: clamp(6px,2vw,16px); flex-wrap: wrap; justify-content: center;
          font-family: 'Inter', system-ui, sans-serif;
          font-size: clamp(10px, 1.6vw, 15px);
          font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase;
          color: rgba(255,255,255,0.45);
          animation: tag-enter 1.2s 0.6s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes tag-enter {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ws-tagline span { color: rgba(255,255,255,0.55); }
        .ws-sep { color: rgba(168,85,247,0.6); }
      `}</style>
    </div>
  );
};

export default WelcomeScreen;
