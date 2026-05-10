import { loadSettings } from '../components/SettingsPage';

export function stopSpeaking() {
  window.speechSynthesis.cancel();
}

export function speak(text, settingsOverride) {
  const settings = settingsOverride || loadSettings();
  if (!settings?.voiceEnabled) return;
  
  const synth = window.speechSynthesis;
  synth.cancel();
  
  const doSpeak = () => {
    const utt = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    
    // 1. Try specified voice
    let chosen = settings?.voiceName ? voices.find(v => v.name === settings.voiceName) : null;
    
    // 2. Fallback to female keywords
    if (!chosen) {
      chosen = voices.find(v => 
        /samantha|victoria|karen|zira|google.*female|female|fiona|moira|tessa|veena/i.test(v.name) && 
        v.lang.startsWith('en')
      );
    }
    
    // 3. Fallback to any English voice
    if (!chosen) {
      chosen = voices.find(v => v.lang.startsWith('en-US')) || voices.find(v => v.lang.startsWith('en'));
    }
    
    if (chosen) utt.voice = chosen;
    utt.pitch = settings?.voicePitch ?? 1.15;
    utt.rate = settings?.voiceSpeed ?? 0.95;
    utt.volume = 1;
    
    synth.speak(utt);
  };

  if (synth.getVoices().length === 0) {
    synth.onvoiceschanged = () => {
      synth.onvoiceschanged = null;
      doSpeak();
    };
  } else {
    doSpeak();
  }
}
