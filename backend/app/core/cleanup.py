"""Hard-delete helpers for tenders, bidders, and evaluations.

Removes Postgres rows, Mongo docs, files on disk, and Chroma collections.
Audit log entries are PRESERVED (the deletion event itself is appended).
"""
from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import Session

from app.db.mongo import get_mongo_db
from app.models.bidder import Bidder
from app.models.evaluation import Evaluation
from app.models.tender import Tender


def _safe_unlink(path_str: str | None) -> None:
    if not path_str:
        return
    try:
        p = Path(path_str)
        if p.is_file():
            p.unlink()
    except Exception:
        pass


def _drop_chroma(bidder_id: int) -> None:
    try:
        from app.pipeline.matcher import _client, _collection_name

        _client().delete_collection(_collection_name(bidder_id))
    except Exception:
        pass


def delete_evaluation(db: Session, evaluation_id: int) -> bool:
    ev = db.get(Evaluation, evaluation_id)
    if ev is None:
        return False
    _safe_unlink(ev.signed_pdf_path)
    mongo = get_mongo_db()
    mongo["report_signatures"].delete_many({"evaluation_id": evaluation_id})
    db.delete(ev)
    return True


def delete_bidder(db: Session, bidder_id: int) -> bool:
    bidder = db.get(Bidder, bidder_id)
    if bidder is None:
        return False
    for ev in db.query(Evaluation).filter(Evaluation.bidder_id == bidder_id).all():
        delete_evaluation(db, ev.id)
    for path in bidder.file_paths or []:
        _safe_unlink(path)
    mongo = get_mongo_db()
    mongo["ocr_pages"].delete_many({"owner": "bidder", "owner_id": bidder_id})
    mongo["evidence"].delete_many({"bidder_id": bidder_id})
    mongo["llm_calls"].delete_many({"bidder_id": bidder_id})
    _drop_chroma(bidder_id)
    db.delete(bidder)
    return True


def delete_tender(db: Session, tender_id: int) -> bool:
    tender = db.get(Tender, tender_id)
    if tender is None:
        return False
    for bidder in db.query(Bidder).filter(Bidder.tender_id == tender_id).all():
        delete_bidder(db, bidder.id)
    _safe_unlink(tender.file_path)
    mongo = get_mongo_db()
    mongo["ocr_pages"].delete_many({"owner": "tender", "owner_id": tender_id})
    mongo["criteria"].delete_many({"tender_id": tender_id})
    mongo["llm_calls"].delete_many({"tender_id": tender_id})
    db.delete(tender)
    return True
