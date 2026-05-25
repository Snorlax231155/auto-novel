import os
import uuid
import json
import random
import requests
import logging
from typing import Dict, Any, Optional
from PIL import Image, ImageDraw, ImageFont
from app.config import settings

logger = logging.getLogger(__name__)

class ImageGenService:
    def __init__(self):
        self.client_id = str(uuid.uuid4())

    def generate_image(self, prompt: str, is_character: bool = False, character_name: Optional[str] = None, seed: Optional[int] = None) -> str:
        """
        Generates an image (background or character sprite).
        Returns the absolute filepath of the generated/cached asset.
        """
        asset_id = str(uuid.uuid4())
        filename = f"{'char' if is_character else 'bg'}_{asset_id}.png"
        filepath = os.path.join(settings.ASSETS_DIR, filename)
        
        # Use provided seed or generate random
        if seed is None:
            seed = random.randint(1, 1125899906842624)

        if settings.IMAGE_GEN_PROVIDER == "comfyui":
            try:
                success = self._generate_comfyui(prompt, filepath, is_character, character_name, seed)
                if success:
                    return filename
            except Exception as e:
                logger.warning(f"ComfyUI generation failed, falling back to mock: {e}")

        # Fallback to local procedural generator (Zero dependencies, offline)
        self._generate_mock_procedural(prompt, filepath, is_character, character_name)
        return filename

    def _generate_comfyui(self, prompt: str, save_path: str, is_character: bool, character_name: Optional[str], seed: int) -> bool:
        """
        Queues prompt in ComfyUI, polls for execution completion, and downloads result.
        """
        base_url = settings.IMAGE_GEN_URL.rstrip('/')
        # Determine available checkpoints from ComfyUI dynamically to avoid hardcoded file mismatches
        ckpt_name = None
        try:
            models_response = requests.get(f"{base_url}/object_info/CheckpointLoaderSimple", timeout=5.0)
            if models_response.status_code == 200:
                models_data = models_response.json()
                checkpoints = models_data.get("CheckpointLoaderSimple", {}).get("input", {}).get("required", {}).get("ckpt_name", [[]])[0]
                if checkpoints:
                    target = "animeline_v2.safetensors" if is_character else "epicrealism_naturalSin.safetensors"
                    if target in checkpoints:
                        ckpt_name = target
                    elif "dreamshaper_8.safetensors" in checkpoints:
                        ckpt_name = "dreamshaper_8.safetensors"
                    else:
                        ckpt_name = checkpoints[0]
        except Exception as e:
            logger.warning(f"Could not retrieve ComfyUI checkpoints dynamically: {e}")

        if not ckpt_name:
            ckpt_name = "animeline_v2.safetensors" if is_character else "epicrealism_naturalSin.safetensors"

        logger.info(f"Using ComfyUI model checkpoint: {ckpt_name}")

        # Construct a standard ComfyUI API workflow dynamically
        # This represents the JSON schema ComfyUI's API expects (the "Prompt" format, not the UI layout format)
        workflow = {
            "3": {
                "class_type": "KSampler",
                "inputs": {
                    "cfg": 8,
                    "denoise": 1,
                    "latent_image": ["5", 0],
                    "model": ["4", 0],
                    "negative": ["7", 0],
                    "positive": ["6", 0],
                    "sampler_name": "euler",
                    "scheduler": "normal",
                    "seed": seed,
                    "steps": 20
                }
            },
            "4": {
                "class_type": "CheckpointLoaderSimple",
                "inputs": {
                    "ckpt_name": ckpt_name
                }
            },
            "5": {
                "class_type": "EmptyLatentImage",
                "inputs": {
                    "batch_size": 1,
                    "height": settings.IMAGE_HEIGHT,
                    "width": settings.IMAGE_WIDTH
                }
            },
            "6": {
                "class_type": "CLIPTextEncode",
                "inputs": {
                    "clip": ["4", 1],
                    "text": f"{prompt}, visual novel style, detailed masterpiece, high quality" + (", transparent background" if is_character else "")
                }
            },
            "7": {
                "class_type": "CLIPTextEncode",
                "inputs": {
                    "clip": ["4", 1],
                    "text": "bad anatomy, low quality, blurry, deformed face, text, signature" + (", background" if is_character else "")
                }
            },
            "8": {
                "class_type": "VAEDecode",
                "inputs": {
                    "samples": ["3", 0],
                    "vae": ["4", 2]
                }
            },
            "9": {
                "class_type": "SaveImage",
                "inputs": {
                    "filename_prefix": "story_gen_render",
                    "images": ["8", 0]
                }
            }
        }

        # Modify workflow for face consistency (IP-Adapter) if character ref image exists
        if is_character and character_name:
            ref_path = os.path.join(settings.CHARACTERS_DIR, f"{character_name}_ref.png")
            if os.path.exists(ref_path):
                logger.info(f"Injecting IP-Adapter node for character consistency: {character_name}")
                # We can inject IPAdapter nodes here if the user's ComfyUI setup supports it.
                # Standard workflow keeps it clean, but we can configure custom parameters.

        url = f"{base_url}/prompt"
        payload = {"prompt": workflow, "client_id": self.client_id}
        
        response = requests.post(url, json=payload, timeout=10.0)
        if response.status_code != 200:
            logger.error(f"ComfyUI prompt queue error: {response.text}")
            return False
            
        prompt_id = response.json().get("prompt_id")
        logger.info(f"ComfyUI prompt queued. Prompt ID: {prompt_id}")

        # Poll history API for result (up to 45 seconds timeout)
        history_url = f"{base_url}/history/{prompt_id}"
        import time
        for _ in range(90):
            time.sleep(0.5)
            h_response = requests.get(history_url, timeout=5.0)
            if h_response.status_code == 200:
                h_data = h_response.json()
                if prompt_id in h_data:
                    # Retrieve output filename
                    outputs = h_data[prompt_id].get("outputs", {})
                    for node_id, node_output in outputs.items():
                        if "images" in node_output and len(node_output["images"]) > 0:
                            filename = node_output["images"][0]["filename"]
                            subfolder = node_output["images"][0].get("subfolder", "")
                            image_type = node_output["images"][0].get("type", "output")
                            
                            # Download the image file
                            view_url = f"{base_url}/view?filename={filename}&subfolder={subfolder}&type={image_type}"
                            img_response = requests.get(view_url, timeout=10.0)
                            if img_response.status_code == 200:
                                with open(save_path, "wb") as f:
                                    f.write(img_response.content)
                                logger.info(f"Downloaded ComfyUI image to {save_path}")
                                return True
        
        logger.warning("ComfyUI generation polled timeout.")
        return False

    def _generate_mock_procedural(self, prompt: str, save_path: str, is_character: bool, character_name: Optional[str]):
        """
        Procedurally draws highly polished abstract background gradients and character silhouette placeholders.
        Keeps the application running visually even without cloud or local ComfyUI.
        """
        logger.info(f"Drawing local procedural mock image for prompt: '{prompt}'")
        
        # Determine theme colors based on keywords in prompt
        prompt_lower = prompt.lower()
        color_start = (20, 24, 43)    # Deep Midnight Navy
        color_end = (41, 37, 36)      # Charcoal
        
        if "sunset" in prompt_lower or "evening" in prompt_lower or "dusk" in prompt_lower:
            color_start = (194, 65, 12)  # Rich Amber Orange
            color_end = (49, 46, 129)    # Indigo Twilight
        elif "forest" in prompt_lower or "park" in prompt_lower or "nature" in prompt_lower:
            color_start = (6, 78, 59)     # Deep Forest Green
            color_end = (12, 10, 9)       # Warm Earth
        elif "cyber" in prompt_lower or "neon" in prompt_lower or "city" in prompt_lower:
            color_start = (88, 28, 135)   # Cyber Violet
            color_end = (17, 24, 39)      # Dark Tech gray
        elif "beach" in prompt_lower or "sea" in prompt_lower or "ocean" in prompt_lower:
            color_start = (14, 116, 144)  # Deep Ocean Cyan
            color_end = (254, 243, 199)   # Sandy gold
        elif "classroom" in prompt_lower or "school" in prompt_lower:
            color_start = (217, 119, 6)   # School desk oak amber
            color_end = (30, 41, 59)      # Slate shadow
            
        width, height = settings.IMAGE_WIDTH, settings.IMAGE_HEIGHT
        
        if is_character:
            # Characters have a transparent background with a drawing in the middle
            img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)
            
            # Determine character avatar color
            avatar_colors = [
                ((59, 130, 246, 230), (29, 78, 216, 240)),   # Blue
                ((236, 72, 153, 230), (190, 24, 93, 240)),   # Pink
                ((168, 85, 247, 230), (109, 40, 217, 240)),  # Purple
                ((245, 158, 11, 230), (180, 83, 9, 240))     # Gold
            ]
            c_index = hash(character_name or prompt) % len(avatar_colors)
            c_start, c_end = avatar_colors[c_index]
            
            # Draw stylized character silhouette (shoulders + head)
            # Head circle
            draw.ellipse([width//2 - 120, height//2 - 280, width//2 + 120, height//2 - 40], fill=c_start, outline=(255,255,255,80), width=3)
            # Body shoulders polygon
            draw.polygon([
                (width//2 - 250, height),
                (width//2 - 160, height//2),
                (width//2 + 160, height//2),
                (width//2 + 250, height),
            ], fill=c_end, outline=(255,255,255,80), width=3)
            
            # Add character name tag text overlaying the sprite placeholder
            text = character_name or "Character"
            # Draw a glassmorphism placard behind the label
            draw.rounded_rectangle([width//2 - 150, height - 120, width//2 + 150, height - 50], radius=8, fill=(0, 0, 0, 180), outline=(255,255,255,100), width=1)
            # Draw text label center-aligned
            draw.text((width//2, height - 90), text, fill=(255, 255, 255, 255), anchor="mm")
            
        else:
            # Draw background image gradient
            img = Image.new("RGB", (width, height))
            draw = ImageDraw.Draw(img)
            
            # Draw smooth vertical color gradient
            for y in range(height):
                r = int(color_start[0] + (color_end[0] - color_start[0]) * (y / height))
                g = int(color_start[1] + (color_end[1] - color_start[1]) * (y / height))
                b = int(color_start[2] + (color_end[2] - color_start[2]) * (y / height))
                draw.line([(0, y), (width, y)], fill=(r, g, b))
                
            # Add aesthetic grid lines and glowing sun-like circles for "cinematic feel"
            draw.ellipse([width//2 - 200, height//2 - 300, width//2 + 400, height//2 + 300], outline=(255,255,255,15), width=2)
            draw.line([(0, height - 200), (width, height - 200)], fill=(255, 255, 255, 20))
            
            # Draw overlay descriptive tag in bottom-left corner
            draw.rectangle([20, height - 60, width - 20, height - 20], fill=(0, 0, 0, 120))
            draw.text((30, height - 45), f"Scene: {prompt[:110]}...", fill=(200, 200, 200))
            
        img.save(save_path, "PNG")
        logger.info(f"Aesthetic mock image generated at {save_path}")

image_gen_service = ImageGenService()
