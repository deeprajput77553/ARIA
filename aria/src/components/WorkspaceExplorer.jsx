import React, { useEffect, useState } from 'react';
import { FiFolder, FiFile, FiRefreshCw } from 'react-icons/fi';

const WorkspaceExplorer = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentDir, setCurrentDir] = useState('.');

  const loadFiles = async (dir = '.') => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/file/list?dir=${encodeURIComponent(dir)}`);
      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
        setCurrentDir(dir);
      }
    } catch (err) {
      console.error('Failed to load files:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  return (
    <div className="workspace-explorer">
      <div className="explorer-header">
        <h3>Project Workspace</h3>
        <button className="refresh-btn" onClick={() => loadFiles(currentDir)} disabled={loading}>
          <FiRefreshCw className={loading ? 'spinning' : ''} />
        </button>
      </div>
      
      <div className="explorer-path">
        <span>root</span>
        {currentDir !== '.' && currentDir.split('/').map((p, i) => (
          <span key={i}> / {p}</span>
        ))}
      </div>

      <div className="file-list">
        {currentDir !== '.' && (
          <div className="file-item folder" onClick={() => {
            const parts = currentDir.split('/');
            parts.pop();
            loadFiles(parts.join('/') || '.');
          }}>
            <FiFolder className="item-icon" />
            <span className="item-name">..</span>
          </div>
        )}
        {files.map((f, i) => (
          <div 
            key={i} 
            className={`file-item ${f.isDir ? 'folder' : 'file'}`}
            onClick={() => f.isDir && loadFiles(`${currentDir === '.' ? '' : currentDir + '/'}${f.name}`)}
          >
            {f.isDir ? <FiFolder className="item-icon" /> : <FiFile className="item-icon" />}
            <div className="item-info">
              <span className="item-name">{f.name}</span>
              {!f.isDir && <span className="item-size">{(f.size / 1024).toFixed(1)} KB</span>}
            </div>
          </div>
        ))}
        {files.length === 0 && !loading && <div className="empty-msg">Directory is empty</div>}
      </div>

      <style>{`
        .workspace-explorer {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 16px;
          display: flex; flex-direction: column; gap: 12px;
          height: 400px;
        }
        .explorer-header { display: flex; justify-content: space-between; align-items: center; }
        .explorer-header h3 { font-size: 16px; color: white; margin: 0; }
        .refresh-btn { background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; padding: 4px; border-radius: 4px; transition: all 0.2s; }
        .refresh-btn:hover { color: #a855f7; background: rgba(168, 85, 247, 0.1); }
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .explorer-path { font-size: 11px; color: rgba(255,255,255,0.3); font-family: monospace; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 4px; }

        .file-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; padding-right: 4px; }
        .file-list::-webkit-scrollbar { width: 4px; }
        .file-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 2px; }

        .file-item {
          display: flex; align-items: center; gap: 12px; padding: 8px 12px;
          border-radius: 8px; cursor: pointer; transition: all 0.2s;
          border: 1px solid transparent;
        }
        .file-item:hover { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.05); }
        .file-item.folder .item-icon { color: #a855f7; }
        .file-item.file .item-icon { color: #3b82f6; }
        .item-icon { font-size: 16px; }
        
        .item-info { display: flex; justify-content: space-between; align-items: center; flex: 1; }
        .item-name { font-size: 13px; color: rgba(255,255,255,0.8); }
        .item-size { font-size: 10px; color: rgba(255,255,255,0.2); }
        .empty-msg { text-align: center; color: rgba(255,255,255,0.2); font-size: 12px; margin-top: 40px; }
      `}</style>
    </div>
  );
};

export default WorkspaceExplorer;
