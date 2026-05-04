import time
from typing import Any

import httpx

from app.config import get_settings
from app.pipeline.llm.base import LLMClient, LLMResponse, LLMUnavailable


class OllamaClient(LLMClient):
    """Talks to a local Ollama server. Model is pulled out of band:
       `ollama pull gemma3:4b`
    """

    def __init__(self, model: str | None = None, host: str | None = None) -> None:
        s = get_settings()
        self.model = model or s.llm_primary
        self.host = host or s.ollama_host
        self.timeout_s = s.llm_timeout_s
        self.default_temperature = s.llm_temperature

    def generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        json_mode: bool = False,
        temperature: float | None = None,
    ) -> LLMResponse:
        body: dict[str, Any] = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": (
                    self.default_temperature if temperature is None else temperature
                ),
            },
        }
        if system:
            body["system"] = system
        if json_mode:
            body["format"] = "json"

        started = time.monotonic()
        try:
            with httpx.Client(timeout=self.timeout_s) as client:
                resp = client.post(f"{self.host}/api/generate", json=body)
                resp.raise_for_status()
                data = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise LLMUnavailable(
                f"ollama call failed for model={self.model}: {exc}"
            ) from exc

        return LLMResponse(
            text=data.get("response", ""),
            model=self.model,
            latency_ms=int((time.monotonic() - started) * 1000),
            raw=data,
        )
