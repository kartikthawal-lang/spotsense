import React, { useState, useEffect } from 'react';

function App() {
  const [activeTab, setActiveTab] = useState('home'); // Tracks active page: home | map | ai | account
  const [lots, setLots] = useState([]);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Load interactive parking bay map arrays matrix context data
  const loadData = async () => {
    try {
      const res = await fetch('/api/lots');
      const data = await res.json();
      setLots(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Data loading failed configuration matrix", e);
    }
  };

  useEffect(() => {
    loadData();
    const loop = setInterval(loadData, 10000);
    return () => clearInterval(loop);
  }, []);

  // Toggle single parking slot availability statuses
  const toggleSlot = async (lotId, slotNum, currentStatus) => {
    const nextStatus = currentStatus === 'available' ? 'full' : 'available';
    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lot_id: lotId, slot_number: slotNum, status: nextStatus })
      });
      loadData();
    } catch (e) {
      alert("Error updating layout slot matrix configuration.");
    }
  };

  // Handle conversational Gemini advisor query inputs submissions
  const handleAiSubmit = async (e) => {
    e.preventDefault();
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    setAiAnswer('');
    
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: aiQuestion })
      });
      const data = await res.json();
      setAiAnswer(data.answer || data.error || "No response received.");
    } catch (err) {
      setAiAnswer("Failed to connect to the SpotSense AI Copilot engine layer.");
    } finally {
      setAiLoading(false);
    }
  };

  // Calculate global availability statistics metrics aggregates
  const getTotalSpots = () => lots.length * 10;
  const getAvailableSpots = () => {
    let count = 0;
    lots.forEach(lot => {
      Object.values(lot.slots || {}).forEach(status => {
        if (status === 'available') count++;
      });
    });
    return count;
  };

  return (
    <div className="app-wrapper">
      {/* Dynamic Main Viewport Screen Display Layer */}
      <div className="main-content-window" style={{ paddingBottom: '80px' }}>
        
        {/* TAB 1: HOME LANDING VIEW */}
        {activeTab === 'home' && (
          <div className="tab-pane-view">
            <header className="hero-section" style={{textAlign: 'center', margin: '20px 0'}}>
              <div className="logo-badge" style={{fontSize: '2rem', marginBottom: '10px'}}>📍 SpotSense</div>
              <h1>Smart Campus Parking</h1>
              <p className="subtitle" style={{color: '#94a3b8'}}>Real-time crowd-sourced vacancy maps optimized by Gemini AI.</p>
            </header>
            
            <div className="status-hero-card">
              <h3>Current Campus Traffic</h3>
              <div className="traffic-indicator status-avail" style={{background: '#22c55e', color: 'white', display: 'inline-block', padding: '4px 12px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 'bold', margin: '10px 0'}}>MODERATE CONGESTION</div>
              <div className="stats-counter-row">
                <div className="stat-box">
                  <span className="num-highlight">{getAvailableSpots()}</span>
                  <span className="lbl-text">Open Stalls</span>
                </div>
                <div className="stat-box">
                  <span className="num-highlight">{getTotalSpots()}</span>
                  <span className="lbl-text">Total Bays</span>
                </div>
              </div>
            </div>

            <div className="info-panel">
              <h4>💡 How to use SpotSense</h4>
              <ul>
                <li>Tap the <strong>Map Grid</strong> tab below to view active parking lot charts.</li>
                <li>Tap any individual parking slot square to claim or free a space manually.</li>
                <li>Stuck in traffic? Ask the <strong>AI Advisor</strong> tab for recommendations!</li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 2: INTERACTIVE PARKING SEAT GRID MAP MATRIX */}
        {activeTab === 'map' && (
          <div className="tab-pane-view">
            <h2 className="section-title">🚘 Live Stalls Layout Matrix</h2>
            <div className="legend-bar">
              <div className="legend-item"><div className="box green"></div> Open Spot</div>
              <div className="legend-item"><div className="box red"></div> Occupied Spot</div>
            </div>
            <div className="screen-indicator">🚗 CAMPUS DRIVEWAY MAIN ENTRANCE ROAD WAY</div>
            
            {lots.map(lot => (
              <div key={lot.id} className="lot-section">
                <div className="lot-title">{lot.name}</div>
                <div className="grid-map">
                  {Object.keys(lot.slots || {}).map(slotName => {
                    const status = lot.slots[slotName];
                    return (
                      <div 
                        key={slotName} 
                        className={`parking-stall ${status}`}
                        onClick={() => toggleSlot(lot.id, slotName, status)}
                      >
                        <span>{slotName}</span>
                        <span className="car-icon">{status === 'full' ? '🚘' : '⬜'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: GEMINI AI PARKING ADVISOR COPILOT VIEW */}
        {activeTab === 'ai' && (
          <div className="tab-pane-view">
            <h2 className="section-title">🤖 Gemini Congestion Copilot</h2>
            <p className="description-text" style={{color: '#94a3b8', marginBottom: '15px'}}>Ask our integrated AI assistant where to look for open spaces based on live parking layouts conditions.</p>
            
            <form onSubmit={handleAiSubmit} className="ai-chat-input-row">
              <input 
                type="text"
                placeholder="e.g., I'm heading to the library, where should I park?"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                className="ai-textbox-entry"
              />
              <button type="submit" className="ai-send-btn" disabled={aiLoading}>
                {aiLoading ? 'Thinking...' : 'Ask AI'}
              </button>
            </form>

            {(aiLoading || aiAnswer) && (
              <div className="ai-response-chat-bubble animate-popup">
                <div className="bubble-header-tag">🤖 SpotSense Advisor Bot</div>
                {aiLoading ? (
                  <div className="loading-dots-row">Reading live visual grid matrix state layers...</div>
                ) : (
                  <p className="bubble-body-text">{aiAnswer}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: STUDENT USER ACCOUNT PERMIT VIEW */}
        {activeTab === 'account' && (
          <div className="tab-pane-view">
            <h2 className="section-title">👤 Student Parking Passport</h2>
            <div className="profile-badge-card">
              <div className="avatar-placeholder">🚗</div>
              <h3>Kartik Sharma</h3>
              <p className="sub-profile-label" style={{color: '#94a3b8'}}>Campus Driver Tier ID</p>
              <div className="permit-tag-badge">PERMIT ZONE: B STANDARD</div>
            </div>

            <div className="rewards-metric-panel">
              <h4>🏆 Crowdsourcing Rank Balance</h4>
              <div className="points-row">
                <span className="pts-count">340 </span>
                <span className="pts-lbl" style={{color: '#eab308', fontWeight: 'bold'}}>Reporting Points Earned</span>
              </div>
              <p className="description-text" style={{marginTop:'8px', color: '#94a3b8'}}>You earned +10 points today for updates reported at Library Lot!</p>
            </div>
          </div>
        )}

      </div>

      {/* INSTAGRAM-STYLE FIXED BOTTOM APP NAVIGATION BAR DOCK */}
      <nav className="bottom-nav-dock-bar">
        <button className={`nav-tab-action ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
          <span className="nav-icon-glyph">🏠</span>
          <span className="nav-label-text">Home</span>
        </button>
        <button className={`nav-tab-action ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>
          <span className="nav-icon-glyph">🗺️</span>
          <span className="nav-label-text">Map Grid</span>
        </button>
        <button className={`nav-tab-action ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>
          <span className="nav-icon-glyph">🤖</span>
          <span className="nav-label-text">AI Copilot</span>
        </button>
        <button className={`nav-tab-action ${activeTab === 'account' ? 'active' : ''}`} onClick={() => setActiveTab('account')}>
          <span className="nav-icon-glyph">👤</span>
          <span className="nav-label-text">Profile</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
