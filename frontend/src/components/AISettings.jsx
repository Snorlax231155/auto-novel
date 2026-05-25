import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Settings, 
  HelpCircle, 
  Cpu, 
  Network, 
  Sparkles,
  RefreshCw,
  CheckCircle,
  Globe
} from 'lucide-react';

function AISettings({ apiBase, settings, onSettingsUpdate }) {
  // Setup local states based on props
  const [llmProvider, setLlmProvider] = useState(settings?.llm_provider || "ollama");
  const [llmUrl, setLlmUrl] = useState(settings?.llm_api_url || "http://localhost:11434");
  const [llmKey, setLlmKey] = useState(settings?.llm_api_key || "");
  const [llmModel, setLlmModel] = useState(settings?.llm_model || "llama3");
  const [llmTemp, setLlmTemp] = useState(settings?.llm_temperature || 0.7);

  const [embedProvider, setEmbedProvider] = useState(settings?.embed_provider || "ollama");
  const [embedUrl, setEmbedUrl] = useState(settings?.embed_api_url || "http://localhost:11434");
  const [embedModel, setEmbedModel] = useState(settings?.embed_model || "nomic-embed-text");

  const [imageGenProvider, setImageGenProvider] = useState(settings?.image_gen_provider || "comfyui");
  const [imageGenUrl, setImageGenUrl] = useState(settings?.image_gen_url || "http://127.0.0.1:8188");
  const [imageWidth, setImageWidth] = useState(settings?.image_width || 1024);
  const [imageHeight, setImageHeight] = useState(settings?.image_height || 1024);

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(false);
  const [colabOllamaUrl, setColabOllamaUrl] = useState("");
  const [colabComfyUrl, setColabComfyUrl] = useState("");

  // Sync state if settings prop changes
  useEffect(() => {
    if (settings) {
      setLlmProvider(settings.llm_provider);
      setLlmUrl(settings.llm_api_url);
      setLlmKey(settings.llm_api_key || "");
      setLlmModel(settings.llm_model);
      setLlmTemp(settings.llm_temperature);
      setEmbedProvider(settings.embed_provider);
      setEmbedUrl(settings.embed_api_url);
      setEmbedModel(settings.embed_model);
      setImageGenProvider(settings.image_gen_provider);
      setImageGenUrl(settings.image_gen_url);
      setImageWidth(settings.image_width);
      setImageHeight(settings.image_height);
    }
  }, [settings]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveStatus(false);

    const payload = {
      llm_provider: llmProvider,
      llm_api_url: llmUrl,
      llm_api_key: llmKey,
      llm_model: llmModel,
      llm_temperature: parseFloat(llmTemp),
      embed_provider: embedProvider,
      embed_api_url: embedUrl,
      embed_model: embedModel,
      image_gen_provider: imageGenProvider,
      image_gen_url: imageGenUrl,
      image_width: parseInt(imageWidth),
      image_height: parseInt(imageHeight)
    };

    try {
      const res = await fetch(`${apiBase}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSaveStatus(true);
        if (onSettingsUpdate) onSettingsUpdate();
        setTimeout(() => setSaveStatus(false), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handlePresetSelect = (preset) => {
    if (preset === "local-ollama") {
      setLlmProvider("ollama");
      setLlmUrl("http://localhost:11434");
      setLlmModel("llama3");
      setEmbedProvider("ollama");
      setEmbedUrl("http://localhost:11434");
      setEmbedModel("nomic-embed-text");
      setImageGenProvider("mock");
    } else if (preset === "openai-cloud") {
      setLlmProvider("openai");
      setLlmUrl("https://api.openai.com/v1");
      setLlmModel("gpt-4-turbo");
      setEmbedProvider("openai");
      setEmbedUrl("https://api.openai.com/v1");
      setEmbedModel("text-embedding-3-small");
    }
  };

  const applyColabSettings = async () => {
    if (!colabOllamaUrl && !colabComfyUrl) return;
    
    const cleanOllama = colabOllamaUrl.trim().replace(/\/+$/, "");
    const cleanComfy = colabComfyUrl.trim().replace(/\/+$/, "");

    if (cleanOllama) {
      setLlmProvider("ollama");
      setLlmUrl(cleanOllama);
      setLlmModel("llama3:8b");
    }
    if (cleanComfy) {
      setImageGenProvider("comfyui");
      setImageGenUrl(cleanComfy);
    }
    setEmbedProvider("local_tfidf");

    const payload = {
      llm_provider: cleanOllama ? "ollama" : llmProvider,
      llm_api_url: cleanOllama || llmUrl,
      llm_api_key: llmKey,
      llm_model: cleanOllama ? "llama3:8b" : llmModel,
      llm_temperature: parseFloat(llmTemp),
      embed_provider: "local_tfidf",
      embed_api_url: embedUrl,
      embed_model: embedModel,
      image_gen_provider: cleanComfy ? "comfyui" : imageGenProvider,
      image_gen_url: cleanComfy || imageGenUrl,
      image_width: parseInt(imageWidth),
      image_height: parseInt(imageHeight)
    };

    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSaveStatus(true);
        if (onSettingsUpdate) onSettingsUpdate();
        setTimeout(() => setSaveStatus(false), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-16">
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-serif font-bold">AI Providers & Inference</h2>
          <p className="text-theme-muted text-xs mt-1">
            Toggle between local offline inference (Ollama, ComfyUI) and cloud API wrappers (OpenAI, OpenRouter).
          </p>
        </div>

        {saveStatus && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900 px-3 py-1.5 rounded-lg">
            <CheckCircle className="w-3.5 h-3.5" /> Configurations Saved Successfully!
          </div>
        )}
      </div>

      {/* Google Colab Tunnel Instruction Card */}
      <div className="glass-panel p-5 rounded-xl border border-slate-800 bg-indigo-950/10 space-y-3">
        <h3 className="text-sm font-serif font-bold text-indigo-300 flex items-center gap-2">
          <Globe className="w-4 h-4 text-theme-primary" /> 
          Google Colab Cloud Accelerator (Optional)
        </h3>
        <p className="text-xs text-theme-muted leading-relaxed">
          If you lack a powerful local GPU, you can offload LLM text generation and ComfyUI image rendering to Google's cloud servers.
        </p>
        <div className="bg-slate-950/60 border border-slate-900 rounded p-3 text-[11px] font-sans space-y-2 text-slate-300">
          <div className="flex gap-2">
            <span className="text-theme-accent font-bold">Step 1:</span>
            <span>Upload the file <code className="bg-slate-900 px-1.5 py-0.5 rounded text-indigo-400 select-all font-mono font-bold">colab_notebook.ipynb</code> (found in this project's root) to <a href="https://colab.research.google.com" target="_blank" rel="noreferrer" className="text-theme-primary underline hover:text-indigo-400">Google Colab</a>.</span>
          </div>
          <div className="flex gap-2">
            <span className="text-theme-accent font-bold">Step 2:</span>
            <span>Ensure you connect to a <strong>T4 GPU</strong> runtime and run all cells in the notebook to launch Ollama and ComfyUI.</span>
          </div>
          <div className="flex gap-2">
            <span className="text-theme-accent font-bold">Step 3:</span>
            <span>Copy the generated public Cloudflare URLs (<code className="text-amber-400 font-mono">*.trycloudflare.com</code>) printed in the cell logs.</span>
          </div>
          <div className="flex gap-2">
            <span className="text-theme-accent font-bold">Step 4:</span>
            <span>Paste your tunnel URLs in the inputs below, click "Apply Colab Settings", and save!</span>
          </div>
        </div>

        {/* Colab Quick Input Panel */}
        <div className="border-t border-slate-800 pt-4 mt-2 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-300">Quick-Apply Google Colab Preset:</h4>
            <span className="text-[10px] text-theme-muted font-mono bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/30">Auto: Llama 3 (8B) + ComfyUI + Offline Embeddings</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] text-slate-400 uppercase tracking-wider mb-1 font-semibold">Ollama Tunnel URL</label>
              <input
                type="text"
                placeholder="e.g. https://xxx-xxx-xxx.trycloudflare.com"
                value={colabOllamaUrl}
                onChange={(e) => setColabOllamaUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-700 font-mono transition-all"
              />
            </div>
            <div>
              <label className="block text-[9px] text-slate-400 uppercase tracking-wider mb-1 font-semibold">ComfyUI Tunnel URL</label>
              <input
                type="text"
                placeholder="e.g. https://yyy-yyy-yyy.trycloudflare.com"
                value={colabComfyUrl}
                onChange={(e) => setColabComfyUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-700 font-mono transition-all"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={applyColabSettings}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 rounded transition-all cursor-pointer shadow-lg hover:shadow-indigo-500/10"
          >
            Apply Colab Configuration Preset
          </button>
        </div>
      </div>

      {/* Preset Selection Buttons */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 flex gap-4 items-center">
        <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
          <Settings className="w-3.5 h-3.5 text-theme-accent" /> Quick Presets:
        </span>
        <button
          onClick={() => handlePresetSelect("local-ollama")}
          className="bg-slate-900 hover:bg-slate-800 border border-slate-850 text-slate-300 text-xs px-3.5 py-1.5 rounded transition-all"
        >
          Fully Local (Ollama)
        </button>
        <button
          onClick={() => handlePresetSelect("openai-cloud")}
          className="bg-slate-900 hover:bg-slate-800 border border-slate-850 text-slate-300 text-xs px-3.5 py-1.5 rounded transition-all"
        >
          Cloud Only (OpenAI)
        </button>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        
        {/* SECTION 1: LLM text generator settings */}
        <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-serif font-bold text-slate-200 flex items-center gap-2 border-b border-slate-900 pb-3">
            <Cpu className="w-4 h-4 text-theme-accent" /> Section 1: Text Generation (LLM Router)
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold mb-1.5">Model Provider</label>
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
              >
                <option value="ollama">Ollama (Local)</option>
                <option value="koboldcpp">KoboldCPP (Local)</option>
                <option value="llamacpp">llama.cpp (Local)</option>
                <option value="openai">OpenAI (Cloud)</option>
                <option value="openrouter">OpenRouter (Cloud)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold mb-1.5">API Endpoint URL</label>
              <input
                type="text"
                placeholder="http://localhost:11434"
                value={llmUrl}
                onChange={(e) => setLlmUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold mb-1.5">API Key (Optional)</label>
              <input
                type="password"
                placeholder="sk-..."
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold mb-1.5">Model Name Identifier</label>
              <input
                type="text"
                placeholder="e.g. llama3"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold">Temperature</label>
                <span className="text-[10px] text-theme-accent font-mono">{llmTemp}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.5"
                step="0.05"
                value={llmTemp}
                onChange={(e) => setLlmTemp(e.target.value)}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-theme-accent"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Vector Embedding RAG settings */}
        <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-serif font-bold text-slate-200 flex items-center gap-2 border-b border-slate-900 pb-3">
            <Network className="w-4 h-4 text-theme-primary" /> Section 2: Vector Embeddings (Semantic RAG)
          </h3>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold mb-1.5">Embedding Provider</label>
              <select
                value={embedProvider}
                onChange={(e) => setEmbedProvider(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
              >
                <option value="ollama">Ollama (Local)</option>
                <option value="openai">OpenAI (Cloud)</option>
                <option value="local_tfidf">Fallback Hash Vectorizer (100% Offline)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold mb-1.5">Embedding Endpoint URL</label>
              <input
                type="text"
                placeholder="http://localhost:11434"
                value={embedUrl}
                onChange={(e) => setEmbedUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
                disabled={embedProvider === "local_tfidf"}
              />
            </div>

            <div>
              <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold mb-1.5">Embedding Model Name</label>
              <input
                type="text"
                placeholder="nomic-embed-text"
                value={embedModel}
                onChange={(e) => setEmbedModel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
                disabled={embedProvider === "local_tfidf"}
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: ComfyUI image generator settings */}
        <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-serif font-bold text-slate-200 flex items-center gap-2 border-b border-slate-900 pb-3">
            <Sparkles className="w-4 h-4 text-theme-secondary" /> Section 3: Visual Illustration (Image Gen)
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold mb-1.5">Image Generator Backend</label>
              <select
                value={imageGenProvider}
                onChange={(e) => setImageGenProvider(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
              >
                <option value="comfyui">ComfyUI API Client (Local/Remote)</option>
                <option value="mock">Procedural Vector Generator (Fast Gradient Fallback)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold mb-1.5">ComfyUI Endpoint URL</label>
              <input
                type="text"
                placeholder="http://127.0.0.1:8188"
                value={imageGenUrl}
                onChange={(e) => setImageGenUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
                disabled={imageGenProvider === "mock"}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold mb-1.5">Export Resolution Width</label>
              <input
                type="number"
                value={imageWidth}
                onChange={(e) => setImageWidth(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] text-theme-muted uppercase tracking-widest font-semibold mb-1.5">Export Resolution Height</label>
              <input
                type="number"
                value={imageHeight}
                onChange={(e) => setImageHeight(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
                required
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-theme-accent text-theme-dark font-bold text-sm px-6 py-3 rounded-lg flex items-center gap-2 shadow-lg hover:bg-amber-400 hover:shadow-amber-500/10 transition-all cursor-pointer"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Configurations
          </button>
        </div>

      </form>
    </div>
  );
}

export default AISettings;
