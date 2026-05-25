import os
import json
import time
import logging
from typing import Dict, Any, List, Optional
from app.config import settings
from app.services.memory import db
from app.services.llm import llm_service
from app.services.image_gen import image_gen_service

logger = logging.getLogger(__name__)

class StoryEngine:
    def __init__(self):
        self.active_story_id: str = "default_story"
        self.scene_history: List[Dict[str, Any]] = []
        self.world_state: Dict[str, Any] = {}
        self.active_characters: Dict[str, Dict[str, Any]] = {}
        self.current_bg: Optional[str] = None
        self.current_sprite: Optional[str] = None
        self.current_speaker: str = "Narrator"
        self.current_dialogue: str = ""
        self.current_narration: str = ""
        self.current_emotion: str = "Neutral"
        self.current_camera: str = "medium"
        self.last_text_time: Optional[float] = None
        self.last_image_time: Optional[float] = None

    def reset_story(self):
        self.scene_history = []
        self.world_state = {}
        self.active_characters = {}
        self.current_bg = None
        self.current_sprite = None
        self.current_speaker = "Narrator"
        self.current_dialogue = ""
        self.current_narration = "The story begins..."
        self.current_emotion = "Neutral"
        self.current_camera = "medium"
        self.last_text_time = None
        self.last_image_time = None
        logger.info("Story state reset successfully.")

    def compile_history_context(self) -> str:
        """
        Compiles recent scene steps into a clean text transcript for LLM context.
        """
        recent = self.scene_history[-8:]
        transcript = []
        for s in recent:
            sp = s.get("speaker", "Narrator")
            dial = s.get("dialogue", "").strip()
            narr = s.get("narration", "").strip()
            
            if dial:
                transcript.append(f'{sp}: "{dial}"')
            if narr:
                transcript.append(f'({narr})')
        return "\n".join(transcript)

    def advance_story(self, prompt: str) -> Dict[str, Any]:
        """
        Advances the interactive novel story by one scene node.
        Includes RAG retrieval, LLM prompt formatting, image generation, and memory updates.
        """
        # 1. Query Local DB (RAG) for matching lore/memories based on user prompt
        lore_matches = db.search(prompt, tags=["lore", "world"], k=3)
        memory_matches = db.search(prompt, tags=["summary", "history"], k=2)
        
        active_lore = "\n".join([f"- {m['text']}" for m in lore_matches])
        memory_context = "\n".join([f"- {m['text']}" for m in memory_matches])
        
        # Add details of currently active characters
        if self.active_characters:
            char_lore = "\nActive Characters:\n" + "\n".join([
                f"- {name}: Personality is {c.get('personality')}. Current mood is {c.get('emotion_state')}."
                for name, c in self.active_characters.items()
            ])
            active_lore += char_lore

        # 2. Get LLM dialogue and structural instructions
        t_text_start = time.time()
        history_str = self.compile_history_context()
        scene_data = llm_service.generate_scene(prompt, history_str, memory_context, active_lore)
        t_text_elapsed = time.time() - t_text_start

        # 3. Synchronize background & character image generation
        t_img_start = time.time()
        bg_prompt = scene_data.get("bg_prompt", "aesthetic room visual novel background")
        char_prompt = scene_data.get("character_prompt", "")
        speaker = scene_data.get("speaker", "Narrator")
        emotion = scene_data.get("emotion", "Neutral")
        
        # Background generation trigger: Only generate new bg if details change significantly
        bg_filename = self.current_bg
        bg_triggered = False
        if bg_prompt and (not self.current_bg or any(word in bg_prompt.lower() for word in ["goes to", "arrives", "enters", "travels", "outside", "room", "hallway", "streets"])):
            bg_filename = image_gen_service.generate_image(bg_prompt, is_character=False)
            self.current_bg = bg_filename
            bg_triggered = True

        # Sprite generation trigger: Generate transparent sprite for speaking character
        sprite_filename = None
        sprite_triggered = False
        if char_prompt and speaker != "Narrator":
            # Pass character name for face consistency IP-Adapter triggers
            sprite_filename = image_gen_service.generate_image(f"{char_prompt}, expression {emotion}", is_character=True, character_name=speaker)
            self.current_sprite = sprite_filename
            sprite_triggered = True
            # Update internal character tracker
            if speaker not in self.active_characters:
                self.active_characters[speaker] = {"name": speaker}
            self.active_characters[speaker]["emotion_state"] = emotion
            
        t_img_elapsed = time.time() - t_img_start if (bg_triggered or sprite_triggered) else 0.0
        
        self.last_text_time = round(t_text_elapsed, 2)
        self.last_image_time = round(t_img_elapsed, 2)

        # 4. Save to history
        new_scene = {
            "speaker": speaker,
            "dialogue": scene_data.get("dialogue", ""),
            "narration": scene_data.get("narration", ""),
            "emotion": emotion,
            "camera_framing": scene_data.get("camera_framing", "medium"),
            "bg_image": bg_filename,
            "character_sprite": sprite_filename,
            "timestamp": time.time(),
            "text_time": self.last_text_time,
            "image_time": self.last_image_time
        }
        
        self.scene_history.append(new_scene)
        
        # Update current state variables
        self.current_speaker = speaker
        self.current_dialogue = new_scene["dialogue"]
        self.current_narration = new_scene["narration"]
        self.current_emotion = emotion
        self.current_camera = new_scene["camera_framing"]

        # 5. Check if we need to auto-summarize history (compact memory)
        # If history gets too large (e.g. > 15 segments), summarize early parts
        if len(self.scene_history) > 15:
            self._trigger_auto_summarization()

        return new_scene

    def _trigger_auto_summarization(self):
        """
        Slices oldest 8 scene history elements, sends to LLM to summarize, 
        stores summary in vector DB, and keeps history size compact.
        """
        logger.info("Triggering automatic scene history summarization to compact memory context.")
        slice_to_summarize = self.scene_history[:8]
        
        # Compile text
        transcript_parts = []
        for s in slice_to_summarize:
            sp = s.get("speaker", "Narrator")
            dial = s.get("dialogue", "")
            narr = s.get("narration", "")
            if dial:
                transcript_parts.append(f'{sp}: "{dial}"')
            if narr:
                transcript_parts.append(f'({narr})')
        transcript = "\n".join(transcript_parts)
        
        summary_prompt = (
            f"Write a concise summary of the following story events for character relationship and plot tracking:\n"
            f"{transcript}\n\n"
            f"Focus on key choices, characters present, and emotional developments. Summarize in 3 sentences max."
        )
        
        try:
            # Generate a summary using LLM service (we construct a direct prompt)
            system = "You are a story summarization assistant. Write only the summary."
            # Since generating a plain text summary, we map it
            summary_dict = llm_service._call_ollama(system, summary_prompt)
            summary_text = summary_dict.get("narration", "A transition in the story occurred.")
            
            # Save into vector database
            db.add_memory(
                text=f"Summary of previous events: {summary_text}",
                tags=["summary", "history", "story_progression"],
                metadata={"timestamp": time.time()}
            )
            logger.info(f"Auto-summary saved to memory: {summary_text}")
            
            # Slice the history to remove summarized parts
            self.scene_history = self.scene_history[8:]
        except Exception as e:
            logger.error(f"Failed to generate auto-summarization: {e}")

    def save_game(self, slot_id: int) -> str:
        """
        Serializes current story engine state to slot JSON.
        """
        save_data = {
            "slot_id": slot_id,
            "timestamp": time.time(),
            "active_story_id": self.active_story_id,
            "scene_history": self.scene_history,
            "world_state": self.world_state,
            "active_characters": self.active_characters,
            "current_bg": self.current_bg,
            "current_sprite": self.current_sprite,
            "current_speaker": self.current_speaker,
            "current_dialogue": self.current_dialogue,
            "current_narration": self.current_narration,
            "current_emotion": self.current_emotion,
            "current_camera": self.current_camera
        }
        
        save_filename = f"save_slot_{slot_id}.json"
        save_path = os.path.join(settings.SAVES_DIR, save_filename)
        
        with open(save_path, "w", encoding="utf-8") as f:
            json.dump(save_data, f, ensure_ascii=False, indent=2)
            
        logger.info(f"Saved game state to slot {slot_id}.")
        return save_filename

    def load_game(self, slot_id: int) -> bool:
        """
        Loads story engine state from slot JSON.
        """
        save_filename = f"save_slot_{slot_id}.json"
        save_path = os.path.join(settings.SAVES_DIR, save_filename)
        
        if not os.path.exists(save_path):
            logger.warning(f"No save file found in slot {slot_id}.")
            return False
            
        try:
            with open(save_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                
            self.active_story_id = data.get("active_story_id", "default_story")
            self.scene_history = data.get("scene_history", [])
            self.world_state = data.get("world_state", {})
            self.active_characters = data.get("active_characters", {})
            self.current_bg = data.get("current_bg")
            self.current_sprite = data.get("current_sprite")
            self.current_speaker = data.get("current_speaker", "Narrator")
            self.current_dialogue = data.get("current_dialogue", "")
            self.current_narration = data.get("current_narration", "")
            self.current_emotion = data.get("current_emotion", "Neutral")
            self.current_camera = data.get("current_camera", "medium")
            
            logger.info(f"Loaded game state from slot {slot_id}.")
            return True
        except Exception as e:
            logger.error(f"Error loading save slot {slot_id}: {e}")
            return False

    def get_save_slots(self) -> List[Dict[str, Any]]:
        """
        Returns info summary of all slots.
        """
        slots = []
        for slot_id in range(1, 10):  # Slots 1-9
            save_filename = f"save_slot_{slot_id}.json"
            save_path = os.path.join(settings.SAVES_DIR, save_filename)
            if os.path.exists(save_path):
                try:
                    with open(save_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    slots.append({
                        "slot_id": slot_id,
                        "exists": True,
                        "timestamp": data.get("timestamp"),
                        "last_speaker": data.get("current_speaker"),
                        "last_text": data.get("current_dialogue") or data.get("current_narration", "")[:60] + "...",
                        "bg_image": data.get("current_bg")
                    })
                except Exception:
                    slots.append({"slot_id": slot_id, "exists": False})
            else:
                slots.append({"slot_id": slot_id, "exists": False})
        return slots

story_engine = StoryEngine()
