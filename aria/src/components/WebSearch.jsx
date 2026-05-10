import React, { useState, useEffect } from 'react';
import { IoSearch, IoImageOutline, IoBookOutline, IoGlobeOutline, IoArrowForward } from 'react-icons/io5';
import DNALoader from './DNALoader';
import './WebSearch.css';

const WebSearch = () => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('web'); // web, images, wiki
  const [results, setResults] = useState({ web: [], images: [], wiki: null });
  const [loading, setLoading] = useState(false);
  const [imageIteration, setImageIteration] = useState(1);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [aiSummary, setAiSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  const downloadImage = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'aria-image.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      window.open(url, '_blank');
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults({ web: [], images: [], wiki: null });
    setImageIteration(1);

    try {
      if (activeTab === 'web') {
        const res = await fetch('http://localhost:3001/api/web/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        });
        const data = await res.json();
        setResults(prev => ({ ...prev, web: data }));
        
        // Fetch AI Summary for web search
        if (data && data.length > 0) {
          setSummaryLoading(true);
          try {
            const summaryRes = await fetch('http://localhost:3001/api/web/ai-summary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query, results: data })
            });
            const summaryData = await summaryRes.json();
            setAiSummary(summaryData.summary);
          } catch (e) { console.warn('AI Summary failed', e); }
          finally { setSummaryLoading(false); }
        }
      } else if (activeTab === 'images') {
        const res = await fetch('http://localhost:3001/api/web/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, iterations: 1 })
        });
        const data = await res.json();
        setResults(prev => ({ ...prev, images: data }));
      } else if (activeTab === 'wiki') {
        const res = await fetch('http://localhost:3001/api/web/wiki', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setResults(prev => ({ ...prev, wiki: data }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreImages = async () => {
    setLoading(true);
    const nextIter = imageIteration + 1;
    try {
      const res = await fetch('http://localhost:3001/api/web/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, iterations: nextIter })
      });
      const data = await res.json();
      setResults(prev => ({ ...prev, images: [...prev.images, ...data] }));
      setImageIteration(nextIter);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (query) handleSearch();
  }, [activeTab]);

  return (
    <div className="web-search-container">
      <header className="search-header">
        <form onSubmit={handleSearch} className="search-bar-container">
          <IoSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search the web with ARIA..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-button">Search</button>
        </form>

        <nav className="search-tabs">
          <button 
            className={`search-tab ${activeTab === 'web' ? 'active' : ''}`}
            onClick={() => setActiveTab('web')}
          >
            <IoGlobeOutline /> Web
          </button>
          <button 
            className={`search-tab ${activeTab === 'images' ? 'active' : ''}`}
            onClick={() => setActiveTab('images')}
          >
            <IoImageOutline /> Images
          </button>
          <button 
            className={`search-tab ${activeTab === 'wiki' ? 'active' : ''}`}
            onClick={() => setActiveTab('wiki')}
          >
            <IoBookOutline /> Wikipedia
          </button>
        </nav>
      </header>

      <main className="search-results-content">
        {loading && (
          <div className="loading-container">
            <DNALoader size={180} />
            <div className="loading-text">ARIA is synthesizing results...</div>
          </div>
        )}
        {error && <div className="error-message">Error: {error}</div>}

        {!loading && !error && activeTab === 'web' && (
          <div className="web-results-container">
            {(aiSummary || summaryLoading) && (
              <div className="ai-overview-box">
                <div className="ai-overview-header">
                  <div className="ai-pulse-dot" />
                  <span>ARIA AI OVERVIEW</span>
                </div>
                {summaryLoading ? (
                  <div className="typing-cursor">Analyzing results and synthesizing intelligence...</div>
                ) : (
                  <div className="ai-summary-text">{aiSummary}</div>
                )}
              </div>
            )}

            <div className="web-results">
              {results.web.map((res, i) => (
                <div key={i} className="web-result-card">
                  <div className="result-main">
                    <a href={res.url} target="_blank" rel="noopener noreferrer" className="result-title">
                      {res.title}
                    </a>
                    <div className="result-meta">
                      <span className="result-hostname">{res.hostname}</span>
                      {res.date && <span className="result-date">• {res.date}</span>}
                    </div>
                    <p className="result-description">{res.description || 'No description available for this source.'}</p>
                  </div>
                  <div className="result-actions">
                    <IoArrowForward className="arrow-icon" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && !query && (
          <div className="search-welcome-container">
            <div className="welcome-glow" />
            <div className="welcome-content">
              <div className="welcome-icon">
                <IoGlobeOutline />
              </div>
              <h1>Explore the Neural Web</h1>
              <p>Search across billions of sources with ARIA's synthesized intelligence.</p>
              
              <div className="search-suggestions">
                <span>Try searching:</span>
                <div className="suggestion-chips">
                  {['Quantum Computing', 'Black Holes', 'World Cup 2026', 'Cyberpunk 2077', 'Elon Musk'].map(tag => (
                    <button key={tag} onClick={() => {
                      setQuery(tag);
                      // Trigger search immediately
                      const e = { preventDefault: () => {} };
                      setResults({ web: [], images: [], wiki: null });
                      setLoading(true);
                      fetch(`http://localhost:3001/api/web/search`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: tag })
                      }).then(res => res.json()).then(data => {
                        setResults(prev => ({ ...prev, web: data }));
                        setLoading(false);
                        // Trigger AI summary too
                        fetch('http://localhost:3001/api/web/ai-summary', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ query: tag, results: data })
                        }).then(res => res.json()).then(sData => setAiSummary(sData.summary));
                      });
                    }}>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && query && results.web.length === 0 && results.images.length === 0 && !results.wiki && (
          <div className="empty-state-container">
            <div className="empty-icon">
              <IoSearch />
            </div>
            <h3>No intelligence found for "{query}"</h3>
            <p>Try refining your query or checking your spelling.</p>
          </div>
        )}

        {!loading && !error && activeTab === 'images' && (
          <div className="image-results-container">
            <div className="image-grid">
              {results.images.map((img, i) => (
                <div key={i} className="image-card" onClick={() => setSelectedImage(img)}>
                  <img 
                    src={`http://localhost:3001/api/web/proxy?url=${encodeURIComponent(img.image)}`} 
                    alt={img.title} 
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div className="image-overlay">
                    <span className="image-title">{img.title}</span>
                    <div className="image-actions">
                      <span className="image-source-tag">Source: {img.hostname || 'Web'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {results.images.length > 0 && (
              <button onClick={loadMoreImages} className="load-more-btn" disabled={loading}>
                {loading ? 'Loading...' : 'Load More Images'}
              </button>
            )}
            {results.images.length === 0 && !loading && <div className="empty-state">No images found.</div>}
          </div>
        )}

        {!loading && !error && activeTab === 'wiki' && results.wiki && (
          <div className="wiki-result">
            <div className="wiki-card">
              {results.wiki.thumbnail && (
                <img src={results.wiki.thumbnail.source} alt={results.wiki.title} className="wiki-image" />
              )}
              <div className="wiki-content">
                <h2>{results.wiki.title}</h2>
                <p>{results.wiki.extract}</p>
                <a href={results.wiki.content_urls.desktop.page} target="_blank" rel="noopener noreferrer" className="wiki-link">
                  Read full article on Wikipedia <IoArrowForward />
                </a>
              </div>
            </div>
          </div>
        )}
      </main>

      {selectedImage && (
        <div className="image-modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="image-modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedImage(null)}>×</button>
            <div className="modal-image-wrapper">
              <img 
                src={`http://localhost:3001/api/web/proxy?url=${encodeURIComponent(selectedImage.image)}`} 
                alt={selectedImage.title} 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="image-modal-footer">
              <div className="modal-info">
                <h3>{selectedImage.title}</h3>
                <p>{selectedImage.hostname}</p>
              </div>
              <div className="modal-buttons">
                <button 
                  className="download-btn"
                  onClick={() => downloadImage(selectedImage.image, `${selectedImage.title}.jpg`)}
                >
                  Download Image
                </button>
                <a href={selectedImage.url} target="_blank" rel="noopener noreferrer" className="source-btn">
                  Visit Source
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebSearch;
