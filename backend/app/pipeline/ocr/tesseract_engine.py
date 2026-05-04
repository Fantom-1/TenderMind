from pathlib import Path

from PIL import Image

from app.config import get_settings
from app.pipeline.ocr.base import OCREngine, OCRPage, OCRWord


class TesseractEngine(OCREngine):
    """Tesseract via pytesseract. Returns word-level bboxes + confidences."""

    def __init__(self) -> None:
        s = get_settings()
        # Lazy import so the module loads even if Tesseract isn't installed yet.
        import pytesseract

        self._pytesseract = pytesseract
        if s.tesseract_cmd and Path(s.tesseract_cmd).exists():
            pytesseract.pytesseract.tesseract_cmd = s.tesseract_cmd

    def ocr_image(self, image_path: str, page_number: int = 1) -> OCRPage:
        img = Image.open(image_path)
        # `image_to_data` gives us word-level data including conf + bbox.
        data = self._pytesseract.image_to_data(
            img,
            output_type=self._pytesseract.Output.DICT,
            lang="eng",
        )
        words: list[OCRWord] = []
        for i, txt in enumerate(data["text"]):
            txt = txt.strip()
            if not txt:
                continue
            try:
                conf_raw = float(data["conf"][i])
            except (ValueError, TypeError):
                conf_raw = -1.0
            if conf_raw < 0:
                continue
            x, y = int(data["left"][i]), int(data["top"][i])
            w, h = int(data["width"][i]), int(data["height"][i])
            words.append(
                OCRWord(
                    text=txt,
                    confidence=max(0.0, min(1.0, conf_raw / 100.0)),
                    bbox=(x, y, x + w, y + h),
                )
            )
        text = " ".join(w.text for w in words)
        return OCRPage(
            page_number=page_number,
            text=text,
            words=words,
            width=img.width,
            height=img.height,
            source="ocr",
        )
