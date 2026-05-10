import { useState, useEffect, useCallback } from 'react';
import { loadSettings } from '../components/SettingsPage';

export const useOllama = () => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [model, setModel] = useState(() => loadSettings().model || 'llama3.2');

  useEffect(() => {
    const checkOllama = async () => {
      try {
        const res = await fetch('http://localhost:11434/api/tags', { method: 'GET' });
        if (res.ok) {
          const data = await res.json();
          setIsAvailable(true);
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
      const res = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          model, 
          messages: [{ role: 'user', content: prompt }], 
          stream: true 
        })
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
            if (j.message?.content) {
              full += j.message.content;
              onChunk(full);
            }
            if (j.done) onDone(full);
          } catch {}
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      onDone(null, err);
    }
  }, [model]);

  return { isAvailable, model, chat };
};
