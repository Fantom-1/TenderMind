from functools import lru_cache

from app.config import get_settings
from app.pipeline.llm.base import LLMClient
from app.pipeline.llm.ollama_client import OllamaClient


@lru_cache(maxsize=4)
def get_llm_client() -> LLMClient:
    """Return the configured LLM client. Today only Ollama; the factory
    exists so additional backends (vLLM, llama.cpp) can be added without
    touching call sites."""
    _ = get_settings()  # forces .env load + dir creation
    return OllamaClient()
