"""Per-(bidder, criterion) evidence extraction.

Pipeline:
  1. Embed criterion description.
  2. Retrieve top-k bidder passages from Chroma.
  3. Ask the LLM to extract a value, decide pass/fail, and self-report
     extraction_confidence + match_confidence.
  4. Fold OCR confidence and document-completeness into a CriterionScore.
  5. Persist the full evidence record (chain-of-thought, sub-scores,
     source page, source text) to mongo.evidence.

Critical rule: on LLMUnavailable -> NEEDS_REVIEW with a clear reason.
Never fabricate, never silent-pass.
"""
from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from typing import Any

from app.db.mongo import get_mongo_db
from app.pipeline.confidence import CriterionScore, doc_completeness
from app.pipeline.criteria import Criterion
from app.pipeline.llm import LLMUnavailable, get_llm_client
from app.pipeline.llm.prompts import load_prompt, render
from app.pipeline.matcher import search_bidder


@dataclass
class EvidenceResult:
    score: CriterionScore
    extracted_value: Any
    reason: str
    source_page: int | None
    source_text: str | None
    chain_of_thought: dict


def _parse_llm_json(raw: str) -> dict:
    s = raw.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s)
        s = re.sub(r"\s*```$", "", s)
    return json.loads(s)


def _avg_ocr_for_pages(bidder_id: int, page_numbers: set[int]) -> float:
    if not page_numbers:
        return 0.0
    coll = get_mongo_db()["ocr_pages"]
    cur = coll.find(
        {"doc_kind": "bidder", "doc_id": bidder_id, "page_number": {"$in": list(page_numbers)}},
        {"avg_confidence": 1},
    )
    confs = [doc.get("avg_confidence", 0.0) for doc in cur]
    return sum(confs) / len(confs) if confs else 0.0


def evaluate_one(
    *,
    bidder_id: int,
    criterion: Criterion,
    bidder_filenames: list[str],
    k: int = 4,
) -> EvidenceResult:
    passages = search_bidder(bidder_id, criterion.description, k=k)

    q_doc = doc_completeness(criterion.evidence_required, bidder_filenames)

    if not passages:
        score = CriterionScore(
            criterion_id=criterion.id,
            mandatory=criterion.mandatory,
            meets=None,
            q_ocr=0.0,
            q_ext=0.0,
            q_match=0.0,
            q_doc=q_doc,
        )
        return EvidenceResult(
            score=score,
            extracted_value=None,
            reason="No matching evidence passages found in bidder documents.",
            source_page=None,
            source_text=None,
            chain_of_thought={"reason": "no_passages"},
        )

    template = load_prompt("evidence_extraction")
    rendered_passages = "\n\n---\n\n".join(
        f"[PAGE {p.page_number} | retrieval_score={p.score:.2f}]\n{p.text[:1500]}"
        for p in passages
    )
    prompt = render(
        template,
        criterion_id=criterion.id,
        criterion_desc=criterion.description,
        comparison=str(criterion.comparison or ""),
        threshold=str(criterion.threshold or ""),
        unit=str(criterion.unit or ""),
        passages=rendered_passages,
    )

    client = get_llm_client()
    started = time.monotonic()
    try:
        resp = client.generate(prompt, json_mode=True)
        cot = _parse_llm_json(resp.text)
    except (LLMUnavailable, json.JSONDecodeError) as exc:
        score = CriterionScore(
            criterion_id=criterion.id,
            mandatory=criterion.mandatory,
            meets=None,
            q_ocr=_avg_ocr_for_pages(bidder_id, {p.page_number for p in passages}),
            q_ext=0.0,
            q_match=0.0,
            q_doc=q_doc,
        )
        return EvidenceResult(
            score=score,
            extracted_value=None,
            reason=f"LLM unavailable or returned invalid JSON: {exc}. Escalated to officer.",
            source_page=passages[0].page_number,
            source_text=passages[0].text[:500],
            chain_of_thought={"error": str(exc)},
        )

    found = bool(cot.get("found"))
    meets = cot.get("meets_criterion") if found else None
    q_ext = float(cot.get("extraction_confidence", 0.0)) if found else 0.0
    q_match = float(cot.get("match_confidence", 0.0)) if meets is not None else 0.0
    src_page = cot.get("source_page") or passages[0].page_number
    pages_for_ocr = {p.page_number for p in passages} | ({src_page} if src_page else set())
    q_ocr = _avg_ocr_for_pages(bidder_id, pages_for_ocr)

    score = CriterionScore(
        criterion_id=criterion.id,
        mandatory=criterion.mandatory,
        meets=bool(meets) if meets is not None else None,
        q_ocr=max(0.0, min(1.0, q_ocr)),
        q_ext=max(0.0, min(1.0, q_ext)),
        q_match=max(0.0, min(1.0, q_match)),
        q_doc=q_doc,
    )

    # Persist to mongo.evidence (one row per criterion x bidder).
    get_mongo_db()["evidence"].update_one(
        {"bidder_id": bidder_id, "criterion_id": criterion.id},
        {
            "$set": {
                "bidder_id": bidder_id,
                "criterion_id": criterion.id,
                "score": score.to_dict(),
                "extracted_value": cot.get("extracted_value"),
                "reason": cot.get("reason"),
                "source_page": src_page,
                "source_text": cot.get("extracted_value")
                or (passages[0].text[:500] if passages else None),
                "chain_of_thought": cot,
                "latency_ms": int((time.monotonic() - started) * 1000),
            }
        },
        upsert=True,
    )

    return EvidenceResult(
        score=score,
        extracted_value=cot.get("extracted_value"),
        reason=cot.get("reason") or "",
        source_page=src_page,
        source_text=passages[0].text[:500] if passages else None,
        chain_of_thought=cot,
    )
