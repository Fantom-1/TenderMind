"""Confidence scoring + verdict rules.

Q = 0.25*Q_ocr + 0.35*Q_ext + 0.30*Q_match + 0.10*Q_doc

Verdict rules:
  - mandatory criterion failed   -> not_eligible
  - any mandatory Q < threshold  -> needs_review
  - all mandatory met            -> eligible
Optional criteria never trigger not_eligible; they only lower the
overall confidence and may cause needs_review.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.config import get_settings


WEIGHTS = {"q_ocr": 0.25, "q_ext": 0.35, "q_match": 0.30, "q_doc": 0.10}

Verdict = Literal["eligible", "not_eligible", "needs_review"]


@dataclass
class CriterionScore:
    criterion_id: str
    mandatory: bool
    meets: bool | None      # True / False / None=not_found
    q_ocr: float
    q_ext: float
    q_match: float
    q_doc: float

    @property
    def total(self) -> float:
        return (
            WEIGHTS["q_ocr"] * self.q_ocr
            + WEIGHTS["q_ext"] * self.q_ext
            + WEIGHTS["q_match"] * self.q_match
            + WEIGHTS["q_doc"] * self.q_doc
        )

    def to_dict(self) -> dict:
        return {
            "criterion_id": self.criterion_id,
            "mandatory": self.mandatory,
            "meets": self.meets,
            "q_ocr": round(self.q_ocr, 3),
            "q_ext": round(self.q_ext, 3),
            "q_match": round(self.q_match, 3),
            "q_doc": round(self.q_doc, 3),
            "total": round(self.total, 3),
        }


def overall_verdict(scores: list[CriterionScore]) -> tuple[Verdict, float, str]:
    """Return (verdict, average_overall_confidence, plain_english_reason)."""
    s = get_settings()
    threshold = s.confidence_threshold

    if not scores:
        return ("needs_review", 0.0, "No criteria evaluated; nothing to decide on.")

    failed_mandatory = [c for c in scores if c.mandatory and c.meets is False]
    if failed_mandatory:
        ids = ", ".join(c.criterion_id for c in failed_mandatory)
        return (
            "not_eligible",
            sum(c.total for c in scores) / len(scores),
            f"Mandatory criteria failed: {ids}.",
        )

    low_or_unknown = [
        c
        for c in scores
        if c.mandatory and (c.meets is None or c.total < threshold)
    ]
    if low_or_unknown:
        ids = ", ".join(c.criterion_id for c in low_or_unknown)
        return (
            "needs_review",
            sum(c.total for c in scores) / len(scores),
            f"Officer review required for: {ids} "
            f"(low confidence or evidence not clearly found).",
        )

    return (
        "eligible",
        sum(c.total for c in scores) / len(scores),
        "All mandatory criteria met with confidence above threshold.",
    )


def doc_completeness(required: list[str], found: list[str]) -> float:
    """Q_doc: fraction of required evidence types that are present.

    Caller decides what counts as 'found' (e.g. document classifier or
    a per-bidder upload manifest). For the prototype, we treat anything
    listed in the bidder's uploaded filenames as present.
    """
    if not required:
        return 1.0
    needed = {r.lower() for r in required}
    have = {f.lower() for f in found}
    hits = sum(1 for n in needed if any(n in h or h in n for h in have))
    return hits / len(needed)
