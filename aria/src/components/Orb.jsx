import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { loadSettings } from './SettingsPage';
import { msgBus, BUS_EVENTS } from '../storage/MessageBus.js';
import { stopSpeaking } from './Logs';
import { agentEngine } from '../engine/AgentEngine';
import { useOllama } from '../hooks/useOllama';
import { DB } from '../storage/Database.js';

// ─── SHADERS (Truncated for brevity, assuming they remain the same) ──────────
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  uniform float uTime;
  uniform float uState;
  uniform float uAudioData;

  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    float noiseFreq = 1.5;
    float noiseAmp = 0.2;
    vec3 noisePos = vec3(position.x * noiseFreq + uTime, position.y * noiseFreq + uTime, position.z * noiseFreq);
    float distortion = snoise(noisePos) * noiseAmp;
    if (uState == 1.0) {
      distortion += snoise(noisePos * 2.0) * 0.4 * uAudioData;
    } else if (uState == 2.0) {
      distortion += sin(position.y * 10.0 + uTime * 5.0) * 0.15 * uAudioData;
      distortion += snoise(noisePos * 3.0) * 0.2 * uAudioData;
    }
    vec3 newPosition = position + normal * distortion;
    vPosition = newPosition;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  uniform float uTime;
  uniform float uState;
  uniform float uTransition;

  void main() {
    vec3 colorDark  = vec3(0.08, 0.0, 0.45);
    vec3 colorLight = vec3(0.0,  0.75, 1.0);
    vec3 colorAccent = vec3(1.0, 0.0, 1.0);

    vec3 viewDir = normalize(cameraPosition - vPosition);
    float fresnel = clamp(1.0 - dot(viewDir, vNormal), 0.0, 1.0);
    fresnel = pow(fresnel, 1.8);

    float mixVal = sin(vPosition.y * 2.0 + uTime * 0.8) * 0.5 + 0.5;
    vec3 color = mix(colorDark, colorLight, mixVal);

    if (uState < 0.5) {
      color = mix(color, colorAccent, fresnel * 0.8);
    } else if (uState < 1.5) {
      vec3 listenColor = vec3(0.2, 0.0, 1.0);
      color = mix(color, listenColor, mixVal * 0.4);
      color = mix(color, colorAccent, fresnel * 1.8);
    } else {
      vec3 cA = vec3(1.0, 0.1, 0.5);
      vec3 cB = vec3(0.0, 1.0, 0.5);
      vec3 cC = vec3(1.0, 0.9, 0.0);
      float cm = sin(vPosition.x * 2.5 + uTime * 4.0) * 0.5 + 0.5;
      vec3 speakColor = mix(cA, cB, cm);
      speakColor = mix(speakColor, cC, sin(uTime * 2.5) * 0.5 + 0.5);
      color = mix(color, speakColor, fresnel * 2.0);
    }

    float glow = fresnel * 1.4;
    gl_FragColor = vec4(color + glow * vec3(0.4, 0.2, 1.0), 0.92 + fresnel * 0.08);
  }
`;

const layerFragmentShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  uniform float uTime;
  uniform float uColor;
  uniform float uState;

  void main() {
    vec3 c1 = vec3(0.5, 0.0, 1.0);
    vec3 c2 = vec3(0.0, 0.9, 0.8);
    vec3 c3 = vec3(1.0, 0.2, 0.0);

    vec3 base = c1;
    if(uColor > 0.5) base = c2;
    if(uColor > 1.5) base = c3;

    float fresnel = pow(1.0 - abs(dot(normalize(cameraPosition - vPosition), vNormal)), 2.5);
    float pulse = sin(uTime * 2.0 + vPosition.x * 2.0) * 0.5 + 0.5;
    float speed = uState > 1.5 ? 3.0 : (uState > 0.5 ? 1.5 : 1.0);
    pulse = sin(uTime * speed + vPosition.y) * 0.5 + 0.5;

    gl_FragColor = vec4(base, fresnel * pulse * 0.7);
  }
`;

