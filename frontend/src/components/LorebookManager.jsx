import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Search, 
  BookOpen, 
  Database,
  Calendar,
  AlertCircle,
  Tag
} from 'lucide-react';

function LorebookManager({ apiBase }) {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search parameters
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTag, setSearchTag] = useState("");
  const [searchResults, setSearchResults] = useState(null);

  // Creation form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newText, setNewText] = useState("");
  const [newTags, setNewTags] = useState("");

  useEffect(() => {
    fetchMemories();
  }, []);

  const fetchMemories = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/memories`);
      const data = await res.json();
      setMemories(data.memories || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMemory = async (e) => {
    e.preventDefault();
    if (!newText.trim()) return;

    try {
      const payload = {
        text: newText,
        tags: newTags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean),
        metadata: { source: "manual_entry" }
      };

      const res = await fetch(`${apiBase}/api/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setNewText("");
        setNewTags("");
        setShowAddForm(false);
        fetchMemories();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${apiBase}/api/memories/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchMemories();
        if (searchResults) {
          setSearchResults(prev => prev.filter(m => m.id !== id));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Wipe all long-term vector database memories? This cannot be undone.")) return;
    try {
      const res = await fetch(`${apiBase}/api/memories/clear`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchMemories();
        setSearchResults(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    
    setLoading(true);
    try {
      let url = `${apiBase}/api/memories?query=${encodeURIComponent(searchQuery)}`;
      if (searchTag) {
        url += `&tag=${encodeURIComponent(searchTag)}`;
      }
      
      const res = await fetch(url);
      const data = await res.json();
      setSearchResults(data.memories || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchTag("");
    setSearchResults(null);
  };

  const displayList = searchResults !== null ? searchResults : memories;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Header section */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-serif font-bold">Lore & Semantic Memory</h2>
          <p className="text-theme-muted text-xs mt-1">
            Browse the active local vector database. View summarizations, inject custom lore context keywords, or test semantic RAG queries.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleClearAll()}
            className="px-4 py-2.5 bg-slate-900 border border-red-950/60 hover:bg-red-950/20 text-red-400 text-xs rounded-lg transition-all"
          >
            Wipe DB
          </button>
          
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-gradient-to-r from-theme-accent to-amber-600 hover:from-amber-500 hover:to-amber-700 text-theme-dark text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow-lg hover:shadow-amber-500/10 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Lore
          </button>
        </div>
      </div>

      {/* Manual Entry Form */}
      {showAddForm && (
        <form onSubmit={handleAddMemory} className="glass-panel p-6 rounded-xl border border-slate-800 space-y-4 max-w-2xl animate-slide-up">
          <h3 className="font-serif text-md font-bold text-slate-200 flex items-center gap-2">
            <Plus className="w-4 h-4 text-theme-accent" /> Inject Key Fact / Lorebook entry
          </h3>

          <div>
            <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold mb-1">Tags (Comma-separated)</label>
            <input
              type="text"
              placeholder="lore, world, character:alice"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold mb-1">Fact Description</label>
            <textarea
              rows={4}
              placeholder="Enter lore data (e.g. 'The Academy of Magic sits atop the floating peaks of Aethelgard. Its headmaster is a silent wizard named Gwydion')..."
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-theme-accent/50"
              required
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-slate-950 text-slate-400 hover:text-slate-200 rounded text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-theme-accent text-theme-dark font-semibold rounded text-xs shadow"
            >
              Save Fact
            </button>
          </div>
        </form>
      )}

      {/* Semantic Search Sandbox tool */}
      <form onSubmit={handleSearch} className="glass-panel p-5 rounded-xl border border-slate-800/80 grid grid-cols-4 gap-4 items-end">
        <div className="col-span-2">
          <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold mb-1.5 flex items-center gap-1">
            <Search className="w-3 h-3 text-theme-accent" /> Vector Query Tester
          </label>
          <input
            type="text"
            placeholder="Type anything to test semantic retrieval matches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-theme-accent/40"
          />
        </div>

        <div>
          <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold mb-1.5">Filter Tag</label>
          <input
            type="text"
            placeholder="e.g. lore"
            value={searchTag}
            onChange={(e) => setSearchTag(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 bg-slate-900 border border-slate-800 hover:bg-slate-800/60 text-slate-300 text-xs px-4 py-2.5 rounded font-semibold transition-all"
          >
            Query DB
          </button>
          {searchResults !== null && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="bg-slate-950 border border-slate-900 hover:text-slate-200 text-slate-400 text-xs px-3 rounded"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Database Matches Listing */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-theme-muted px-2">
          <span className="flex items-center gap-1.5 font-semibold">
            <Database className="w-4 h-4 text-theme-accent animate-pulse-glow" />
            {searchResults !== null ? "Query Search Matches" : "Index Entries"} ({displayList.length})
          </span>
          {searchResults !== null && <span className="text-theme-accent">Ordered by Cosine Similarity</span>}
        </div>

        {displayList.length === 0 ? (
          <div className="glass-panel text-center py-20 rounded-xl border border-slate-800/80">
            <AlertCircle className="w-12 h-12 text-theme-muted/50 mx-auto mb-3" />
            <h3 className="text-slate-300 font-serif font-bold text-md">Memory Index Empty</h3>
            <p className="text-theme-muted text-xs mt-1 max-w-sm mx-auto leading-relaxed">
              Long-term vector database memories are automatically logged during story advancement steps, or you can manually save lore details.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayList.map((m, i) => (
              <div key={i} className="glass-panel p-5 rounded-xl border border-slate-800/60 hover:border-slate-800 transition-all flex items-start justify-between gap-6">
                <div className="space-y-3 flex-1">
                  {/* Metadata Tag badge */}
                  <div className="flex items-center gap-2">
                    {m.score !== undefined && (
                      <span className="bg-indigo-950/60 text-indigo-300 border border-indigo-900 text-[9px] px-2 py-0.5 rounded font-mono font-bold">
                        Score: {m.score.toFixed(3)}
                      </span>
                    )}

                    {m.tags && m.tags.map((t, idx) => (
                      <span key={idx} className="bg-slate-900 text-slate-400 text-[9px] border border-slate-850 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5 text-theme-accent" /> {t}
                      </span>
                    ))}
                  </div>

                  <p className="text-slate-100 text-xs leading-relaxed font-sans select-text">
                    {m.text}
                  </p>

                  <div className="flex items-center gap-4 text-[10px] text-theme-muted">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> 
                      {m.timestamp ? new Date(m.timestamp * 1000).toLocaleString() : "Date Unknown"}
                    </span>
                    <span>Source: {m.metadata?.source || "AI Summarizer"}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(m.id)}
                  className="text-slate-500 hover:text-red-400 p-2 rounded hover:bg-slate-900 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LorebookManager;
