import React, { useState, useEffect } from 'react';

const DEFAULTS = {
  voiceEnabled: true,
  voiceSpeed: 1.0,
  voicePitch: 1.15,
  voiceName: '',           // auto-selected female
  persona: 'friend',
  wakeWord: 'Hey ARIA',
  storageMode: 'local',    // local | cloud | both
  proactiveMode: true,
  theme: 'dark',
  model: 'llama3.2',
};

const STORAGE_KEY = 'aria_settings';

export const loadSettings = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch { return DEFAULTS; }
};

export const saveSettings = (s) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
};

const SettingsPage = () => {
  const [settings, setSettings] = useState(loadSettings);
  const [voices, setVoices]     = useState([]);
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    const load = () => {
      const vs = window.speechSynthesis.getVoices();
      setVoices(vs.filter(v => v.lang.startsWith('en')));
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  const set = (key, val) => setSettings(s => ({ ...s, [key]: val }));

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testVoice = () => {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance("Hello, I am ARIA, your personal AI assistant.");
    const chosenVoice = voices.find(v => v.name === settings.voiceName) ||
      voices.find(v => /samantha|victoria|karen|zira|google.*female|female/i.test(v.name)) ||
      voices.find(v => v.lang.startsWith('en'));
    if (chosenVoice) utt.voice = chosenVoice;
    utt.pitch = settings.voicePitch;
    utt.rate  = settings.voiceSpeed;
    window.speechSynthesis.speak(utt);
  };

  const requestStoragePermission = async () => {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      const granted = await navigator.storage.persist();
      alert(granted ? 'Persistent storage granted!' : 'Standard storage will be used.');
    }
  };

  const Section = ({ title, children }) => (
    <div className="settings-section">
      <h3 className="settings-section-title">{title}</h3>
      {children}
    </div>
  );

  const Row = ({ label, hint, children }) => (
    <div className="settings-row">
      <div>
        <span className="settings-label">{label}</span>
        {hint && <span className="settings-hint">{hint}</span>}
      </div>
      {children}
    </div>
  );

  const Toggle = ({ value, onChange }) => (
    <button className={`toggle ${value ? 'on' : ''}`} onClick={() => onChange(!value)}>
      <span className="toggle-knob"/>
    </button>
  );

  return (
    <div className="settings-page">
      <div className="settings-card">
        <div className="settings-header">
          <h2>Settings</h2>
          <p>Configure your ARIA experience — all stored locally on your device.</p>
        </div>

        <Section title="Voice">
          <Row label="Voice output" hint="ARIA speaks responses aloud">
            <Toggle value={settings.voiceEnabled} onChange={v => set('voiceEnabled', v)}/>
          </Row>
          <Row label="Voice">
            <select className="settings-select" value={settings.voiceName} onChange={e => set('voiceName', e.target.value)}>
              <option value="">Auto (best female)</option>
              {voices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
            </select>
          </Row>
          <Row label="Speed" hint={`${settings.voiceSpeed.toFixed(1)}×`}>
            <input type="range" min="0.5" max="2" step="0.1" value={settings.voiceSpeed}
              onChange={e => set('voiceSpeed', parseFloat(e.target.value))} className="settings-slider"/>
          </Row>
          <Row label="Pitch" hint={`${settings.voicePitch.toFixed(1)}`}>
            <input type="range" min="0.5" max="2" step="0.05" value={settings.voicePitch}
              onChange={e => set('voicePitch', parseFloat(e.target.value))} className="settings-slider"/>
          </Row>
          <button className="settings-action-btn" onClick={testVoice}>Test Voice</button>
        </Section>

        <Section title="AI Persona">
          <Row label="Persona mode">
            <select className="settings-select" value={settings.persona} onChange={e => set('persona', e.target.value)}>
              <option value="friend">Friend — casual, warm</option>
              <option value="executive">Executive — concise, bullet points</option>
              <option value="analyst">Analyst — detailed, structured</option>
              <option value="coach">Coach — motivating, action-oriented</option>
            </select>
          </Row>
          <Row label="AI Model" hint="Requires Ollama running locally">
            <input className="settings-input" value={settings.model}
              onChange={e => set('model', e.target.value)} placeholder="e.g. llama3.2"/>
          </Row>
          <Row label="Proactive mode" hint="AI initiates based on context">
            <Toggle value={settings.proactiveMode} onChange={v => set('proactiveMode', v)}/>
          </Row>
          <Row label="Wake word" hint="Say this to activate ARIA">
            <input className="settings-input" value={settings.wakeWord}
              onChange={e => set('wakeWord', e.target.value)} placeholder="Hey ARIA"/>
          </Row>
        </Section>

        <Section title="Storage">
          <Row label="Priority" hint="Local device storage is always used first">
            <select className="settings-select" value={settings.storageMode} onChange={e => set('storageMode', e.target.value)}>
              <option value="local">Local only (private, offline)</option>
              <option value="cloud">Cloud only (MongoDB Atlas)</option>
              <option value="both">Local + Cloud (sync)</option>
            </select>
          </Row>
          <Row label="Persistent storage" hint="Ask browser for guaranteed local storage">
            <button className="settings-action-btn" onClick={requestStoragePermission}>Request Permission</button>
          </Row>
          <Row label="Clear conversation log" hint="Removes all stored messages">
            <button className="settings-action-btn danger" onClick={() => {
              if (confirm('Clear all conversation history?')) {
                localStorage.removeItem('aria_conversation_log');
                alert('Cleared.');
              }
            }}>Clear Log</button>
          </Row>
        </Section>

        <div className="settings-footer">
          <button className="settings-save-btn" onClick={handleSave}>
            {saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
