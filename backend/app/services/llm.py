import json
import re
import requests
import logging
from typing import Dict, Any, List, Optional
from app.config import settings

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self):
        pass

    def _get_system_prompt(self) -> str:
        return (
            "You are an expert interactive storytelling and visual novel engine.\n"
            "Your job is to generate the next scene step based on the prompt, active lore, and memory context.\n"
            "You must return ONLY a JSON object. Do not wrap the JSON in markdown code blocks. Do not write explanations.\n"
            "Format the output EXACTLY as follows:\n"
            "{\n"
            '  "speaker": "Character Name or Narrator",\n'
            '  "dialogue": "Spoken dialogue here, or empty if only narration.",\n'
            '  "narration": "Narration text describing action, environment, or thoughts.",\n'
            '  "emotion": "Neutral, Happy, Angry, Sad, Surprised, Blushing, Fearful, or Determined",\n'
            '  "camera_framing": "medium, close-up, wide, pan-left, pan-right, or shake",\n'
            '  "bg_prompt": "Descriptive background prompt for image generation (e.g. cozy bedroom, soft evening light, anime style)",\n'
            '  "character_prompt": "Descriptive prompt for the speaking character\'s sprite generation (e.g. young woman with blue hair, wearing a school uniform)"\n'
            "}"
        )

    def _parse_llm_response(self, text: str) -> Dict[str, Any]:
        """
        Parses LLM response into structured dict. 
        Uses regex fallback if the LLM output is not perfect JSON.
        """
        clean_text = text.strip()
        # Remove potential markdown code blocks
        if clean_text.startswith("```"):
            # Remove ```json or ``` and the trailing ```
            lines = clean_text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            clean_text = "\n".join(lines).strip()
            
        try:
            return json.loads(clean_text)
        except json.JSONDecodeError:
            logger.warning("Failed to parse LLM response as JSON directly. Attempting regex extraction.")
            
            # Try to extract anything between { and }
            match = re.search(r"\{.*\}", clean_text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(0))
                except json.JSONDecodeError:
                    pass
            
            # Absolute fallback: Parse via regex keys
            speaker_match = re.search(r'"speaker"\s*:\s*"([^"]*)"', clean_text)
            dialogue_match = re.search(r'"dialogue"\s*:\s*"([^"]*)"', clean_text)
            narration_match = re.search(r'"narration"\s*:\s*"([^"]*)"', clean_text)
            emotion_match = re.search(r'"emotion"\s*:\s*"([^"]*)"', clean_text)
            camera_match = re.search(r'"camera_framing"\s*:\s*"([^"]*)"', clean_text)
            bg_prompt_match = re.search(r'"bg_prompt"\s*:\s*"([^"]*)"', clean_text)
            char_prompt_match = re.search(r'"character_prompt"\s*:\s*"([^"]*)"', clean_text)
            
            return {
                "speaker": speaker_match.group(1) if speaker_match else "Narrator",
                "dialogue": dialogue_match.group(1) if dialogue_match else "",
                "narration": narration_match.group(1) if narration_match else clean_text[:200],
                "emotion": emotion_match.group(1) if emotion_match else "Neutral",
                "camera_framing": camera_match.group(1) if camera_match else "medium",
                "bg_prompt": bg_prompt_match.group(1) if bg_prompt_match else "scenic background, anime style",
                "character_prompt": char_prompt_match.group(1) if char_prompt_match else ""
            }

    def generate_scene(self, prompt: str, history_context: str, memory_context: str, active_lore: str) -> Dict[str, Any]:
        """
        Sends the VN context to the configured LLM and returns parsed scene JSON.
        """
        system = self._get_system_prompt()
        
        user_prompt = (
            f"LORE BOOK & WORLD INFO CONTEXT:\n{active_lore}\n\n"
            f"RELEVANT MEMORIES (RAG):\n{memory_context}\n\n"
            f"RECENT SCENE HISTORY:\n{history_context}\n\n"
            f"CURRENT STORY BEAT / USER DIRECTION:\n{prompt}\n\n"
            f"Generate the next scene. Keep the dialogue and narration atmospheric, engaging, and in character."
        )
        
        if settings.LLM_PROVIDER in ["openai", "openrouter"]:
            return self._call_openai_compatible(system, user_prompt)
        elif settings.LLM_PROVIDER in ["koboldcpp", "llamacpp"]:
            return self._call_kobold_llamacpp(system, user_prompt)
        else:
            # Default to Ollama
            return self._call_ollama(system, user_prompt)

    def _call_ollama(self, system: str, prompt: str) -> Dict[str, Any]:
        url = f"{settings.LLM_API_URL.rstrip('/')}/api/generate"
        payload = {
            "model": settings.LLM_MODEL,
            "system": system,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": settings.LLM_TEMPERATURE
            },
            "format": "json"
        }
        try:
            response = requests.post(url, json=payload, timeout=120.0)
            if response.status_code == 200:
                result = response.json()
                return self._parse_llm_response(result.get("response", ""))
            else:
                logger.error(f"Ollama returned error {response.status_code}: {response.text}")
        except Exception as e:
            logger.error(f"Error communicating with Ollama: {e}")
            
        return self._get_mock_fallback("Ollama Connection Offline", prompt)

    def _call_openai_compatible(self, system: str, prompt: str) -> Dict[str, Any]:
        # Handles OpenAI, OpenRouter, LM Studio
        url = settings.LLM_API_URL
        if "v1/chat/completions" not in url:
            # Append if missing
            url = url.rstrip("/")
            if not url.endswith("/v1"):
                url += "/v1"
            url += "/chat/completions"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.LLM_API_KEY}"
        }
        
        payload = {
            "model": settings.LLM_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt}
            ],
            "temperature": settings.LLM_TEMPERATURE,
            "response_format": {"type": "json_object"}
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30.0)
            if response.status_code == 200:
                result = response.json()
                content = result["choices"][0]["message"]["content"]
                return self._parse_llm_response(content)
            else:
                logger.error(f"OpenAI compatible API returned {response.status_code}: {response.text}")
        except Exception as e:
            logger.error(f"Error calling OpenAI API: {e}")
            
        return self._get_mock_fallback("Cloud AI Offline", prompt)

    def _call_kobold_llamacpp(self, system: str, prompt: str) -> Dict[str, Any]:
        # Fallback raw prompt formulation for Kobold/llama.cpp engines
        base_url = settings.LLM_API_URL.rstrip('/')
        url = f"{base_url}/api/v1/generate" if "kobold" in settings.LLM_PROVIDER else f"{base_url}/completion"
        
        full_prompt = f"<|system|>\n{system}\n<|user|>\n{prompt}\n<|assistant|>\n"
        
        payload = {
            "prompt": full_prompt,
            "max_context_length": 4096,
            "max_length": 512,
            "temperature": settings.LLM_TEMPERATURE
        }
        
        try:
            response = requests.post(url, json=payload, timeout=30.0)
            if response.status_code == 200:
                data = response.json()
                text = data["results"][0]["text"] if "results" in data else data.get("content", "")
                return self._parse_llm_response(text)
        except Exception as e:
            logger.error(f"Error calling Kobold/llama.cpp: {e}")
            
        return self._get_mock_fallback("Local API Offline", prompt)

    def _get_mock_fallback(self, reason: str, prompt: str) -> Dict[str, Any]:
        """
        Creates a clean mock scene in case the LLM API is unavailable.
        """
        logger.info("Using mock fallback scene generation.")
        return {
            "speaker": "Narrator",
            "dialogue": "",
            "narration": f"[AI Engine: {reason}] You stand at the boundary of a story yet unwritten. The system is offline, but the environment responds silently.",
            "emotion": "Neutral",
            "camera_framing": "wide",
            "bg_prompt": "a beautiful fantasy landscape, clouds parting, visual novel background style",
            "character_prompt": ""
        }

llm_service = LLMService()
