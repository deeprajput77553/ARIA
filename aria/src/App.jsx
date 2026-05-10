import React, { useState } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import Navbar from './components/Navbar';
import Orb from './components/Orb';
import Logs from './components/Logs';
import Chat from './components/Chat';
import Dashboard from './components/Dashboard';
import AuthPage from './components/AuthPage';
import SettingsPage from './components/SettingsPage';
import GlobalAgentState from './components/GlobalAgentState';
import { proactiveEngine } from './engine/ProactiveEngine';
import './App.css';

function App() {
  const [screen, setScreen] = useState('welcome');
  const [authMode, setAuthMode] = useState('signin');

  React.useEffect(() => {
    proactiveEngine.start();
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
    return () => proactiveEngine.stop();
  }, []);

  const navigate = (page) => {
    if (page === 'signin' || page === 'signup') { 
      setAuthMode(page); 
      setScreen('auth'); 
    } else {
      setScreen(page);
    }
  };

  if (screen === 'welcome') return <WelcomeScreen onComplete={() => setScreen('orb')}/>;
  if (screen === 'auth')    return <AuthPage mode={authMode} onSwitch={() => setAuthMode(m=>m==='signin'?'signup':'signin')}/>;

  return (
    <div className="app-shell" style={{ display: 'flex', flexDirection: 'row', height: '100vh', overflow: 'hidden' }}>
      <Navbar currentPage={screen} onNavigate={navigate}/>
      <main className="app-main" style={{ flex: 1, position: 'relative' }}>
        {screen === 'orb'      && <Orb onNavigate={navigate}/>}
        {screen === 'chat'     && <Chat onNavigate={navigate}/>}
        {screen === 'logs'     && <Logs/>}
        {screen === 'dashboard' && <Dashboard/>}
        {screen === 'settings' && <SettingsPage/>}
        <GlobalAgentState />
      </main>
    </div>
  );
}

export default App;
