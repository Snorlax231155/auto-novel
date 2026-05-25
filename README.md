# Auto-Novel AI: Cinematic Visual Novel Engine 🎭

Auto-Novel AI is an interactive storytelling engine inspired by Ren'Py, SillyTavern, and NovelAI. It bridges local React/Electron application architecture with cloud-hosted AI model acceleration (via Google Colab, Ollama, and ComfyUI) to deliver a seamless, dynamic, AI-generated visual novel experience.

---

## ✨ Features

- **Cinematic Presentation**: Ren'Py-inspired full-screen interface featuring typewriter dialogue delivery, automated slide transitions, responsive camera framing (close-ups, pans, shakes), and immersive audio controls.
- **Dynamic Story Generation**: Fully AI-driven narrative steps, character dialogues, emotions, backgrounds, and character descriptors built directly on user prompts.
- **Image Generation Pipeline**: Synchronized ComfyUI workflow engine to render high-quality scene backgrounds and transparent character sprites in real-time.
- **Local-First & Hybrid Cloud Architecture**: Powered locally by Electron & FastAPI, with optional high-performance cloud acceleration for large LLMs (Ollama) and Stable Diffusion (ComfyUI) models.
- **Persistent AI Settings**: Interactive configuration manager supporting quick presets, automated URL sanitization, and immediate saving for remote Google Colab tunnels.
- **Lorebooks & Memory RAG**: SQLite-backed local vector database that manages character personality cards, lorebooks, and automatic scene summarization for long-term narrative consistency.
- **Latency Debug Panel**: Real-time HUD showing individual generation times (LLM text vs. Image generation) to monitor system performance.

---

## 🏗️ Architecture

```
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── config.py         # Persistent Settings Manager
│   │   └── services/
│   │       ├── llm.py        # Ollama / Cloud API connector
│   │       ├── image_gen.py  # ComfyUI rendering engine
│   │       ├── memory.py     # TF-IDF local database (RAG)
│   │       └── story.py      # Core Story state machine
│   ├── data/                 # Game assets, characters, lore, and saves
│   └── main.py               # REST API & WebSocket server
├── frontend/                 # React + Vite + Tailwind CSS + Lucide Icons
│   ├── src/
│   │   ├── components/       # Player HUD, Studio, Saves, and AI Settings
│   │   └── App.jsx
│   └── main.js               # Electron Desktop wrapper
└── colab_notebook.ipynb      # Remote Ollama + ComfyUI orchestrator
```

---

## 🚀 Getting Started

### 1. Cloud Accelerator Setup (Google Colab)
If you do not have a high-end local GPU, offload the generation to Google Cloud:
1. Upload `colab_notebook.ipynb` to [Google Colab](https://colab.research.google.com/).
2. Change the runtime type to **T4 GPU** (`Runtime > Change runtime type`).
3. Run all cells in the notebook. This will install dependencies, load the Stable Diffusion checkpoint, pull the Llama 3 model, and start secure Cloudflare Tunnels.
4. Copy the generated public URLs (`*.trycloudflare.com`) printed at the bottom of the execution cells.

### 2. Local Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Set up a Python virtual environment and install dependencies:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Start the FastAPI server:
   ```bash
   python main.py
   ```
   *The server runs locally at `http://localhost:8000`.*

### 3. Local Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the Electron application in development mode:
   ```bash
   npm run electron-dev
   ```

---

## ⚙️ Configuration & Model Optimization

Once the application launches:
1. Click **AI Settings** in the main menu.
2. In the **Google Colab Cloud Accelerator** card, paste your Ollama and ComfyUI tunnel links into the quick inputs.
3. Click **Apply Colab Configuration Preset** (this auto-configures the provider profiles, overrides LLM models to `llama3:8b`, and sets embeddings to the local database to save bandwidth).
4. Click **Save Configurations** at the bottom of the screen.

### ⚡ Tips for Fast Image Generation (under 5 seconds)
- **Resolution**: Change the image width and height to `512x512` (or `768x512` widescreen) in Section 3 of the AI Settings. Running SD 1.5 checkpoints (like DreamShaper) at 1024x1024 is slow and causes duplicate generation artifacts.
- **Model Checkpoints**: You can add your own favorite anime/cinematic models from Civitai. Download them directly inside the Colab environment by running:
  ```python
  !curl -L "https://civitai.com/api/download/models/[MODEL_VERSION_ID]?token=[YOUR_TOKEN]" -o /content/ComfyUI/models/checkpoints/[MODEL_NAME].safetensors
  ```
  Our backend will dynamically identify the new file and list it in the settings dashboard automatically!
