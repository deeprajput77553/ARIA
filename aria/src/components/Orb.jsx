import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

// ─── VERTEX SHADER (matches orb.js exactly) ───────────────────────────────────
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

// ─── FRAGMENT SHADER ─────────────────────────────────────────────────────────
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

import { loadSettings } from './SettingsPage';
import { speakFemale } from './Logs';
import { DB } from '../storage/Database.js';
import { loadProfile, buildProactiveGreeting } from '../storage/UserProfile';
import { startProactiveMonitor, stopProactiveMonitor, buildContextualGreeting } from '../storage/ProactiveEngine';
import { scheduleDecayRunner } from '../storage/DecayRunner';
import Chat from './Chat';

// ─── OLLAMA API HOOK ──────────────────────────────────────────────────────────
const useOllama = () => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [model, setModel] = useState(() => loadSettings().model || 'llama3.2');

  useEffect(() => {
    const checkOllama = async () => {
      try {
        const res = await fetch('http://localhost:11434/api/tags', { method: 'GET' });
        if (res.ok) {
          const data = await res.json();
          setIsAvailable(true);
          // Pick best available model
          const models = data.models?.map(m => m.name) || [];
          const preferred = ['llama3.3', 'llama3.2', 'llama3.1', 'llama3', 'mistral', 'phi3', 'gemma3', 'deepseek-r1'];
          for (const p of preferred) {
            const found = models.find(m => m.toLowerCase().includes(p.toLowerCase()));
            if (found) { setModel(found); break; }
          }
        }
      } catch {
        setIsAvailable(false);
      }
    };
    checkOllama();
    const interval = setInterval(checkOllama, 15000);
    return () => clearInterval(interval);
  }, []);

  const chat = useCallback(async (prompt, onChunk, onDone) => {
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: true })
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const j = JSON.parse(line);
            if (j.response) { full += j.response; onChunk(j.response); }
          } catch {}
        }
      }
      onDone(full);
    } catch (e) {
      onDone(`[Ollama unavailable: ${e.message}]`);
    }
  }, [model]);

  return { isAvailable, model, chat };
};

