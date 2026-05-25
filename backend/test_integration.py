import sys
import os

# Adjust path to import backend app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.config import settings
from app.services.memory import db
from app.services.llm import llm_service
from app.services.story import story_engine
from app.services.tavern import tavern_service

def test_config():
    print("[-] Testing Configuration settings...")
    settings.ensure_dirs()
    assert os.path.exists(settings.DATA_DIR)
    assert os.path.exists(settings.ASSETS_DIR)
    print("[+] Configuration ok.")

def test_vector_db():
    print("[-] Testing local Vector Database (NumPy-free)...")
    db.clear_memories()
    
    # Add dummy memories
    db.add_memory("Alice loves studying chemistry in the library.", tags=["character", "alice"])
    db.add_memory("The magical tower of Aethelgard float above the clouds.", tags=["lore", "world"])
    db.add_memory("Bob is cautious and dislikes magic.", tags=["character", "bob"])
    
    # Query test
    print(f"Index size: {len(db.memories)}")
    query = "Where is chemistry studied?"
    q_vec = db.get_embedding(query)
    print(f"Query vector len: {len(q_vec)}, sum: {sum(q_vec)}")
    for idx, m in enumerate(db.memories):
        score = db.cosine_similarity(q_vec, m["vector"])
        print(f"Memory {idx}: text='{m['text']}' tags={m['tags']} vec_len={len(m['vector'])} score={score:.4f}")
    matches = db.search(query, tags=["character"], k=1)
    assert len(matches) > 0
    assert "chemistry" in matches[0]["text"]
    print(f"[+] Vector DB search matched: '{matches[0]['text']}' (Score: {matches[0]['score']:.3f})")
    
    matches_lore = db.search("floating tower", tags=["lore"], k=1)
    assert len(matches_lore) > 0
    assert "Aethelgard" in matches_lore[0]["text"]
    print(f"[+] Vector DB lore matched: '{matches_lore[0]['text']}' (Score: {matches_lore[0]['score']:.3f})")
    print("[+] Local Vector DB ok.")

def test_llm_parser():
    print("[-] Testing LLM response parser and regex fallbacks...")
    mock_json_response = (
        "Here is the next scene content:\n"
        "```json\n"
        "{\n"
        '  "speaker": "Alice",\n'
        '  "dialogue": "Hello Bob! Did you see the floating tower?",\n'
        '  "narration": "Alice waves at Bob from the school hallway.",\n'
        '  "emotion": "Happy",\n'
        '  "camera_framing": "close-up",\n'
        '  "bg_prompt": "school hallway",\n'
        '  "character_prompt": "girl waving"\n'
        "}\n"
        "```"
    )
    parsed = llm_service._parse_llm_response(mock_json_response)
    assert parsed["speaker"] == "Alice"
    assert parsed["emotion"] == "Happy"
    assert parsed["camera_framing"] == "close-up"
    print("[+] LLM Response Parser ok.")

def test_story_engine():
    print("[-] Testing Story Engine in Mock/Offline mode...")
    story_engine.reset_story()
    
    # Configure mock generation to run offline
    settings.IMAGE_GEN_PROVIDER = "mock"
    settings.LLM_PROVIDER = "ollama"  # Will trigger mock fallback if Ollama server is offline
    
    # Advance story
    scene = story_engine.advance_story("Bob meets Alice in the hallway.")
    
    assert scene is not None
    assert story_engine.current_bg is not None
    assert os.path.exists(os.path.join(settings.ASSETS_DIR, story_engine.current_bg))
    
    print(f"[+] Story Engine advanced. Current speaker: {story_engine.current_speaker}")
    print(f"[+] Narration: {story_engine.current_narration}")
    print(f"[+] Background asset generated: {story_engine.current_bg}")
    print("[+] Story Engine ok.")

if __name__ == "__main__":
    print("=== STARTING INTEGRATION TESTS ===")
    try:
        test_config()
        test_vector_db()
        test_llm_parser()
        test_story_engine()
        print("=== ALL INTEGRATION TESTS PASSED ===")
        sys.exit(0)
    except AssertionError as e:
        print(f"[!] TEST FAILURE: Assertion failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[!] TEST FAILURE: Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
