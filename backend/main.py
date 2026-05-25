import os
import json
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from app.config import settings
from app.services.memory import db
from app.services.llm import llm_service
from app.services.image_gen import image_gen_service
from app.services.tavern import tavern_service
from app.services.story import story_engine

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("main")

app = FastAPI(title="AI Visual Novel Engine API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure app directories exist
settings.ensure_dirs()

# Mount Static Assets folder so the React frontend can load backgrounds and character sprites
app.mount("/assets", StaticFiles(directory=settings.ASSETS_DIR), name="assets")

# Connection Manager for WebSocket clients
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"WebSocket client disconnected. Active connections: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting WebSocket message: {e}")

manager = ConnectionManager()

# --- Schemas ---
class SettingsUpdate(BaseModel):
    llm_provider: str
    llm_api_url: str
    llm_api_key: Optional[str] = ""
    llm_model: str
    llm_temperature: float
    embed_provider: str
    embed_api_url: str
    embed_model: str
    image_gen_provider: str
    image_gen_url: str
    image_width: int
    image_height: int

class AdvanceStoryRequest(BaseModel):
    prompt: str

class SaveGameRequest(BaseModel):
    slot_id: int

class LoadGameRequest(BaseModel):
    slot_id: int

class AddMemoryRequest(BaseModel):
    text: str
    tags: List[str]
    metadata: Optional[Dict[str, Any]] = None

# --- REST Endpoints ---

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "time": time.time() if "time" in globals() else 0.0}

@app.get("/api/settings")
def get_settings():
    return {
        "llm_provider": settings.LLM_PROVIDER,
        "llm_api_url": settings.LLM_API_URL,
        "llm_api_key": settings.LLM_API_KEY,
        "llm_model": settings.LLM_MODEL,
        "llm_temperature": settings.LLM_TEMPERATURE,
        "embed_provider": settings.EMBED_PROVIDER,
        "embed_api_url": settings.EMBED_API_URL,
        "embed_model": settings.EMBED_MODEL,
        "image_gen_provider": settings.IMAGE_GEN_PROVIDER,
        "image_gen_url": settings.IMAGE_GEN_URL,
        "image_width": settings.IMAGE_WIDTH,
        "image_height": settings.IMAGE_HEIGHT,
    }

@app.post("/api/settings")
def update_settings(data: SettingsUpdate):
    settings.LLM_PROVIDER = data.llm_provider
    settings.LLM_API_URL = data.llm_api_url
    settings.LLM_API_KEY = data.llm_api_key or ""
    settings.LLM_MODEL = data.llm_model
    settings.LLM_TEMPERATURE = data.llm_temperature
    settings.EMBED_PROVIDER = data.embed_provider
    settings.EMBED_API_URL = data.embed_api_url
    settings.EMBED_MODEL = data.embed_model
    settings.IMAGE_GEN_PROVIDER = data.image_gen_provider
    settings.IMAGE_GEN_URL = data.image_gen_url
    settings.IMAGE_WIDTH = data.image_width
    settings.IMAGE_HEIGHT = data.image_height
    settings.save()
    return {"status": "success", "message": "Settings updated"}

@app.get("/api/story/state")
def get_story_state():
    return {
        "active_story_id": story_engine.active_story_id,
        "current_speaker": story_engine.current_speaker,
        "current_dialogue": story_engine.current_dialogue,
        "current_narration": story_engine.current_narration,
        "current_emotion": story_engine.current_emotion,
        "current_camera": story_engine.current_camera,
        "current_bg": story_engine.current_bg,
        "current_sprite": story_engine.current_sprite,
        "scene_history": story_engine.scene_history,
        "active_characters": story_engine.active_characters,
        "last_text_time": story_engine.last_text_time,
        "last_image_time": story_engine.last_image_time,
        "text_time": story_engine.last_text_time,
        "image_time": story_engine.last_image_time,
    }

@app.post("/api/story/reset")
def reset_story():
    story_engine.reset_story()
    return {"status": "success", "message": "Story reset done."}

