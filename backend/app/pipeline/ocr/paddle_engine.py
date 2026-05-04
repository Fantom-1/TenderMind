"""PaddleOCR adapter (multilingual: Hindi + English).

Imported only when OCR_ENGINE=paddle. PaddleOCR is a heavy install
(~1.5 GB of models) so we keep it optional. The interface matches
TesseractEngine so callers don't notice the swap.
"""
from PIL import Image

from app.pipeline.ocr.base import OCREngine, OCRPage, OCRWord


class PaddleEngine(OCREngine):
    def __init__(self) -> None:
        # Defer the import so missing-paddle errors only affect users who
        # explicitly opted in.
        try:
            from paddleocr import PaddleOCR  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "PaddleOCR is not installed. `pip install paddleocr paddlepaddle` "
                "or set OCR_ENGINE=tesseract in .env."
            ) from exc
        # Use multilingual model so we cover Hindi + English in one pass.
        self._ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)

    def ocr_image(self, image_path: str, page_number: int = 1) -> OCRPage:
        img = Image.open(image_path)
        result = self._ocr.ocr(image_path, cls=True)
        words: list[OCRWord] = []
        # PaddleOCR returns: [[ [bbox4points], (text, conf) ], ...]
        page_blocks = result[0] if result and result[0] else []
        for block in page_blocks:
            poly, (text, conf) = block
            xs = [p[0] for p in poly]
            ys = [p[1] for p in poly]
            words.append(
                OCRWord(
                    text=text.strip(),
                    confidence=float(conf),
                    bbox=(int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))),
                )
            )
        return OCRPage(
            page_number=page_number,
            text=" ".join(w.text for w in words if w.text),
            words=words,
            width=img.width,
            height=img.height,
            source="ocr",
        )
