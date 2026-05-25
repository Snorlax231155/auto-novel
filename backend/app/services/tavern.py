import os
import json
import base64
import logging
import shutil
from typing import Dict, Any, Optional, Tuple
from PIL import Image
from app.config import settings

logger = logging.getLogger(__name__)

class TavernCardService:
    def __init__(self):
        pass

    def extract_metadata_from_png(self, png_path: str) -> Optional[Dict[str, Any]]:
        """
        Reads a SillyTavern PNG card, extracts the 'chara' metadata chunk, 
        decodes it, and returns the character definition dictionary.
        """
        try:
            with Image.open(png_path) as img:
                info = img.info
                # Check for standard SillyTavern metadata keys
                chara_data = None
                if "chara" in info:
                    chara_data = info["chara"]
                elif "ccv3" in info:
                    # Some cards use ccv3 metadata
                    chara_data = info["ccv3"]
                    
                if not chara_data:
                    logger.warning("No character metadata key found in PNG. Checking raw text tags.")
                    # Try manual text keys
                    for k, v in info.items():
                        if k.lower() in ["chara", "character", "sillytavern", "ccv3"]:
                            chara_data = v
                            break

                if not chara_data:
                    return None

                # SillyTavern standard: base64 encoded JSON
                try:
                    # Check if it is base64 encoded
                    decoded_bytes = base64.b64decode(chara_data)
                    decoded_str = decoded_bytes.decode("utf-8")
                    return json.loads(decoded_str)
                except Exception:
                    # Try parsing directly as raw JSON string
                    try:
                        return json.loads(chara_data)
                    except Exception as e:
                        logger.error(f"Failed to decode chara string: {e}")
                        return None
        except Exception as e:
            logger.error(f"Error opening PNG card: {e}")
            return None

    def import_tavern_card(self, file_path: str, is_png: bool = True) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Imports a SillyTavern card (either PNG or JSON).
        Returns success status and the imported character profile.
        """
        try:
            character_data = {}
            character_name = "Unnamed"
            
            if is_png:
                metadata = self.extract_metadata_from_png(file_path)
                if not metadata:
                    return False, None
                
                # SillyTavern stores character data inside "data" dictionary in newer card versions
                if "data" in metadata:
                    character_data = metadata["data"]
                else:
                    character_data = metadata
                    
                character_name = character_data.get("name", "Imported_Character").strip().replace(" ", "_")
                
                # Copy PNG as reference image for ComfyUI IP-Adapter consistency
                dest_ref_path = os.path.join(settings.CHARACTERS_DIR, f"{character_name}_ref.png")
                shutil.copyfile(file_path, dest_ref_path)
                logger.info(f"Copied Tavern card image as character reference: {dest_ref_path}")
            else:
                # Raw JSON import
                with open(file_path, "r", encoding="utf-8") as f:
                    metadata = json.load(f)
                if "data" in metadata:
                    character_data = metadata["data"]
                else:
                    character_data = metadata
                character_name = character_data.get("name", "Imported_Character").strip().replace(" ", "_")

            # Map Tavern structure to Visual Novel structure
            vn_profile = {
                "name": character_data.get("name", "Unnamed"),
                "description": character_data.get("description", ""),
                "personality": character_data.get("personality", ""),
                "first_mes": character_data.get("first_mes", "Hello there."),
                "scenario": character_data.get("scenario", ""),
                "mes_example": character_data.get("mes_example", ""),
                "creator_notes": character_data.get("creator_notes", ""),
                "relationship": 50,  # Starting baseline
                "emotion_state": "Neutral",
                "outfit": "Default",
                "traits": character_data.get("personality", "").split(","),
                "ref_image": f"{character_name}_ref.png" if is_png else None
            }

            # Save the visual novel profile locally
            profile_path = os.path.join(settings.CHARACTERS_DIR, f"{character_name}.json")
            with open(profile_path, "w", encoding="utf-8") as f:
                json.dump(vn_profile, f, ensure_ascii=False, indent=2)
            
            logger.info(f"Successfully imported SillyTavern character: {character_name}")
            return True, vn_profile

        except Exception as e:
            logger.error(f"Error importing SillyTavern character: {e}")
            return False, None

    def export_character_card(self, character_name: str) -> Optional[str]:
        """
        Exports a VN character profile back as a standard SillyTavern compatible JSON file.
        """
        try:
            profile_path = os.path.join(settings.CHARACTERS_DIR, f"{character_name}.json")
            if not os.path.exists(profile_path):
                return None
                
            with open(profile_path, "r", encoding="utf-8") as f:
                vn_profile = json.load(f)
                
            tavern_data = {
                "name": vn_profile.get("name", character_name),
                "description": vn_profile.get("description", ""),
                "personality": vn_profile.get("personality", ""),
                "first_mes": vn_profile.get("first_mes", ""),
                "scenario": vn_profile.get("scenario", ""),
                "mes_example": vn_profile.get("mes_example", "")
            }
            
            # Warp in ST v2 format wrapper
            export_payload = {
                "chara_version": "1",
                "data": tavern_data
            }
            
            export_path = os.path.join(settings.DATA_DIR, f"{character_name}_ST_export.json")
            with open(export_path, "w", encoding="utf-8") as f:
                json.dump(export_payload, f, ensure_ascii=False, indent=2)
                
            return export_path
        except Exception as e:
            logger.error(f"Error exporting character card: {e}")
            return None

tavern_service = TavernCardService()
