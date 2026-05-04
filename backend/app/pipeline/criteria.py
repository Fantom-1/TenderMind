"""Tender -> structured criterion list.

Two passes:
  1. Heuristic split into candidate sections (eligibility / pre-qualification
     / technical criteria / qualifying requirements).
  2. Per-section LLM extraction with strict JSON output.

Every criterion MUST carry source_page + source_text -- pydantic enforces it.
"""
from __future__ import annotations

import json
import re
import time
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.db.mongo import get_mongo_db
from app.pipeline.extract import extract_pdf, extract_docx
from app.pipeline.llm import get_llm_client
from app.pipeline.llm.prompts import load_prompt, render
from app.pipeline.ocr.base import OCRPage


CriterionType = Literal["financial", "experience", "certification", "technical", "compliance"]
ComparisonOp = Literal["gte", "lte", "eq", "exists", "match"]

SECTION_HEADERS = re.compile(
    r"(eligibilit(?:y|ies)|pre[-\s]?qualif|technical[\s]+criteria|"
    r"qualifying[\s]+requirements?|minimum[\s]+(?:qualif|criteria))",
    re.IGNORECASE,
)


class Criterion(BaseModel):
    id: str
    type: CriterionType
    mandatory: bool
    description: str
    evidence_required: list[str] = Field(default_factory=list)
    comparison: ComparisonOp | None = None
    threshold: float | str | None = None
    unit: str | None = None
    source_page: int
    source_text: str
    note: str | None = None

    @field_validator("source_text")
    @classmethod
    def _non_empty_source(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("source_text is required and cannot be empty")
        return v


def _split_into_sections(pages: list[OCRPage]) -> list[tuple[int, str, str]]:
    """Return [(page, section_title, text)] candidate sections.

    Strategy: scan pages whose text contains an eligibility-style header,
    take that page + the next two pages as the section payload (handles
    cross-page criteria).
    """
    sections: list[tuple[int, str, str]] = []
    for i, page in enumerate(pages):
        m = SECTION_HEADERS.search(page.text or "")
        if not m:
            continue
        title = m.group(0).title()
        chunk_pages = pages[i : i + 3]
        text = "\n\n".join(f"[PAGE {p.page_number}]\n{p.text}" for p in chunk_pages)
        sections.append((page.page_number, title, text))
    if not sections and pages:
        # Fallback: send the whole document as one section.
        text = "\n\n".join(f"[PAGE {p.page_number}]\n{p.text}" for p in pages)
        sections.append((pages[0].page_number, "Tender (full)", text))
    return sections


def _parse_llm_json(raw: str) -> dict:
    """Strip code fences if any, then json.loads."""
    s = raw.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s)
        s = re.sub(r"\s*```$", "", s)
    return json.loads(s)


def extract_criteria_from_text(pages: list[OCRPage]) -> list[Criterion]:
    template = load_prompt("criterion_extraction")
    client = get_llm_client()
    mongo_calls = get_mongo_db()["llm_calls"]

    out: list[Criterion] = []
    counter = 0
    for page_no, title, text in _split_into_sections(pages):
        prompt = render(template, page=page_no, section_title=title, text=text[:8000])
        started = time.monotonic()
        resp = client.generate(prompt, json_mode=True)
        mongo_calls.insert_one(
            {
                "kind": "criterion_extraction",
                "model": resp.model,
                "page": page_no,
                "section_title": title,
                "latency_ms": resp.latency_ms,
                "response_preview": resp.text[:2000],
            }
        )
        try:
            data = _parse_llm_json(resp.text)
        except json.JSONDecodeError:
            # The LLM returned something un-parseable. Skip rather than crash;
            # the section will simply produce zero criteria and a human can re-run.
            continue
        for raw in data.get("criteria", []):
            counter += 1
            raw.setdefault("id", f"C-{counter:02d}")
            raw.setdefault("source_page", page_no)
            try:
                out.append(Criterion(**raw))
            except Exception:  # pydantic ValidationError
                # Drop malformed criteria rather than corrupt downstream stages.
                continue
    return out


def extract_criteria_from_file(tender_id: int, file_path: str) -> list[Criterion]:
    suffix = file_path.lower().rsplit(".", 1)[-1]
    if suffix == "pdf":
        pages = extract_pdf(file_path)
    elif suffix in {"docx", "doc"}:
        pages = extract_docx(file_path)
    else:
        raise ValueError(f"unsupported tender format: {suffix}")

    criteria = extract_criteria_from_text(pages)

    coll = get_mongo_db()["criteria"]
    coll.delete_many({"tender_id": tender_id})
    if criteria:
        coll.insert_many(
            [{"tender_id": tender_id, **c.model_dump()} for c in criteria]
        )
    return criteria
