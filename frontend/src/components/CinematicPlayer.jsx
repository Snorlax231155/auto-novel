import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, 
  Menu, 
  BookOpen, 
  Volume2, 
  VolumeX, 
  Clock, 
  Play, 
  Pause,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import SaveLoadScreen from './SaveLoadScreen';

function CinematicPlayer({ apiBase, onExit }) {
  const [scene, setScene] = useState(null);
  const [inputText, setInputText] = useState("");
  const [typedText, setTypedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  
  // Controls
  const [autoPlay, setAutoPlay] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSaveLoad, setShowSaveLoad] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingNext, setLoadingNext] = useState(false);
  
  const typewriterTimer = useRef(null);
  const websocket = useRef(null);
  const autoPlayTimer = useRef(null);

  useEffect(() => {
    // 1. Fetch current story state
    fetchCurrentState();
    
    // 2. Connect WebSocket for state broadcasts
    connectWebSocket();

    return () => {
      if (typewriterTimer.current) clearInterval(typewriterTimer.current);
      if (autoPlayTimer.current) clearTimeout(autoPlayTimer.current);
      if (websocket.current) websocket.current.close();
    };
  }, []);

  // Handle auto-advance
  useEffect(() => {
    if (autoPlay && !isTyping && scene && !loadingNext) {
      autoPlayTimer.current = setTimeout(() => {
        handleAdvanceStory("continue the story naturally");
      }, 3500); // 3.5s delay
    } else {
      if (autoPlayTimer.current) clearTimeout(autoPlayTimer.current);
    }
  }, [autoPlay, isTyping, scene, loadingNext]);

  const connectWebSocket = () => {
    const wsUrl = `ws://${apiBase.replace("http://", "")}/ws/story`;
    websocket.current = new WebSocket(wsUrl);
    
    websocket.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === "status" && data.status === "generating") {
          setLoadingNext(true);
        } else if (data.event === "scene_update") {
          setLoadingNext(false);
          const newScene = data.scene;
          setScene(newScene);
          startTypewriter(newScene.dialogue || newScene.narration || "");
          fetchHistory();
        }
      } catch (e) {
        console.error("WS parse error:", e);
      }
    };

    websocket.current.onclose = () => {
      console.log("WS closed. Reconnecting in 3s...");
      setTimeout(connectWebSocket, 3000);
    };
  };

  const fetchCurrentState = async () => {
    try {
      const res = await fetch(`${apiBase}/api/story/state`);
      const data = await res.json();
      setScene(data);
      setHistory(data.scene_history || []);
      
      const activeText = data.current_dialogue || data.current_narration || "The visual novel awaits your direction...";
      startTypewriter(activeText);
    } catch (e) {
      console.error("Error loading active state:", e);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${apiBase}/api/story/state`);
      const data = await res.json();
      setHistory(data.scene_history || []);
    } catch (e) {
      console.error(e);
    }
  };

  const startTypewriter = (text) => {
    if (typewriterTimer.current) clearInterval(typewriterTimer.current);
    setIsTyping(true);
    setTypedText("");
    
    let index = 0;
    typewriterTimer.current = setInterval(() => {
      if (index < text.length) {
        setTypedText((prev) => prev + text.charAt(index));
        index++;
      } else {
        clearInterval(typewriterTimer.current);
        setIsTyping(false);
      }
    }, 20); // 20ms typing delay
  };

  const skipTypewriter = () => {
    if (typewriterTimer.current) clearInterval(typewriterTimer.current);
    const text = scene?.current_dialogue || scene?.current_narration || scene?.dialogue || scene?.narration || "";
    setTypedText(text);
    setIsTyping(false);
  };

  const handleAdvanceStory = async (directionText = "") => {
    const prompt = directionText || inputText || "continue the story";
    setInputText("");
    setLoadingNext(true);
    setAutoPlay(false); // Stop autoplay when user inputs a custom action

    try {
      const res = await fetch(`${apiBase}/api/story/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      if (data.status === "success") {
        setScene(data.scene);
        startTypewriter(data.scene.dialogue || data.scene.narration || "");
        fetchHistory();
      }
    } catch (e) {
      console.error("Error advancing story:", e);
    } finally {
      setLoadingNext(false);
    }
  };

  // Get active image urls
  const getBgUrl = () => {
    const bg = scene?.current_bg || scene?.bg_image;
    if (bg) return `${apiBase}/assets/${bg}`;
    return null;
  };

  const getSpriteUrl = () => {
    const sprite = scene?.current_sprite || scene?.character_sprite;
    if (sprite) return `${apiBase}/assets/${sprite}`;
    return null;
  };

  // Render camera framing scale
  const getCameraClass = () => {
    const framing = scene?.current_camera || scene?.camera_framing || 'medium';
    switch (framing) {
      case 'close-up':
        return 'scale-125 translate-y-[-5%]';
      case 'wide':
        return 'scale-95';
      case 'pan-left':
        return 'scale-110 translate-x-[-8%]';
      case 'pan-right':
        return 'scale-110 translate-x-[8%]';
      case 'shake':
        return 'animate-shake scale-105';
      default:
        return 'scale-100';
    }
  };

  const isNarrator = !scene?.current_speaker || scene?.current_speaker === "Narrator";

  return (
    <div className="relative w-screen h-screen bg-theme-dark overflow-hidden flex flex-col justify-between">
      {/* Background Layer with cinematic framing transitions */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {getBgUrl() ? (
          <img 
            src={getBgUrl()} 
            alt="Scene Background" 
            className={`w-full h-full object-cover transition-all duration-1000 ease-out ${getCameraClass()}`} 
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-indigo-950 via-slate-900 to-black transition-all duration-1000" />
        )}
        <div className="absolute inset-0 bg-black/35 z-10" /> {/* Ambient overlay */}
      </div>

      {/* Character Sprite Layer */}
      <div className="absolute inset-0 z-20 flex justify-center items-end pointer-events-none pb-48 overflow-hidden">
        {getSpriteUrl() && (
          <img
            src={getSpriteUrl()}
            alt={scene?.current_speaker || "Character Sprite"}
            className={`h-[78vh] object-contain sprite-transition select-none drop-shadow-[0_15px_40px_rgba(0,0,0,0.65)] ${
              scene?.current_camera === 'close-up' ? 'scale-125 translate-y-8' : 'scale-100'
            }`}
          />
        )}
      </div>

      {/* Floating Header UI */}
      <header className="relative z-30 p-5 flex justify-between items-center pointer-events-auto">
        <div className="flex gap-2">
          <button 
            onClick={onExit}
            className="glass-panel text-slate-300 hover:text-slate-100 px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-md"
          >
            <Menu className="w-3.5 h-3.5" /> Return Menu
          </button>
          
          <button 
            onClick={() => setShowSaveLoad(true)}
            className="glass-panel text-slate-300 hover:text-slate-100 px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-md"
          >
            Saves
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="glass-panel text-slate-300 hover:text-slate-100 p-2.5 rounded-lg transition-all"
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-theme-accent" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button 
            onClick={() => setShowHistory(true)}
            className="glass-panel text-slate-300 hover:text-slate-100 p-2.5 rounded-lg transition-all"
          >
            <Clock className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Latency Debug timers overlay (on the side) */}
      <div className="absolute right-5 top-24 z-30 flex flex-col gap-2 pointer-events-none select-none">
        {scene?.text_time !== undefined && scene?.text_time !== null && (
          <div className="bg-slate-950/80 border border-slate-850 rounded-lg px-3 py-1.5 backdrop-blur-md text-[10px] text-slate-300 font-mono flex items-center gap-2 shadow-lg border-slate-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-450 animate-pulse"></span>
            <span>LLM: {scene.text_time}s</span>
          </div>
        )}
        {scene?.image_time !== undefined && scene?.image_time !== null && scene?.image_time > 0 ? (
          <div className="bg-slate-950/80 border border-slate-850 rounded-lg px-3 py-1.5 backdrop-blur-md text-[10px] text-slate-300 font-mono flex items-center gap-2 shadow-lg border-slate-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-450 animate-pulse"></span>
            <span>IMG: {scene.image_time}s</span>
          </div>
        ) : null}
      </div>

      {/* Bottom Interface HUD (Textbox and Input Control) */}
      <footer className="relative z-30 w-full max-w-4xl mx-auto px-4 pb-6 mt-auto">
        {/* Dialogue Name placard (only if speaking character present) */}
        {!isNarrator && (
          <div className="glass-panel w-fit px-5 py-1.5 rounded-t-lg border-b-0 border border-slate-700/60 shadow-lg textbox-glow">
            <span className="text-sm font-serif font-bold text-theme-accent tracking-wide uppercase">
              {scene?.current_speaker}
            </span>
            <span className="text-[10px] text-theme-muted ml-2.5 italic">
              ({scene?.current_emotion || "neutral"})
            </span>
          </div>
        )}

        {/* Text Area Card with Typewriter display */}
        <div 
          onClick={isTyping ? skipTypewriter : undefined}
          className={`glass-panel p-6 rounded-xl border border-slate-700/60 shadow-2xl textbox-glow cursor-pointer relative min-h-28 flex flex-col justify-between ${
            isNarrator ? 'rounded-tl-xl' : 'rounded-tl-none'
          }`}
        >
          {loadingNext ? (
            <div className="flex items-center gap-3 py-4 text-slate-400">
              <Sparkles className="w-5 h-5 text-theme-accent animate-spin" />
              <span className="text-xs uppercase tracking-widest opacity-80">AI is drafting next scene step...</span>
            </div>
          ) : (
            <p className={`text-slate-100 text-[15px] leading-relaxed select-text font-sans ${
              isNarrator ? 'italic text-slate-300 font-serif' : ''
            }`}>
              {typedText}
            </p>
          )}

          {/* Quick HUD controls at bottom-right inside textbox */}
          <div className="flex justify-end gap-3 mt-4 text-[10px] text-theme-muted uppercase tracking-wider select-none">
            <button 
              onClick={(e) => { e.stopPropagation(); setAutoPlay(!autoPlay); }}
              className={`hover:text-slate-100 flex items-center gap-1 ${autoPlay ? 'text-theme-accent font-semibold' : ''}`}
            >
              {autoPlay ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />} Auto
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleAdvanceStory("fast forward story beats"); }}
              className="hover:text-slate-100"
            >
              Skip
            </button>
            {isTyping && (
              <span className="animate-pulse text-theme-accent">▼</span>
            )}
          </div>
        </div>

        {/* Custom Direction Orchestration Panel */}
        <div className="mt-4 flex gap-3">
          <input
            type="text"
            placeholder="Type story direction (e.g. 'Ask him about his family', 'Look around the classroom')..."
            value={inputText}
            disabled={loadingNext}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdvanceStory(); }}
            className="flex-1 glass-panel text-sm px-4 py-3 rounded-lg text-slate-100 placeholder-slate-500 border border-slate-700/60 focus:outline-none focus:border-theme-accent/50"
          />
          
          <button
            onClick={() => handleAdvanceStory()}
            disabled={loadingNext || isTyping}
            className="bg-theme-accent text-theme-dark font-semibold px-5 py-3 rounded-lg shadow-lg hover:bg-amber-400 hover:shadow-amber-500/10 transition-all flex items-center gap-2 text-sm shrink-0"
          >
            Advance <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {/* MODAL: History Log */}
      {showHistory && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-center items-center p-8">
          <div className="glass-panel w-full max-w-2xl h-[70vh] rounded-xl flex flex-col p-6 border border-slate-800 animate-slide-up">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
              <h3 className="font-serif text-lg font-bold text-slate-200 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-theme-accent" /> Scene History Transcript
              </h3>
              <button 
                onClick={() => setShowHistory(false)}
                className="text-slate-400 hover:text-slate-200 text-sm px-3 py-1 rounded bg-slate-900"
              >
                Close
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 text-sm leading-relaxed">
              {history.length === 0 ? (
                <p className="text-theme-muted text-center italic py-10">No transcript entries recorded yet.</p>
              ) : (
                history.map((h, i) => (
                  <div key={i} className="border-b border-slate-900 pb-3">
                    <span className="font-serif font-bold text-theme-accent text-xs tracking-wider uppercase block">
                      {h.speaker || "Narrator"}
                    </span>
                    <p className={`mt-1 ${h.speaker === 'Narrator' ? 'italic text-slate-400' : 'text-slate-200'}`}>
                      {h.dialogue || h.narration}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Save / Load overlay inside game */}
      {showSaveLoad && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex justify-center items-center p-10">
          <div className="relative w-full max-w-4xl glass-panel rounded-xl p-8 border border-slate-800 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
              <h3 className="font-serif text-xl font-bold">Manage Game Save Slots</h3>
              <button 
                onClick={() => setShowSaveLoad(false)}
                className="text-slate-400 hover:text-slate-200 text-sm px-4 py-1.5 rounded bg-slate-900 border border-slate-800"
              >
                Back to Story
              </button>
            </div>
            <SaveLoadScreen 
              apiBase={apiBase} 
              isLoadOnly={false} 
              onLoadSuccess={() => {
                setShowSaveLoad(false);
                fetchCurrentState();
              }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default CinematicPlayer;
