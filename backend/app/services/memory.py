import os
import json
import uuid
import math
import time
import requests
import logging
from typing import List, Dict, Any, Optional
from app.config import settings

logger = logging.getLogger(__name__)

# Fallback TF-IDF Vectorizer to ensure 100% offline functionality without embedding models
class PurePythonVectorizer:
    def __init__(self, ndim: int = 128):
        self.ndim = ndim
        self.stop_words = {
            "is", "the", "a", "an", "in", "at", "where", "what", "of", "and", "to", 
            "for", "with", "on", "was", "were", "are", "it", "this", "that", "he", "she", 
            "they", "i", "you", "we"
        }
        
    def text_to_vector(self, text: str) -> List[float]:
        # Simple deterministic hashing vectorizer for zero-dependency sentence embedding fallback
        words = [w.strip(".,!?\"'()[]{}") for w in text.lower().split()]
        # Filter out stop words
        words = [w for w in words if w and w not in self.stop_words]
        
        vector = [0.0] * self.ndim
        if not words:
            return vector
            
        # Distribute word hashes over vector indices
        for i, word in enumerate(words):
            # Deterministic hash function for python
            h = 0
            for char in word:
                h = (31 * h + ord(char)) & 0xFFFFFFFF
            idx = h % self.ndim
            # Positional boost
            weight = 1.0 / (math.log(i + 2))
            vector[idx] += weight
            
        # Normalize the vector to unit length
        magnitude = math.sqrt(sum(x * x for x in vector))
        if magnitude > 0:
            vector = [x / magnitude for x in vector]
            
        return vector

class LocalVectorDB:
    def __init__(self):
        self.db_path = os.path.join(settings.LOREBOOK_DIR, "memories.json")
        self.memories: List[Dict[str, Any]] = []
        self.local_vectorizer = PurePythonVectorizer()
        self.load()

    def load(self):
        if os.path.exists(self.db_path):
            try:
                with open(self.db_path, "r", encoding="utf-8") as f:
                    self.memories = json.load(f)
                logger.info(f"Loaded {len(self.memories)} memories from local database.")
            except Exception as e:
                logger.error(f"Error loading memory DB, starting fresh: {e}")
                self.memories = []
        else:
            self.memories = []

    def save(self):
        try:
            with open(self.db_path, "w", encoding="utf-8") as f:
                json.dump(self.memories, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Error saving memory DB: {e}")

    def get_embedding(self, text: str) -> List[float]:
        """
        Retrieves embedding using chosen provider (Ollama, OpenAI) 
        and falls back to local hashing vectorizer if APIs fail.
        """
        if settings.EMBED_PROVIDER == "ollama":
            try:
                # Ollama support for embed API
                response = requests.post(
                    f"{settings.EMBED_API_URL}/api/embed",
                    json={"model": settings.EMBED_MODEL, "input": text},
                    timeout=5.0
                )
                if response.status_code == 200:
                    data = response.json()
                    # Some versions return 'embeddings' list, some return 'embedding'
                    if "embeddings" in data and len(data["embeddings"]) > 0:
                        return data["embeddings"][0]
                    elif "embedding" in data:
                        return data["embedding"]
                
                # Fallback to legacy embeddings endpoint if /api/embed fails
                response = requests.post(
                    f"{settings.EMBED_API_URL}/api/embeddings",
                    json={"model": settings.EMBED_MODEL, "prompt": text},
                    timeout=5.0
                )
                if response.status_code == 200:
                    return response.json().get("embedding", [])
            except Exception as e:
                logger.warning(f"Ollama embedding failed, falling back to TF-IDF vectorizer: {e}")
                
        elif settings.EMBED_PROVIDER == "openai":
            try:
                headers = {"Authorization": f"Bearer {settings.LLM_API_KEY}"}
                response = requests.post(
                    "https://api.openai.com/v1/embeddings",
                    headers=headers,
                    json={"model": "text-embedding-3-small", "input": text},
                    timeout=5.0
                )
                if response.status_code == 200:
                    return response.json()["data"][0]["embedding"]
            except Exception as e:
                logger.warning(f"OpenAI embedding failed, falling back to TF-IDF vectorizer: {e}")

        # Default local fallback
        return self.local_vectorizer.text_to_vector(text)

    def add_memory(self, text: str, tags: List[str], metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Store a new memory string, compute its embedding, and save database.
        """
        vector = self.get_embedding(text)
        memory_id = str(uuid.uuid4())
        new_memory = {
            "id": memory_id,
            "text": text,
            "vector": vector,
            "tags": [t.lower() for t in tags],
            "timestamp": time.time(),
            "metadata": metadata or {}
        }
        self.memories.append(new_memory)
        self.save()
        return new_memory

    def delete_memory(self, memory_id: str) -> bool:
        initial_len = len(self.memories)
        self.memories = [m for m in self.memories if m["id"] != memory_id]
        if len(self.memories) < initial_len:
            self.save()
            return True
        return False

    def clear_memories(self, tag_filter: Optional[str] = None):
        if tag_filter:
            tag_lower = tag_filter.lower()
            self.memories = [m for m in self.memories if tag_lower not in m.get("tags", [])]
        else:
            self.memories = []
        self.save()

    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        if not vec1 or not vec2 or len(vec1) != len(vec2):
            return 0.0
        dot_product = sum(x * y for x, y in zip(vec1, vec2))
        mag1 = math.sqrt(sum(x * x for x in vec1))
        mag2 = math.sqrt(sum(x * x for x in vec2))
        if mag1 == 0 or mag2 == 0:
            return 0.0
        return dot_product / (mag1 * mag2)

    def search(self, query: str, tags: Optional[List[str]] = None, k: int = 5, min_score: float = 0.1) -> List[Dict[str, Any]]:
        """
        Perform vector semantic search with optional tag matching and minimum score threshold.
        """
        if not self.memories:
            return []
            
        query_vector = self.get_embedding(query)
        matches = []
        
        # Prepare filter tags
        filter_tags = [t.lower() for t in tags] if tags else []

        for m in self.memories:
            # Tag match check: If filters are provided, the memory must match AT LEAST one filter tag
            if filter_tags:
                memory_tags = m.get("tags", [])
                if not any(ft in memory_tags for ft in filter_tags):
                    continue

            score = self.cosine_similarity(query_vector, m["vector"])
            if score >= min_score:
                # Exclude the heavy vector array from search results to keep API payloads light
                result = m.copy()
                result.pop("vector", None)
                result["score"] = score
                matches.append(result)

        # Sort descending by score
        matches.sort(key=lambda x: x["score"], reverse=True)
        return matches[:k]

# Global database instance
db = LocalVectorDB()
