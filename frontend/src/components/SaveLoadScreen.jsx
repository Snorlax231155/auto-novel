import React, { useState, useEffect } from 'react';
import { Save, FolderOpen, Calendar, User, FileText, Sparkles, CheckCircle } from 'lucide-react';

function SaveLoadScreen({ apiBase, isLoadOnly = false, onLoadSuccess }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  useEffect(() => {
    fetchSlots();
  }, []);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/saves`);
      const data = await res.json();
      setSlots(data.slots || []);
    } catch (e) {
      console.error("Error loading saves:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (slotId) => {
    try {
      const res = await fetch(`${apiBase}/api/saves/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: slotId })
      });
      if (res.ok) {
        setFeedbackMsg(`Successfully saved game to Slot ${slotId}!`);
        fetchSlots();
        setTimeout(() => setFeedbackMsg(""), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLoad = async (slotId) => {
    try {
      const res = await fetch(`${apiBase}/api/saves/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: slotId })
      });
      if (res.ok) {
        setFeedbackMsg(`Loaded Slot ${slotId} successfully.`);
        if (onLoadSuccess) onLoadSuccess();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-theme-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 animate-fade-in">
      
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div className="p-3 bg-indigo-950/50 border border-indigo-900 text-indigo-300 text-xs rounded-lg flex items-center gap-2 max-w-sm animate-slide-up">
          <CheckCircle className="w-4 h-4 text-theme-accent" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Grid of Slots */}
      <div className="grid grid-cols-3 gap-6">
        {slots.map((slot) => (
          <div 
            key={slot.slot_id} 
            className={`glass-panel rounded-xl overflow-hidden border flex flex-col justify-between min-h-[220px] transition-all relative ${
              slot.exists 
                ? 'border-slate-800 hover:border-indigo-900/60' 
                : 'border-slate-900/50 opacity-60'
            }`}
          >
            {/* Slot Banner Header */}
            <div className="h-28 bg-slate-950/80 border-b border-slate-900 flex items-center justify-center relative overflow-hidden">
              {slot.exists && slot.bg_image ? (
                <img 
                  src={`${apiBase}/assets/${slot.bg_image}`} 
                  alt="Save State Preview" 
                  className="w-full h-full object-cover opacity-60"
                />
              ) : (
                <div className="text-[10px] text-slate-700/80 uppercase font-mono tracking-widest font-bold">
                  {slot.exists ? "Save Slot active" : "Empty slot"}
                </div>
              )}
              
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm border border-slate-850 px-2.5 py-0.5 rounded text-[10px] font-bold text-theme-accent">
                Slot 0{slot.slot_id}
              </div>
            </div>

            {/* Slot Description Details */}
            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
              {slot.exists ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Calendar className="w-3.5 h-3.5" /> 
                    {new Date(slot.timestamp * 1000).toLocaleString()}
                  </div>
                  
                  <div className="flex items-center gap-1.5 font-bold text-slate-200">
                    <User className="w-3.5 h-3.5 text-theme-accent" /> 
                    <span>Speaker: {slot.last_speaker || "Narrator"}</span>
                  </div>

                  <p className="text-[10px] text-theme-muted line-clamp-2 leading-relaxed flex items-start gap-1">
                    <FileText className="w-3 h-3 text-slate-600 shrink-0 mt-0.5" />
                    <span>"{slot.last_text}"</span>
                  </p>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 italic text-center py-4">Ready to accept story state variables.</p>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-slate-900">
                {slot.exists && (
                  <button
                    onClick={() => handleLoad(slot.slot_id)}
                    className="flex-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-slate-100 text-[10px] font-semibold py-2 rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow"
                  >
                    <FolderOpen className="w-3 h-3 text-theme-primary" /> Load Game
                  </button>
                )}
                
                {!isLoadOnly && (
                  <button
                    onClick={() => handleSave(slot.slot_id)}
                    className={`text-[10px] font-semibold py-2 rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow ${
                      slot.exists 
                        ? 'flex-1 bg-slate-950 border border-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-900' 
                        : 'w-full bg-gradient-to-r from-theme-accent to-amber-600 hover:from-amber-500 hover:to-amber-700 text-theme-dark'
                    }`}
                  >
                    <Save className="w-3 h-3" /> {slot.exists ? "Overwrite" : "Save State"}
                  </button>
                )}
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}

export default SaveLoadScreen;
