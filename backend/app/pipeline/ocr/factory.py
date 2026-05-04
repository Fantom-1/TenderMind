from functools import lru_cache

from app.config import get_settings
from app.pipeline.ocr.base import OCREngine


@lru_cache(maxsize=4)
def get_ocr_engine() -> OCREngine:
    """Return the OCR engine selected in .env. Lazy-imports the heavy
    PaddleOCR module only if the user actually requests it."""
    s = get_settings()
    if s.ocr_engine == "paddle":
        from app.pipeline.ocr.paddle_engine import PaddleEngine

        return PaddleEngine()
    # default
    from app.pipeline.ocr.tesseract_engine import TesseractEngine

    return TesseractEngine()
