from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class OCRWord:
    text: str
    confidence: float        # 0.0 - 1.0
    bbox: tuple[int, int, int, int]   # (x0, y0, x1, y1) in pixels


@dataclass
class OCRPage:
    page_number: int                  # 1-based
    text: str
    words: list[OCRWord] = field(default_factory=list)
    width: int = 0
    height: int = 0
    source: str = "ocr"               # "ocr" | "digital" | "mixed"

    @property
    def avg_confidence(self) -> float:
        if not self.words:
            # Digital-PDF pages have no per-word confidence; trust them.
            return 1.0 if self.source == "digital" else 0.0
        return sum(w.confidence for w in self.words) / len(self.words)


class OCREngine(ABC):
    @abstractmethod
    def ocr_image(self, image_path: str, page_number: int = 1) -> OCRPage:
        """Run OCR on a single rasterised page."""