// ─── ORB COMPONENT ─────────────────────────────────────────────────────────
const Orb = ({ onStateChange }) => {
  const mountRef = useRef(null);
  const orbStateRef = useRef(0); // 0=idle, 1=listen, 2=speak
  const uniformsRef = useRef(null);
  const midUniformsRef = useRef(null);
  const innerUniformsRef = useRef(null);
  const shellRef = useRef(null);

  const [statusText, setStatusText] = useState('Tap to speak');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [showResponse, setShowResponse] = useState(false);

  const { isAvailable, model } = useOllama();
  const recognitionRef = useRef(null);

  const setOrbState = useCallback((s) => {
    orbStateRef.current = s;
    if (uniformsRef.current) uniformsRef.current.uState.value = s;
    if (midUniformsRef.current) midUniformsRef.current.uState.value = s;
    if (innerUniformsRef.current) innerUniformsRef.current.uState.value = s;
    if (shellRef.current) shellRef.current.material.opacity = s === 0 ? 0.1 : 0.05;
    onStateChange?.(s);
  }, [onStateChange]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setOrbState(0);
  }, [setOrbState]);

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setStatusText('Speech not supported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    
    let finalT = '';

    rec.onstart = () => {
      setOrbState(1);
      setIsListening(true);
      setStatusText('Listening...');
      setTranscript('');
      setShowResponse(false);
    };

    rec.onresult = (e) => {
      let current = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        current += e.results[i][0].transcript;
      }
      finalT = current;
      setTranscript(current);
    };

    rec.onend = async () => {
      setIsListening(false);
      if (finalT.trim()) {
        const text = finalT.trim();
        setOrbState(2);
        setStatusText('Thinking...');
        setResponse('');
        setShowResponse(true);

        // Save messages and run agent
        const userMsg = await DB.addMessage('user', text);
        msgBus.emit(BUS_EVENTS.NEW_MESSAGE, userMsg);

        const aiMsg = await DB.addMessage('ai', '', [
          { label: 'Voice intent parsed', status: 'done' },
          { label: 'Synthesizing response', status: 'running' }
        ]);
        msgBus.emit(BUS_EVENTS.NEW_MESSAGE, aiMsg);

        try {
          await agentEngine.run(text, model, aiMsg.id);
          setStatusText('Done — tap again');
          setTimeout(() => {
            setOrbState(0);
            setStatusText('Tap to speak');
          }, 3000);
        } catch (err) {
          setStatusText('Agent error');
          setOrbState(0);
        }
      } else {
        setOrbState(0);
        setStatusText('Tap to speak');
      }
    };

    rec.onerror = (e) => {
      console.error('Speech error:', e.error);
      setIsListening(false);
      setOrbState(0);
      setStatusText(`Error: ${e.error}`);
    };

    recognitionRef.current = rec;
    rec.start();
  }, [setOrbState, model]);

  const handleOrbClick = () => {
    if (isListening) stopListening();
    else if (orbStateRef.current === 0) startListening();
  };

  // ── Three.js scene ──────────────────────────────────────────────────────
  useEffect(() => {
    const container = mountRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const uniforms = {
      uTime: { value: 0 },
      uState: { value: 0 },
      uAudioData: { value: 0 },
      uTransition: { value: 0 }
    };
    uniformsRef.current = uniforms;

    const geo = new THREE.IcosahedronGeometry(2, 64);
    const mat = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true });
    const orb = new THREE.Mesh(geo, mat);
    scene.add(orb);

    // Layer 1
    const mUniforms = { uTime: { value: 0 }, uState: { value: 0 }, uColor: { value: 1.0 } };
    midUniformsRef.current = mUniforms;
    const mGeo = new THREE.IcosahedronGeometry(2.1, 32);
    const mMat = new THREE.ShaderMaterial({ vertexShader, fragmentShader: layerFragmentShader, uniforms: mUniforms, transparent: true, blending: THREE.AdditiveBlending });
    const mMesh = new THREE.Mesh(mGeo, mMat);
    scene.add(mMesh);

    // Shell
    const sGeo = new THREE.SphereGeometry(3, 32, 32);
    const sMat = new THREE.MeshPhongMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.1, side: THREE.BackSide });
    const shell = new THREE.Mesh(sGeo, sMat);
    shellRef.current = shell;
    scene.add(shell);

    const light = new THREE.PointLight(0xffffff, 1);
    light.position.set(5, 5, 5);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040));

    const animate = (t) => {
      uniforms.uTime.value = t * 0.001;
      mUniforms.uTime.value = t * 0.001;
      orb.rotation.y += 0.005;
      mMesh.rotation.z -= 0.003;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate(0);

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="orb-page">
      <div className="orb-mount" ref={mountRef} onClick={handleOrbClick} />
      
      <div className="orb-ui">
        <div className={`orb-status ${isListening ? 'active' : ''}`}>{statusText}</div>
        
        {transcript && <div className="orb-transcript">"{transcript}"</div>}

        {showResponse && (
          <div className="orb-response-card premium-scroll">
            <div className="response-header">ARIA RESPONSE</div>
            <div className="response-text">{response || '...'}</div>
          </div>
        )}
      </div>

      <style>{`
        .orb-page { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; overflow: hidden; }
        .orb-mount { width: 100%; height: 100%; cursor: pointer; transition: transform 0.3s ease; }
        .orb-mount:hover { transform: scale(1.02); }
        
        .orb-ui { position: absolute; bottom: 80px; display: flex; flex-direction: column; align-items: center; gap: 20px; pointer-events: none; width: 100%; max-width: 600px; padding: 0 40px; }
        
        .orb-status { font-family: 'Outfit', sans-serif; font-size: 14px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.4); }
        .orb-status.active { color: #a78bfa; text-shadow: 0 0 10px rgba(167,139,250,0.5); }
        
        .orb-transcript { font-family: 'Inter', sans-serif; font-size: 18px; color: white; text-align: center; font-style: italic; opacity: 0.8; }
        
        .orb-response-card { background: rgba(13,10,31,0.85); backdrop-filter: blur(20px); border: 1px solid rgba(167,139,250,0.2); border-radius: 24px; padding: 24px; width: 100%; max-height: 200px; overflow-y: auto; pointer-events: auto; box-shadow: 0 20px 50px rgba(0,0,0,0.5); animation: card-slide 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        
        @keyframes card-slide { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        
        .response-header { font-size: 10px; font-weight: 800; color: #a78bfa; letter-spacing: 0.1em; margin-bottom: 8px; }
        .response-text { font-size: 16px; line-height: 1.6; color: white; }
      `}</style>
    </div>
  );
};

export default Orb;
