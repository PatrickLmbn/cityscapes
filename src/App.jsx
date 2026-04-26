import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Loader2, MousePointer2, ZoomIn, Hand, HelpCircle, X, Zap, Heart, Layers, AlertCircle, Edit3 } from 'lucide-react';
import CityScene from './components/CityScene';
import { analyzeThought, getRateLimitStatus, analyzeComment, initRateLimit } from './utils/aiAnalyze';
import { supabase } from './utils/supabase';

// Helper to map camelCase building to snake_case for Supabase
const mapBuildingForDB = (b, visitorId) => ({
  id: b.id,
  text: b.text,
  label: b.label,
  theme: b.theme,
  secondary_theme: b.secondaryTheme,
  avatar_type: b.avatarType || 'building',
  height: b.height,
  width: b.width,
  depth: b.depth,
  x: b.x,
  z: b.z,
  windowColor: b.windowColor,
  secondary_color: b.secondaryColor,
  mixed_ratio: b.mixedRatio,
  windowBrightness: b.windowBrightness,
  intensity: b.intensity,
  valence: b.valence,
  complexity: b.complexity,
  visitor_id: visitorId,
  timestamp: b.timestamp
});

// Helper to map snake_case from DB back to camelCase for the UI
const mapDBToBuilding = (b) => ({
  id: b.id,
  text: b.text,
  label: b.label,
  theme: b.theme,
  secondaryTheme: b.secondary_theme,
  avatarType: b.avatar_type || 'building',
  height: b.height,
  width: b.width,
  depth: b.depth,
  x: b.x,
  z: b.z,
  windowColor: b.windowColor,
  secondaryColor: b.secondary_color,
  mixedRatio: Number(b.mixed_ratio || 0),
  windowBrightness: b.windowBrightness,
  intensity: b.intensity,
  valence: b.valence,
  complexity: b.complexity,
  timestamp: b.timestamp || Date.now()
});

const COLOR_LEGEND = [
  { theme: 'Hopes', color: '#ffffff', reason: 'Pure white = a blank canvas, a new dawn. The color of unwritten dreams and absolute clarity.' },
  { theme: 'Ambition', color: '#ffc947', reason: 'Gold = wealth, power, achievement. The color of trophies and success.' },
  { theme: 'Joy', color: '#00ffcc', reason: 'Electric cyan = alive and energetic. The feeling of a cool breeze on a clear day.' },
  { theme: 'Love', color: '#ff79a8', reason: 'Soft red = intimate and warm. Not aggressive, but deeply connected to passion.' },
  { theme: 'Peace', color: '#88ffbb', reason: 'Soft green = nature, growth, safety. Used in meditation to reduce tension.' },
  { theme: 'Nostalgia', color: '#ff9944', reason: 'Amber = old photographs, warm bulbs, sunsets. The color of the past.' },
  { theme: 'Anxiety', color: '#aa44ff', reason: 'Purple = tension between red (danger) and blue (sadness). Unease.' },
  { theme: 'Sadness', color: '#3a6ea8', reason: 'Muted blue = "feeling blue." Desaturated cool tones signal melancholy.' },
  { theme: 'Fear', color: '#ff6600', reason: 'Orange = warning signs & hazard tape. Dread and suspense, not outright danger.' },
  { theme: 'Rage', color: '#ff2233', reason: 'Bright red = raises heart rate, signals immediate danger. "Seeing red."' },
  { theme: 'Hate', color: '#cc0011', reason: 'Dark cold red = sustained, not explosive. Hate lingers like dried blood.' },
];

const MAX_CHARS = 140;

