import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Users, 
  BookOpen, 
  Settings, 
  Save, 
  ChevronRight,
  Sparkles,
  RefreshCw,
  LogOut
} from 'lucide-react';

import CinematicPlayer from './components/CinematicPlayer';
import CharacterStudio from './components/CharacterStudio';
import LorebookManager from './components/LorebookManager';
import AISettings from './components/AISettings';
import SaveLoadScreen from './components/SaveLoadScreen';

const API_BASE = "http://localhost:8000";

function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [globalSettings, setGlobalSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [storyActive, setStoryActive] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Load backend configurations at startup
  useEffect(() => {
    fetchSettings();
    checkStoryState();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings`);
      const data = await res.json();
      setGlobalSettings(data);
    } catch (e) {
      console.error("Error fetching settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const checkStoryState = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/story/state`);
      const data = await res.json();
      if (data.scene_history && data.scene_history.length > 0) {
        setStoryActive(true);
      } else {
        setStoryActive(false);
      }
    } catch (e) {
      console.error("Error checking story state:", e);
    }
  };

  const handleStartNewStory = async () => {
    setSyncing(true);
    try {
      await fetch(`${API_BASE}/api/story/reset`, { method: 'POST' });
      setStoryActive(true);
      setActiveView('player');
    } catch (e) {
      console.error("Error resetting story:", e);
    } finally {
      setSyncing(false);
    }
  };

  const handleContinueStory = () => {
    setActiveView('player');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-theme-dark text-slate-200">
        <Sparkles className="w-12 h-12 text-theme-accent animate-pulse-glow mb-4" />
        <p className="text-sm tracking-wider uppercase opacity-80">Bootstrapping VN Engine...</p>
      </div>
    );
  }

  // If in active fullscreen cinematic player mode, we hide the main shell navigation and let the player handle its own menu overlays
  if (activeView === 'player') {
    return (
      <CinematicPlayer 
        apiBase={API_BASE} 
        onExit={() => {
          checkStoryState();
          setActiveView('dashboard');
        }} 
      />
    );
  }

  return (
    <div className="flex h-screen bg-theme-dark text-slate-100 overflow-hidden font-sans">
      {/* Side Navigation Panel */}
      <aside className="w-64 glass-panel border-r border-slate-800 flex flex-col justify-between py-6 px-4">
        <div>
          {/* Header Branding */}
          <div className="flex items-center gap-3 px-2 mb-8">
            <div className="bg-gradient-to-tr from-theme-accent to-theme-secondary p-2 rounded-lg text-theme-dark">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-lg leading-tight tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-slate-100 to-slate-300">
                Antigravity VN
              </h1>
              <span className="text-[10px] text-theme-muted uppercase tracking-wider">AI Story Engine</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                activeView === 'dashboard' 
                  ? 'bg-gradient-to-r from-indigo-950 to-indigo-900 border-l-2 border-theme-accent text-slate-100' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Play className="w-4 h-4" />
                <span>Dashboard</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            <button
              onClick={() => setActiveView('characters')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                activeView === 'characters' 
                  ? 'bg-gradient-to-r from-indigo-950 to-indigo-900 border-l-2 border-theme-accent text-slate-100' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4" />
                <span>Character Studio</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            <button
              onClick={() => setActiveView('lorebook')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                activeView === 'lorebook' 
                  ? 'bg-gradient-to-r from-indigo-950 to-indigo-900 border-l-2 border-theme-accent text-slate-100' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <BookOpen className="w-4 h-4" />
                <span>Lore & Memory</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            <button
              onClick={() => setActiveView('saves')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                activeView === 'saves' 
                  ? 'bg-gradient-to-r from-indigo-950 to-indigo-900 border-l-2 border-theme-accent text-slate-100' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Save className="w-4 h-4" />
                <span>Saves Slots</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            <button
              onClick={() => setActiveView('settings')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                activeView === 'settings' 
                  ? 'bg-gradient-to-r from-indigo-950 to-indigo-900 border-l-2 border-theme-accent text-slate-100' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings className="w-4 h-4" />
                <span>AI Configuration</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </button>
          </nav>
        </div>

        {/* Footer info */}
        <div className="border-t border-slate-800/80 pt-4 px-2">
          <div className="flex items-center justify-between text-xs text-theme-muted">
            <span>Server Status</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Online
            </span>
          </div>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <main className="flex-1 overflow-y-auto px-10 py-8 relative bg-cinematic-glow bg-theme-dark">
        {activeView === 'dashboard' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            {/* Greeting Header */}
            <div>
              <h2 className="text-3xl font-serif font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-100 to-slate-300">
                Welcome to your visual novel workspace
              </h2>
              <p className="text-theme-muted mt-2 text-sm leading-relaxed">
                Generate, edit, and play immersive scene-based interactive stories driven by artificial intelligence.
              </p>
            </div>

            {/* Quick Actions Panel */}
            <div className="grid grid-cols-2 gap-6">
              <div className="glass-panel p-6 rounded-xl flex flex-col justify-between h-48 border border-slate-800">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-theme-accent">
                    <Sparkles className="w-5 h-5" /> Start New Journey
                  </h3>
                  <p className="text-theme-muted text-xs mt-2 leading-relaxed">
                    Wipe active scene progression logs and start a completely new story. Dynamic background generation and memory systems will adapt to your initial prompt.
                  </p>
                </div>
                <button
                  disabled={syncing}
                  onClick={handleStartNewStory}
                  className="w-fit bg-gradient-to-r from-theme-accent to-amber-600 hover:from-amber-500 hover:to-amber-700 text-theme-dark font-medium text-sm px-5 py-2.5 rounded-lg shadow-lg hover:shadow-amber-500/20 transition-all flex items-center gap-2"
                >
                  {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : "New Story"}
                </button>
              </div>

              <div className="glass-panel p-6 rounded-xl flex flex-col justify-between h-48 border border-slate-800">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-theme-primary">
                    <Play className="w-5 h-5" /> Continue Story
                  </h3>
                  <p className="text-theme-muted text-xs mt-2 leading-relaxed">
                    Resume your active story timeline where you left off. Pulls characters, relationship indexes, and the recent visual environment context automatically.
                  </p>
                </div>
                <button
                  disabled={!storyActive}
                  onClick={handleContinueStory}
                  className={`w-fit font-medium text-sm px-5 py-2.5 rounded-lg transition-all flex items-center gap-2 ${
                    storyActive
                      ? 'bg-theme-primary hover:bg-indigo-500 text-slate-100 shadow-lg hover:shadow-indigo-500/20'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Continue
                </button>
              </div>
            </div>

            {/* Quick Info / Tips */}
            <div className="glass-card p-6 rounded-xl border border-slate-800/50">
              <h4 className="text-sm font-semibold text-slate-200">Local-first Visual Novel Architecture</h4>
              <p className="text-theme-muted text-xs mt-1 leading-relaxed">
                The engine utilizes Ollama for offline narrative, character interactions, and semantic vector indexing locally. Toggle ComfyUI in the settings panel to dynamically illustrate each story step as you make decisions or guide the script.
              </p>
            </div>
          </div>
        )}

        {activeView === 'characters' && (
          <CharacterStudio apiBase={API_BASE} />
        )}

        {activeView === 'lorebook' && (
          <LorebookManager apiBase={API_BASE} />
        )}

        {activeView === 'saves' && (
          <SaveLoadScreen 
            apiBase={API_BASE} 
            isLoadOnly={false} 
            onLoadSuccess={() => {
              setStoryActive(true);
              setActiveView('player');
            }} 
          />
        )}

        {activeView === 'settings' && (
          <AISettings apiBase={API_BASE} settings={globalSettings} onSettingsUpdate={fetchSettings} />
        )}
      </main>
    </div>
  );
}

export default App;
