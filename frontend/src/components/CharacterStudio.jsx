import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  UserPlus, 
  Sparkles, 
  Heart, 
  FileJson, 
  Tag, 
  Image as ImageIcon,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

function CharacterStudio({ apiBase }) {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Importer state
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null); // { type: 'success'|'error', msg: string }

  // Manual Creation Form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPersonality, setFormPersonality] = useState("");
  const [formFirstMes, setFormFirstMes] = useState("");
  const [formScenario, setFormScenario] = useState("");
  
  useEffect(() => {
    fetchCharacters();
  }, []);

  const fetchCharacters = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/characters`);
      const data = await res.json();
      setCharacters(data.characters || []);
    } catch (e) {
      console.error("Error fetching characters:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setImporting(true);
    setImportStatus(null);
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch(`${apiBase}/api/characters/import-card`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (res.status === 200 && data.status === "success") {
        setImportStatus({ type: 'success', msg: `Successfully imported ${data.character.name}!` });
        fetchCharacters();
      } else {
        setImportStatus({ type: 'error', msg: data.detail || "Failed to import card. Verify it has PNG metadata tags." });
      }
    } catch (e) {
      setImportStatus({ type: 'error', msg: "Connection to backend failed during import." });
    } finally {
      setImporting(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim()) return;

    try {
      const profile = {
        name: formName,
        description: formDescription,
        personality: formPersonality,
        first_mes: formFirstMes,
        scenario: formScenario,
        traits: formPersonality.split(",").map(t => t.trim()).filter(Boolean)
      };

      const res = await fetch(`${apiBase}/api/characters/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      
      if (res.ok) {
        setShowCreateForm(false);
        // Reset form
        setFormName("");
        setFormDescription("");
        setFormPersonality("");
        setFormFirstMes("");
        setFormScenario("");
        fetchCharacters();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Header section */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-serif font-bold">Character Studio</h2>
          <p className="text-theme-muted text-xs mt-1">
            Import cards from SillyTavern or create persistent AI character sheets with embedded relationships and traits.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-all shadow"
          >
            <UserPlus className="w-4 h-4 text-theme-accent" /> Custom Character
          </button>

          <label className="bg-gradient-to-r from-theme-primary to-indigo-700 hover:from-indigo-500 hover:to-indigo-800 text-slate-100 text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-lg hover:shadow-indigo-500/10 transition-all">
            <Upload className="w-4 h-4" /> 
            {importing ? "Importing..." : "Import ST Card"}
            <input
              type="file"
              accept=".png,.json"
              onChange={handleFileUpload}
              className="hidden"
              disabled={importing}
            />
          </label>
        </div>
      </div>

      {/* Import feedback notice */}
      {importStatus && (
        <div className={`p-4 rounded-lg flex items-center gap-3 border text-sm max-w-xl ${
          importStatus.type === 'success' 
            ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-300' 
            : 'bg-rose-950/40 border-rose-900/60 text-rose-300'
        }`}>
          {importStatus.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{importStatus.msg}</span>
        </div>
      )}

      {/* Creation Modal / Form overlay */}
      {showCreateForm && (
        <form onSubmit={handleCreateSubmit} className="glass-panel p-6 rounded-xl border border-slate-800 space-y-4 max-w-2xl">
          <h3 className="font-serif text-md font-bold text-slate-200">New Character Profile</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold mb-1">Character Name</label>
              <input
                type="text"
                placeholder="e.g. Alice"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-theme-accent/50"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold mb-1">Key Traits (Comma separated)</label>
              <input
                type="text"
                placeholder="cheerful, intellectual, cautious"
                value={formPersonality}
                onChange={(e) => setFormPersonality(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold mb-1">Character Description / Backstory</label>
            <textarea
              rows={3}
              placeholder="Describe physical appearance, attire details, and key context variables..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold mb-1">Greeting Prompt (First Dialogue)</label>
              <input
                type="text"
                placeholder="Ah, you finally arrived. I was waiting..."
                value={formFirstMes}
                onChange={(e) => setFormFirstMes(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold mb-1">Starting Scenario Description</label>
              <input
                type="text"
                placeholder="Meeting in the library after class hours..."
                value={formScenario}
                onChange={(e) => setFormScenario(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 bg-slate-950 text-slate-400 hover:text-slate-200 rounded text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-theme-accent text-theme-dark font-semibold rounded text-xs shadow-md hover:bg-amber-400"
            >
              Save Character
            </button>
          </div>
        </form>
      )}

      {/* Characters List Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <RefreshCw className="w-8 h-8 text-theme-muted animate-spin" />
        </div>
      ) : characters.length === 0 ? (
        <div className="glass-panel text-center py-16 rounded-xl border border-slate-800/80">
          <ImageIcon className="w-12 h-12 text-theme-muted/50 mx-auto mb-3" />
          <h3 className="text-slate-300 font-serif font-bold text-md">No Characters Active</h3>
          <p className="text-theme-muted text-xs mt-1 max-w-sm mx-auto leading-relaxed">
            Drag and drop a PNG Tavern character card inside this window or upload a JSON definition to populate your storytelling universe.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {characters.map((c, i) => (
            <div key={i} className="glass-panel rounded-xl overflow-hidden border border-slate-800/80 flex flex-col justify-between">
              {/* Thumbnail header */}
              <div className="h-44 bg-slate-950 relative flex items-center justify-center border-b border-slate-900 overflow-hidden">
                {c.ref_image ? (
                  <img 
                    src={`${apiBase}/assets/${c.name}_ref.png`} 
                    alt={c.name}
                    className="w-full h-full object-cover opacity-85 hover:scale-105 transition-all duration-500" 
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950 to-indigo-900 opacity-60 flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-slate-700/80" />
                  </div>
                )}
                
                {/* Relationship Overlay label */}
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm border border-slate-800 rounded px-2.5 py-1 flex items-center gap-1.5 text-[10px] text-rose-300">
                  <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                  <span className="font-semibold">{c.relationship || 50}/100</span>
                </div>
              </div>

              {/* Card Body content */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h4 className="font-serif font-bold text-slate-100 text-md">{c.name}</h4>
                  <p className="text-theme-muted text-xs line-clamp-3 mt-1.5 leading-relaxed">
                    {c.description || "No description set yet."}
                  </p>
                </div>

                {/* Traits tags */}
                <div className="flex flex-wrap gap-1.5">
                  {c.traits && c.traits.slice(0, 3).map((t, idx) => (
                    <span key={idx} className="bg-slate-900 border border-slate-800/60 text-slate-400 text-[9px] px-2 py-0.5 rounded flex items-center gap-1">
                      <Tag className="w-2.5 h-2.5 text-theme-accent" /> {t.trim()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Simple helper icon
function RefreshCw(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M16 3h5v5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 21H3v-5" />
    </svg>
  );
}

export default CharacterStudio;