function App() {
  const [buildings, setBuildings] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [selected, setSelected] = useState(null);
  const [rateMsg, setRateMsg] = useState(null);
  const [tokenCount, setTokenCount] = useState(getRateLimitStatus().tokens);
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [avatar, setAvatar] = useState('building');
  const [isInputActive, setIsInputActive] = useState(false);

  const AVATARS = [
    { id: 'building', label: 'Building', icon: Layers },
    { id: 'person', label: 'Person', icon: Heart },
    { id: 'car', label: 'Car', icon: Zap },
    { id: 'stoplight', label: 'Stoplight', icon: AlertCircle },
    { id: 'lamp', label: 'Lamp Post', icon: MousePointer2 }
  ];

  // Auto-hide controls hint after 6 s
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 12000);
    return () => clearTimeout(t);
  }, []);

  // Filter comments for the selected building in the UI
  const activeComments = comments.filter(c => c.building_id === selected?.id);

  // Fetch comments logic removed from local useEffect, handled by global comments prop now
  // (We'll just rely on the prop 'comments' filtered above)


  // Load city on mount
  useEffect(() => {
    async function loadData() {
      if (supabase) {
        // Fetch All Buildings
        const { data: bData } = await supabase
          .from('buildings')
          .select('*')
          .order('timestamp', { ascending: true });

        if (bData) {
          // Map snake_case keys back to camelCase for the frontend
          setBuildings(bData.map(mapDBToBuilding));
        }

        // Fetch All Comments
        const { data: cData } = await supabase
          .from('comments')
          .select('*')
          .order('timestamp', { ascending: true });

        if (cData) setComments(cData);
        return;
      }

      // Fallback
      const saved = localStorage.getItem('cityscapes-buildings');
      if (saved) {
        try { setBuildings(JSON.parse(saved)); } catch (e) { /* ignore parse error */ }
      }
    }

    loadData();
    // Sync rate limit with IP/Supabase
    initRateLimit().then(status => setTokenCount(status.tokens));

    // Update token count every 2 seconds to show refills
    const tokenTimer = setInterval(() => {
      setTokenCount(getRateLimitStatus().tokens);
    }, 2000);

    return () => clearInterval(tokenTimer);
  }, []);

  // Persist city to local storage
  useEffect(() => {
    if (buildings.length > 0) {
      localStorage.setItem('cityscapes-buildings', JSON.stringify(buildings));
    }
  }, [buildings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isAnalyzing) return;
    const text = inputValue.trim();
    setInputValue('');
    setIsAnalyzing(true);
    try {
      const newBuilding = await analyzeThought(text, buildings.length);
      newBuilding.avatarType = avatar;

      // Save to Supabase if available
      if (supabase) {
        const { visitorId } = getRateLimitStatus();
        const dbBuilding = mapBuildingForDB(newBuilding, visitorId);
        
        const { data, error } = await supabase
          .from('buildings')
          .insert([dbBuilding]);
        
        if (error) {
          console.error("Supabase Save Error (1st attempt):", error.message);
          
          // Try a bare-minimum insert in case columns are missing
          const fallback = {
            id: dbBuilding.id,
            text: dbBuilding.text,
            label: dbBuilding.label,
            theme: dbBuilding.theme,
            x: dbBuilding.x,
            z: dbBuilding.z,
            height: dbBuilding.height
          };
          
          const { error: error2 } = await supabase.from('buildings').insert([fallback]);
          if (error2) {
            console.error("Supabase Save Error (Fallback failed):", error2.message);
          }
        }
      }

      setBuildings(prev => [...prev, newBuilding]);
      setTokenCount(getRateLimitStatus().tokens);
    } catch (err) {
      if (err.name === 'RateLimitError') {
        setRateMsg(err.message);
        setInputValue(text); // restore so user doesn't lose their thought
        setTimeout(() => setRateMsg(null), (err.waitSec + 1) * 1000);
      }
    } finally {
      setIsAnalyzing(false);
      setIsInputActive(false); // Close after successful submission
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentInput.trim() || isPostingComment || !supabase || !selected) return;

    const text = commentInput.trim();
    setCommentInput('');
    setIsPostingComment(true);

    try {
      // Analyze sentiment of the reply
      const sentiment = await analyzeComment(text);

      const newComment = {
        building_id: selected.id,
        text,
        valence: sentiment.valence,
        intensity: sentiment.intensity,
        timestamp: Date.now()
      };

      const { data, error } = await supabase
        .from('comments')
        .insert([newComment])
        .select();

      if (!error && data) {
        setComments(prev => [...prev, ...data]);
        setTokenCount(getRateLimitStatus().tokens);
      }
    } catch (err) {
      // failed to post comment
    } finally {
      setIsPostingComment(false);
    }
  };

  const getCommentSense = (val) => {
    if (val >= 8) return { label: 'Hopes', color: '#ffffff' };
    if (val <= 3) return { label: 'Rage', color: '#ff2233' };
    return { label: 'neutral', color: 'rgba(255,255,255,0.4)' };
  };

  const timeAgo = (ts) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <>
      <div className="ui-overlay">
        <div className="brand">CITYVOID</div>

        {/* Controls hint */}
        <div className={`controls-hint ${showHint ? 'visible' : ''}`}>
          <div className="hint-item"><Hand size={13} /> Left-Click + Drag to Move City</div>
          <div className="hint-item"><MousePointer2 size={13} /> Right-Click + Drag to Rotate View</div>
          <div className="hint-item"><ZoomIn size={13} /> Scroll to Zoom In/Out</div>
        </div>

        {/* Rate limit toast */}
        {rateMsg && (
          <div className="rate-toast">
            <AlertCircle size={14} />
            <span>{rateMsg}</span>
          </div>
        )}

        {/* Building detail card */}
        {selected && (
          <div className="detail-card" style={{ '--card-color': selected.windowColor }}>
            <button className="detail-close" onClick={() => setSelected(null)}>
              <X size={15} />
            </button>

            <div className="detail-label" style={{ color: selected.windowColor }}>
              {selected.label}
            </div>
            <div className="detail-themes">
              <span className="detail-theme-badge" style={{ borderColor: selected.windowColor + '66', color: selected.windowColor }}>
                {selected.theme}
              </span>
              {selected.secondaryTheme && (
                <span className="detail-theme-badge" style={{ borderColor: selected.secondaryColor + '66', color: selected.secondaryColor }}>
                  {selected.secondaryTheme}
                </span>
              )}
            </div>

            <p className="detail-text">"{selected.text}"</p>

            <div className="detail-stats">
              <div className="detail-stat">
                <Zap size={11} style={{ color: selected.windowColor }} />
                <span>Intensity</span>
                <div className="stat-bar">
                  <div className="stat-fill" style={{ width: `${selected.intensity * 10}%`, background: selected.windowColor }} />
                </div>
                <span className="stat-val">{selected.intensity}/10</span>
              </div>
              <div className="detail-stat">
                <Heart size={11} style={{ color: selected.windowColor }} />
                <span>Positivity</span>
                <div className="stat-bar">
                  <div className="stat-fill" style={{ width: `${selected.valence * 10}%`, background: selected.windowColor }} />
                </div>
                <span className="stat-val">{selected.valence}/10</span>
              </div>
              {selected.avatarType === 'building' && (
                <div className="detail-stat detail-stat--inline">
                  <Layers size={11} style={{ color: selected.windowColor }} />
                  <span>{selected.floors} floors · {timeAgo(selected.timestamp)}</span>
                </div>
              )}
              {selected.avatarType !== 'building' && (
                <div className="detail-stat detail-stat--inline">
                  <span>{timeAgo(selected.timestamp)}</span>
                </div>
              )}
            </div>

            <div className="thread-section">
              <div className="thread-header">Thread</div>
              <div className="thread-list">
                {activeComments.length === 0 ? (
                  <div className="thread-empty">No responses yet. Be the first to echo.</div>
                ) : (
                  activeComments.map(c => (
                    <div key={c.id} className="thread-item">
                      <div className="thread-meta">
                        <span className="thread-time">{timeAgo(c.timestamp)}</span>
                        <span className="thread-sense" style={{ color: getCommentSense(c.valence).color }}>
                          {getCommentSense(c.valence).label}
                        </span>
                      </div>
                      <div className="thread-text">{c.text}</div>
                    </div>
                  ))
                )}
              </div>

              <form className="thread-form" onSubmit={handlePostComment}>
                <div className="thread-input-wrapper">
                  <input
                    className="thread-input"
                    placeholder="Reply to this thought..."
                    value={commentInput}
                    onChange={e => setCommentInput(e.target.value)}
                    disabled={isPostingComment}
                    maxLength={MAX_CHARS}
                  />
                  <div className="char-counter char-counter--thread">
                    {commentInput.length}/{MAX_CHARS}
                  </div>
                </div>
                <button className="thread-submit" disabled={!commentInput.trim() || isPostingComment}>
                  {isPostingComment ? <Loader2 size={12} className="spinning" /> : <Send size={12} />}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Color legend panel */}
        {showLegend && (
          <div className="legend-panel">
            <div className="legend-header">
              <span className="legend-title">How emotions become light</span>
              <button className="legend-close" onClick={() => setShowLegend(false)}>
                <X size={15} />
              </button>
            </div>
            <p className="legend-subtitle">Each thought's window color is determined by its emotional theme.</p>
            <div className="legend-list">
              {COLOR_LEGEND.map(({ theme, color, reason }) => (
                <div className="legend-row" key={theme}>
                  <span className="legend-swatch" style={{ background: color }} />
                  <div className="legend-text">
                    <span className="legend-theme" style={{ color }}>{theme}</span>
                    <span className="legend-reason">{reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mobile Pencil Trigger */}
        <button 
          className={`mobile-input-trigger ${isInputActive ? 'hidden' : ''}`}
          onClick={() => setIsInputActive(true)}
        >
          <Edit3 size={24} />
        </button>

        <div className={`mobile-utility-cluster ${isInputActive ? 'hidden' : ''}`}>
          <div className="token-counter" title={`Visitor ID: ${getRateLimitStatus().visitorId || 'Loading...'}\nYour limit persists across refreshes.`}>
            <Zap size={14} />
            <span>{tokenCount}</span>
          </div>

          <button
            className={`legend-btn ${showLegend ? 'active' : ''}`}
            onClick={() => setShowLegend(v => !v)}
            title="How do emotions become colors?"
          >
            <HelpCircle size={18} />
          </button>
        </div>

        <div className={`input-section-container ${isInputActive ? 'active' : ''}`}>
          {isInputActive && (
            <button className="input-close-mobile" onClick={() => setIsInputActive(false)}>
              <X size={20} />
            </button>
          )}

          <div className="avatar-selection">
            <label className="avatar-label">Manifest As</label>
            <select 
              className="avatar-select"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
            >
              {AVATARS.map(a => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>

          <div className="input-row">
            <form className="input-container" onSubmit={handleSubmit}>
              {isAnalyzing
                ? <Loader2 className="input-icon spinning" size={20} />
                : <MessageSquare className="input-icon" size={20} />
              }
              <div className="thought-input-wrapper">
                <input
                  type="text"
                  className="thought-input"
                  placeholder={isAnalyzing ? 'Building your city...' : 'Share a thought...'}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  disabled={isAnalyzing}
                  autoFocus={isInputActive}
                  maxLength={MAX_CHARS}
                />
                <div className="char-counter">
                  {inputValue.length}/{MAX_CHARS}
                </div>
              </div>
              <button type="submit" className="submit-btn" disabled={!inputValue.trim() || isAnalyzing}>
                <Send size={20} />
              </button>
            </form>

            <div className="desktop-utility-cluster">
              <div className="token-counter" title={`Visitor ID: ${getRateLimitStatus().visitorId || 'Loading...'}\nYour limit persists across refreshes.`}>
                <Zap size={14} />
                <span>{tokenCount}</span>
              </div>

              <button
                className={`legend-btn ${showLegend ? 'active' : ''}`}
                onClick={() => setShowLegend(v => !v)}
                title="How do emotions become colors?"
              >
                <HelpCircle size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <CityScene buildings={buildings} comments={comments} onSelect={setSelected} />
    </>
  );
}

export default App;
