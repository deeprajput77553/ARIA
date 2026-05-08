import React, { useState } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import Navbar from './components/Navbar';
import Orb from './components/Orb';
import DNAChat from './components/DNAChat';
import AuthPage from './components/AuthPage';
import './App.css';

function App() {
  const [screen, setScreen] = useState('welcome'); // welcome | orb | chat | signin | signup
  const [authMode, setAuthMode] = useState('signin');

  const afterWelcome = () => setScreen('orb');

  const navigate = (page) => {
    if (page === 'signin' || page === 'signup') {
      setAuthMode(page);
      setScreen('auth');
    } else {
      setScreen(page);
    }
  };

  if (screen === 'welcome') {
    return <WelcomeScreen onComplete={afterWelcome}/>;
  }

  if (screen === 'auth') {
    return (
      <AuthPage
        mode={authMode}
        onSwitch={() => setAuthMode(m => m === 'signin' ? 'signup' : 'signin')}
      />
    );
  }

  return (
    <div className="app-shell">
      <Navbar
        currentPage={screen}
        onNavigate={navigate}
      />
      <main className="app-main">
        {screen === 'orb'  && <Orb/>}
        {screen === 'chat' && <DNAChat/>}
      </main>
    </div>
  );
}

export default App;
