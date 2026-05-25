import os
import json
from pydantic import BaseModel

class Settings(BaseModel):
    # App Paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_DIR: str = os.path.join(BASE_DIR, "data")
    ASSETS_DIR: str = os.path.join(DATA_DIR, "assets")
    SAVES_DIR: str = os.path.join(DATA_DIR, "saves")
    CHARACTERS_DIR: str = os.path.join(DATA_DIR, "characters")
    LOREBOOK_DIR: str = os.path.join(DATA_DIR, "lorebook")
    
    # LLM Settings
    LLM_PROVIDER: str = "ollama"  # ollama, openai, openrouter, koboldcpp, llamacpp
    LLM_API_URL: str = "http://localhost:11434"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "llama3"
    LLM_TEMPERATURE: float = 0.7
    
    # Embedding Settings
    EMBED_PROVIDER: str = "ollama"  # ollama, openai, local_tfidf
    EMBED_API_URL: str = "http://localhost:11434"
    EMBED_MODEL: str = "nomic-embed-text"
    
    # Image Generation Settings
    IMAGE_GEN_PROVIDER: str = "comfyui"  # comfyui, sd_webui, mock
    IMAGE_GEN_URL: str = "http://127.0.0.1:8188"
    IMAGE_WIDTH: int = 1024
    IMAGE_HEIGHT: int = 1024
    IMAGE_STRENGTH: float = 0.7
    
    # Video Generation Settings (Optional)
    VIDEO_GEN_PROVIDER: str = "mock"  # mock, wan, svd
    VIDEO_GEN_URL: str = "http://localhost:8189"
    
    # Save & General settings
    ENCRYPT_SAVES: bool = False
    ENCRYPTION_KEY: str = "visual-novel-secret-key-32chars!"
    
    def ensure_dirs(self):
        for path in [self.DATA_DIR, self.ASSETS_DIR, self.SAVES_DIR, self.CHARACTERS_DIR, self.LOREBOOK_DIR]:
            os.makedirs(path, exist_ok=True)

    def get_settings_file(self) -> str:
        return os.path.join(self.DATA_DIR, "settings.json")

    def load(self):
        file_path = self.get_settings_file()
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for k, v in data.items():
                    if hasattr(self, k):
                        setattr(self, k, v)
            except Exception as e:
                print(f"Error loading settings.json: {e}")

    def save(self):
        self.ensure_dirs()
        file_path = self.get_settings_file()
        exclude_fields = {"BASE_DIR", "DATA_DIR", "ASSETS_DIR", "SAVES_DIR", "CHARACTERS_DIR", "LOREBOOK_DIR"}
        data = {k: v for k, v in self.dict().items() if k not in exclude_fields}
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Error saving settings.json: {e}")

settings = Settings()
settings.load()
settings.ensure_dirs()

