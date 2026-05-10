// Centralized Voice Utility for ARIA
let currentUtterance = null;

export const speak = (text, settings = {}) => {
  if (!window.speechSynthesis) return;

  // Stop any ongoing speech
  stopSpeaking();

  const utterance = new SpeechSynthesisUtterance(text);

  // Load settings
  const voiceEnabled = settings.voiceEnabled !== false;
  if (!voiceEnabled) return;

  // Try to find a high-quality female voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = ['Google US English', 'Microsoft Zira', 'Samantha', 'Victoria'];
  let selectedVoice = voices.find(v => preferred.some(p => v.name.includes(p)));

  if (!selectedVoice) {
    selectedVoice = voices.find(v => v.name.toLowerCase().includes('female')) || voices[0];
  }

  if (selectedVoice) utterance.voice = selectedVoice;
  utterance.rate = settings.voiceRate || 1.0;
  utterance.pitch = settings.voicePitch || 1.1;

  utterance.onend = () => {
    currentUtterance = null;
  };

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
};

export const stopSpeaking = () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
};
