import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import Logs from './Logs';
import { loadSettings } from './SettingsPage';
import { speakFemale } from './Logs';
import { DB } from '../storage/Database.js';

// ─── SHADERS (Remote Advanced Version) ─────────────────────────────────────────
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
    if (uState == 1.0) distortion += snoise(noisePos * 2.0) * 0.4 * uAudioData;
    else if (uState == 2.0) {
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

// ─── ORB COMPONENT ─────────────────────────────────────────────────────────
const Orb = ({ onNavigate }) => {
  const mountRef = useRef(null);
  const orbState = useRef(0); // 0=idle, 1=listen, 2=speak
  const uniformsRef = useRef(null);

  const [uiState, setUiState] = useState(0);
  const [statusText, setStatusText] = useState('Idle');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [showResponse, setShowResponse] = useState(false);

  const setOrbState = useCallback((s) => {
    orbState.current = s;
    setUiState(s);
    if (uniformsRef.current) uniformsRef.current.uState.value = s;
  }, []);

  // Ollama Integration
  const chat = useCallback(async (prompt) => {
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: loadSettings().model || 'llama3.2', prompt, stream: true })
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
            if (j.response) {
              full += j.response;
              setResponse(prev => prev + j.response);
            }
          } catch {}
        }
      }
      speakFemale(full, loadSettings());
      setOrbState(0);
      setStatusText('Tap to speak');
    } catch (e) {
      setResponse(`[Error: ${e.message}]`);
      setOrbState(0);
    }
  }, [setOrbState]);

  // Speech Recognition
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return setStatusText('Speech not supported');
    const rec = new SpeechRecognition();
    rec.onstart = () => { setIsListening(true); setOrbState(1); setStatusText('Listening...'); setTranscript(''); setShowResponse(false); };
    rec.onresult = (e) => setTranscript(e.results[0][0].transcript);
    rec.onend = () => { setIsListening(false); if (transcript) { setOrbState(2); setStatusText('Thinking...'); setShowResponse(true); setResponse(''); chat(transcript); } else setOrbState(0); };
    rec.start();
  }, [transcript, setOrbState, chat]);

  useEffect(() => {
    const container = mountRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const uniforms = { uTime: { value: 0 }, uState: { value: 0 }, uAudioData: { value: 0.1 } };
    uniformsRef.current = uniforms;

    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true });
    const sphere = new THREE.Mesh(new THREE.IcosahedronGeometry(2, 64), material);
    scene.add(sphere);

    const animate = () => {
      requestAnimationFrame(animate);
      uniforms.uTime.value += 0.01;
      sphere.rotation.y += 0.005;
      renderer.render(scene, camera);
    };
    animate();

    return () => { if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement); renderer.dispose(); };
  }, []);

  return (
    <div className="orb-wrapper" style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#06040c' }}>
      <div ref={mountRef} className="orb-canvas" onClick={startListening} style={{ width: '400px', height: '400px', cursor: 'pointer' }} />
      <div className="orb-status" style={{ textAlign: 'center', marginTop: '20px' }}>
        <p style={{ color: '#38bdf8', letterSpacing: '0.2em', fontSize: '12px' }}>{statusText}</p>
        {transcript && <p style={{ color: 'white', opacity: 0.6, fontSize: '14px', marginTop: '10px' }}>"{transcript}"</p>}
      </div>
      {showResponse && (
        <div className="orb-response" style={{ maxWidth: '600px', padding: '30px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', marginTop: '30px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ color: 'white', lineHeight: '1.6' }}>{response || '...'}</p>
        </div>
      )}

      <button
        className="orb-chat-btn"
        onClick={() => onNavigate('chat')}
        title="Open Chat"
        style={{
          position: 'fixed', bottom: '40px', right: '40px', width: '64px', height: '64px',
          borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.4)',
          color: '#38bdf8', display: 'flex', alignItems: 'center', justifyCenter: 'center', cursor: 'pointer'
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </button>
    </div>
  );
};

export default Orb;