@app.post("/api/story/advance")
async def advance_story(req: AdvanceStoryRequest):
    logger.info(f"Advancing story with user input: {req.prompt}")
    
    # Broadcast state change -> Generating
    await manager.broadcast({"event": "status", "status": "generating", "message": "AI is generating the next story beats..."})
    
    try:
        new_scene = story_engine.advance_story(req.prompt)
        
        # Broadcast standard state updates
        await manager.broadcast({
            "event": "scene_update",
            "scene": new_scene
        })
        return {"status": "success", "scene": new_scene}
    except Exception as e:
        logger.error(f"Failed to advance story: {e}")
        await manager.broadcast({"event": "status", "status": "error", "message": f"Story progression error: {str(e)}"})
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/saves")
def get_saves():
    return {"slots": story_engine.get_save_slots()}

@app.post("/api/saves/save")
def save_game(req: SaveGameRequest):
    filename = story_engine.save_game(req.slot_id)
    return {"status": "success", "message": f"Game saved to slot {req.slot_id}", "filename": filename}

@app.post("/api/saves/load")
def load_game(req: LoadGameRequest):
    success = story_engine.load_game(req.slot_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"No save file in slot {req.slot_id}")
    return {"status": "success", "message": f"Game loaded from slot {req.slot_id}"}

# --- Character & SillyTavern Endpoints ---

@app.get("/api/characters")
def list_characters():
    characters = []
    if os.path.exists(settings.CHARACTERS_DIR):
        for f in os.listdir(settings.CHARACTERS_DIR):
            if f.endswith(".json"):
                try:
                    with open(os.path.join(settings.CHARACTERS_DIR, f), "r", encoding="utf-8") as file:
                        char_data = json.load(file)
                    characters.append(char_data)
                except Exception:
                    pass
    return {"characters": characters}

@app.post("/api/characters/import-card")
async def import_character_card(file: UploadFile = File(...)):
    # Save the uploaded file temporarily
    temp_path = os.path.join(settings.DATA_DIR, f"temp_{file.filename}")
    with open(temp_path, "wb") as buffer:
        buffer.write(await file.read())
        
    is_png = file.filename.lower().endswith(".png")
    
    success, profile = tavern_service.import_tavern_card(temp_path, is_png=is_png)
    
    # Remove temp file
    if os.path.exists(temp_path):
        os.remove(temp_path)
        
    if not success:
        raise HTTPException(status_code=400, detail="Failed to import SillyTavern character card. Make sure the PNG file has embedded metadata.")
        
    return {"status": "success", "character": profile}

@app.post("/api/characters/create")
def create_character(profile: Dict[str, Any]):
    name = profile.get("name", "Unnamed").strip().replace(" ", "_")
    profile_path = os.path.join(settings.CHARACTERS_DIR, f"{name}.json")
    
    # Ensure default fields are present
    profile["relationship"] = profile.get("relationship", 50)
    profile["emotion_state"] = profile.get("emotion_state", "Neutral")
    
    with open(profile_path, "w", encoding="utf-8") as f:
        json.dump(profile, f, ensure_ascii=False, indent=2)
        
    return {"status": "success", "character": profile}

# --- Memory & Vector DB Endpoints ---

@app.get("/api/memories")
def get_memories(query: Optional[str] = None, tag: Optional[str] = None):
    if query:
        tags = [tag] if tag else None
        matches = db.search(query, tags=tags, k=25)
        return {"memories": matches}
    else:
        # Return list of all memories without heavy vector coordinates
        lite_memories = []
        for m in db.memories:
            lite_m = m.copy()
            lite_m.pop("vector", None)
            lite_memories.append(lite_m)
        return {"memories": lite_memories}

@app.post("/api/memories")
def add_memory(req: AddMemoryRequest):
    new_mem = db.add_memory(req.text, req.tags, req.metadata)
    # Remove vector for response
    response_mem = new_mem.copy()
    response_mem.pop("vector", None)
    return {"status": "success", "memory": response_mem}

@app.delete("/api/memories/{memory_id}")
def delete_memory(memory_id: str):
    success = db.delete_memory(memory_id)
    if not success:
        raise HTTPException(status_code=404, detail="Memory ID not found")
    return {"status": "success", "message": "Memory deleted"}

@app.post("/api/memories/clear")
def clear_memories(tag_filter: Optional[str] = None):
    db.clear_memories(tag_filter)
    return {"status": "success", "message": "Memories cleared"}

# --- WebSockets ---
@app.websocket("/ws/story")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Keep connection open
        while True:
            data = await websocket.receive_text()
            # Echo or process custom incoming client websocket commands
            logger.info(f"Received WS command: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    # Make sure app data directories exist at startup
    settings.ensure_dirs()
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
