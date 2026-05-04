"""Long-running pipeline jobs run by the Celery worker.

The HTTP API enqueues these and immediately returns a job id. The
frontend polls /jobs/{id} (or refreshes the evaluation page) for status.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.core.audit import append_audit
from app.db.mongo import get_mongo_db
from app.db.postgres import SessionLocal
from app.models.bidder import Bidder
from app.models.evaluation import Evaluation
from app.models.tender import Tender
from app.pipeline.confidence import CriterionScore, overall_verdict
from app.pipeline.criteria import Criterion, extract_criteria_from_file
from app.pipeline.evidence import evaluate_one
from app.pipeline.extract import extract_document, persist_pages
from app.pipeline.matcher import index_bidder_pages


def _db() -> Session:
    return SessionLocal()


@celery_app.task(name="pipeline.extract_criteria")
def task_extract_criteria(tender_id: int) -> dict:
    db = _db()
    try:
        tender = db.get(Tender, tender_id)
        if tender is None:
            return {"ok": False, "error": "tender_not_found"}
        tender.status = "extracting"
        db.commit()

        # OCR/digital-extract the tender pages so the UI's source-view works.
        pages = extract_document(tender.file_path)
        persist_pages("tender", tender.id, pages)

        criteria = extract_criteria_from_file(tender.id, tender.file_path)
        tender.status = "criteria_ready"
        append_audit(
            db,
            actor_id=tender.uploaded_by,
            event_type="tender.criteria_extracted",
            payload={"tender_id": tender.id, "n_criteria": len(criteria)},
        )
        db.commit()
        return {"ok": True, "n_criteria": len(criteria)}
    finally:
        db.close()


@celery_app.task(name="pipeline.index_bidder")
def task_index_bidder(bidder_id: int) -> dict:
    db = _db()
    try:
        bidder = db.get(Bidder, bidder_id)
        if bidder is None:
            return {"ok": False, "error": "bidder_not_found"}
        all_pages = []
        for path in bidder.file_paths:
            pages = extract_document(path)
            persist_pages("bidder", bidder.id, pages)
            all_pages.extend(pages)
        n = index_bidder_pages(bidder.id, all_pages)
        append_audit(
            db,
            actor_id=bidder.uploaded_by,
            event_type="bidder.indexed",
            payload={"bidder_id": bidder.id, "n_chunks": n},
        )
        db.commit()
        return {"ok": True, "indexed": n}
    finally:
        db.close()


def _load_criteria(tender_id: int) -> list[Criterion]:
    rows = list(get_mongo_db()["criteria"].find({"tender_id": tender_id}))
    out: list[Criterion] = []
    for r in rows:
        r.pop("_id", None)
        r.pop("tender_id", None)
        try:
            out.append(Criterion(**r))
        except Exception:
            continue
    return out


@celery_app.task(name="pipeline.evaluate")
def task_evaluate(evaluation_id: int) -> dict:
    db = _db()
    try:
        ev = db.get(Evaluation, evaluation_id)
        if ev is None:
            return {"ok": False, "error": "evaluation_not_found"}
        ev.status = "running"
        db.commit()

        criteria = _load_criteria(ev.tender_id)
        if not criteria:
            ev.status = "failed"
            db.commit()
            return {"ok": False, "error": "no_criteria"}

        bidder = db.get(Bidder, ev.bidder_id)
        if bidder is None:
            ev.status = "failed"
            db.commit()
            return {"ok": False, "error": "bidder_not_found"}

        scores: list[CriterionScore] = []
        for c in criteria:
            res = evaluate_one(
                bidder_id=bidder.id,
                criterion=c,
                bidder_filenames=bidder.file_paths or [],
            )
            scores.append(res.score)

        verdict, overall_conf, reason = overall_verdict(scores)
        ev.verdict = verdict
        ev.overall_confidence = round(overall_conf, 3)
        ev.status = "done"

        append_audit(
            db,
            actor_id=bidder.uploaded_by,
            event_type="evaluation.completed",
            payload={
                "evaluation_id": ev.id,
                "verdict": verdict,
                "overall_confidence": ev.overall_confidence,
                "reason": reason,
                "scores": [s.to_dict() for s in scores],
            },
        )
        db.commit()
        return {
            "ok": True,
            "verdict": verdict,
            "overall_confidence": ev.overall_confidence,
            "reason": reason,
        }
    finally:
        db.close()
