from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


class LLMUnavailable(RuntimeError):
    """Raised when the configured LLM cannot be reached.

    Callers MUST translate this into a NEEDS_REVIEW outcome -- never a
    silent pass or a fabricated value. This is a non-negotiable rule
    from the doc's 'no silent rejections' guarantee.
    """


@dataclass
class LLMResponse:
    text: str
    model: str
    latency_ms: int
    raw: dict[str, Any]


class LLMClient(ABC):
    """Adapter contract. The factory swaps implementations based on .env."""

    @abstractmethod
    def generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        json_mode: bool = False,
        temperature: float | None = None,
    ) -> LLMResponse:
        """Run a single completion. Raises LLMUnavailable on failure."""