// ─── ORB COMPONENT ─────────────────────────────────────────────────────────
const Orb = ({ onStateChange, onNavigate }) => {
  const mountRef = useRef(null);
  const orbState = useRef(0); // 0=idle, 1=listen, 2=speak
  const uniformsRef = useRef(null);
  const midUniformsRef = useRef(null);
  const innerUniformsRef = useRef(null);
  const shellRef = useRef(null);
  const materialRef = useRef(null);

  const [uiState, setUiState] = useState(0);
  const [statusText, setStatusText] = useState('Idle');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [showResponse, setShowResponse] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const { isAvailable, model, chat } = useOllama();

  const recognitionRef = useRef(null);
  const greetedRef    = useRef(false);

  const setOrbState = useCallback((s) => {
    orbState.current = s;
    setUiState(s);
    if (uniformsRef.current) uniformsRef.current.uState.value = s;
    if (midUniformsRef.current) midUniformsRef.current.uState.value = s;
    if (innerUniformsRef.current) innerUniformsRef.current.uState.value = s;
    if (shellRef.current) shellRef.current.material.opacity = s === 0 ? 0.1 : 0.05;
    onStateChange?.(s);
  }, [onStateChange]);

  // ── Proactive greeting on mount (AFTER setOrbState is defined) ─────────────
  useEffect(() => {
    if (greetedRef.current) return;
    greetedRef.current = true;
    // Delay 1.5s so the orb finishes rendering first
    const timer = setTimeout(async () => {
      const p    = await loadProfile();
      const msgs = await DB.getMessages();
      
      // Only greet if no messages in DB or if last message was long ago
      if (msgs.length === 0) {
        const text = buildProactiveGreeting(p);
        setResponse(text);
        setShowResponse(true);
        setOrbState(2);
        speakFemale(text, loadSettings());
        
        // Save to DB so it shows in Logs
        await DB.putMessage({
          id: Date.now(),
          role: 'ai',
          text: text,
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now(),
          steps: [{ label: 'Cognitive startup', status: 'done' }, { label: 'Greeting generated', status: 'done' }]
        });
        
        setTimeout(() => setOrbState(0), 1200);
      }
    }, 1500);

    // Start proactive background monitor
    startProactiveMonitor((trigger) => {
      setResponse(trigger.message);
      setShowResponse(true);
      setOrbState(2);
      speakFemale(trigger.message, loadSettings());
      setTimeout(() => setOrbState(0), 1000);
    });

    // Start decay runner
    scheduleDecayRunner();

    return () => {
      clearTimeout(timer);
      stopProactiveMonitor();
    };
  }, [setOrbState]);


  // ── Speech recognition ──────────────────────────────────────────────────
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
    recognitionRef.current = rec;

    setOrbState(1);
    setIsListening(true);
    setStatusText('Listening...');
    setShowResponse(false);
    setTranscript('');

    rec.onresult = (e) => {
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        t += e.results[i][0].transcript;
      }
      setTranscript(t);
    };

    rec.onend = async () => {
      setIsListening(false);
      const finalText = recognitionRef.current._finalTranscript || transcript;
      if (finalText.trim()) {
        setOrbState(2);
        setStatusText('Thinking...');
        setResponse('');
        setShowResponse(true);

        await chat(
          finalText,
          (chunk) => setResponse(prev => prev + chunk),
          (full) => {
            setStatusText('Done — tap to speak again');
            setTimeout(() => setOrbState(0), 500);
            setTimeout(() => setStatusText('Tap to speak'), 3000);
          }
        );
      } else {
        setOrbState(0);
        setStatusText('Tap to speak');
      }
    };

    rec.onerror = () => {
      setIsListening(false);
      setOrbState(0);
      setStatusText('Error — tap to try again');
    };

    // Store transcript reference
    let _transcript = '';
    rec.onresult = (e) => {
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        t += e.results[i][0].transcript;
      }
      _transcript = t;
      setTranscript(t);
    };
    rec._finalTranscript = _transcript;
    rec.onend = async () => {
      setIsListening(false);
      if (_transcript.trim()) {
        setOrbState(2);
        setStatusText('Thinking...');
        setResponse('');
        setShowResponse(true);
        await chat(
          _transcript,
          (chunk) => setResponse(prev => prev + chunk),
          (full) => {
            speakFemale(full, loadSettings());
            setStatusText('Done — tap to speak again');
            setTimeout(() => setOrbState(0), 800);
            setTimeout(() => setStatusText('Tap to speak'), 3500);
          }
        );
      } else {
        setOrbState(0);
        setStatusText('Tap to speak');
      }
    };

    rec.start();
  }, [setOrbState, chat, transcript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const handleOrbClick = useCallback(() => {
    if (isListening) {
      stopListening();
    } else if (orbState.current === 0) {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

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
      uAudioData: { value: 0.1 },
      uTransition: { value: 0 }
    };
    uniformsRef.current = uniforms;

    const midUniforms = { uTime: { value: 0 }, uColor: { value: 1.0 }, uState: { value: 0 }, uAudioData: { value: 0.1 } };
    midUniformsRef.current = midUniforms;

    const innerUniforms = { uTime: { value: 0 }, uColor: { value: 2.0 }, uState: { value: 0 }, uAudioData: { value: 0.1 } };
    innerUniformsRef.current = innerUniforms;

    const material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader, uniforms, transparent: true, wireframe: false
    });
    materialRef.current = material;

    const midMaterial = new THREE.ShaderMaterial({
      vertexShader, fragmentShader: layerFragmentShader, uniforms: midUniforms,
      transparent: true, blending: THREE.AdditiveBlending
    });

    const innerMaterial = new THREE.ShaderMaterial({
      vertexShader, fragmentShader: layerFragmentShader, uniforms: innerUniforms,
      transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });

    const sphere    = new THREE.Mesh(new THREE.IcosahedronGeometry(2, 64), material);
    const midSphere = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 128), midMaterial);
    const innerSphere = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 128), innerMaterial);
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.15, 10),
      new THREE.MeshBasicMaterial({ color: 0x4400ff, wireframe: true, transparent: true, opacity: 0.1 })
    );
    shellRef.current = shell;

    scene.add(sphere, midSphere, innerSphere, shell);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const pointLight = new THREE.PointLight(0xff00ff, 2, 10);
    scene.add(ambientLight, pointLight);

    const clock = new THREE.Clock();
    let audioData = 0.1;
    let frameId;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const s = orbState.current;

      // update uniforms
      uniforms.uTime.value = t;
      midUniforms.uTime.value = t;
      innerUniforms.uTime.value = t;

      let targetAudio = 0.1;
      if (s === 1) targetAudio = 0.5 + Math.random() * 0.5;
      else if (s === 2) targetAudio = 0.8 + Math.sin(t * 10) * 0.4;

      audioData += (targetAudio - audioData) * 0.08;
      uniforms.uAudioData.value = audioData;
      midUniforms.uAudioData.value = audioData;
      innerUniforms.uAudioData.value = audioData;

      // rotation — matches orb.js exactly
      sphere.rotation.y    += 0.0015;
      sphere.rotation.z    += 0.0005;
      midSphere.rotation.y -= 0.0018;
      midSphere.rotation.x += 0.001;
      innerSphere.rotation.y += 0.003;
      innerSphere.rotation.x -= 0.002;
      shell.rotation.y -= 0.0005;

      scene.rotation.y = Math.sin(t * 0.1) * 0.1;
      scene.rotation.x = Math.cos(t * 0.05) * 0.05;

      renderer.render(scene, camera);
    };

    animate();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  const stateLabel = ['Idle', 'Listening', 'Speaking'];
  const stateColor = ['#a78bfa', '#38bdf8', '#f472b6'];

  return (
    <div className="orb-wrapper">
      {/* Three.js canvas container — clicking it toggles listen */}
      <div
        ref={mountRef}
        className="orb-canvas"
        onClick={handleOrbClick}
        title={isListening ? 'Tap to stop' : 'Tap to speak'}
      />

      {/* Status overlay */}
      <div className="orb-status">
        <div className="orb-state-badge" style={{ '--c': stateColor[uiState] }}>
          <span className={`state-dot ${uiState !== 0 ? 'pulse' : ''}`}/>
          {stateLabel[uiState]}
        </div>
        <p className="orb-hint">{statusText}</p>
        {!isAvailable && (
          <p className="orb-warning">⚠ Ollama offline — start with: <code>ollama serve</code></p>
        )}
        {isAvailable && (
          <p className="orb-model">Model: <span>{model}</span></p>
        )}
      </div>

      {/* Transcript display */}
      {transcript && (
        <div className="orb-transcript">
          <span className="transcript-label">You said:</span>
          <p>{transcript}</p>
        </div>
      )}

      {/* AI response */}
      {showResponse && (
        <div className="orb-response">
          <span className="response-label">ARIA</span>
          <p>{response || '...'}</p>
        </div>
      )}

      {/* Floating circle button to Logs/Chat Overlay */}
      <button
        className="orb-logs-btn"
        onClick={() => setShowChat(true)}
        title="Open Chat"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
          <path d="M12 20h9M3 20h2M3 12h18M3 4h18" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Chat Overlay */}
      {showChat && <Chat onClose={() => setShowChat(false)} />}
    </div>
  );
};

export default Orb;
