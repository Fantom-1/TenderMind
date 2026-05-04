from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.audit import append_audit
from app.core.cleanup import delete_evaluation
from app.db.mongo import get_mongo_db
from app.db.postgres import get_db
from app.deps import require_roles
from app.models.bidder import Bidder
from app.models.evaluation import Evaluation
from app.models.tender import Tender
from app.models.user import User
from app.tasks.pipeline_tasks import task_evaluate, task_extract_criteria

router = APIRouter(prefix="/evaluations", tags=["evaluations"])


class StartEvaluationBody(BaseModel):
    tender_id: int
    bidder_ids: list[int]


@router.post("/extract-criteria/{tender_id}", status_code=status.HTTP_202_ACCEPTED)
def trigger_extract(
    tender_id: int,
    user: User = Depends(require_roles("evaluator", "approver")),
    db: Session = Depends(get_db),
):
    tender = db.get(Tender, tender_id)
    if tender is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "tender_not_found")
    task = task_extract_criteria.delay(tender_id)
    append_audit(
        db,
        actor_id=user.id,
        event_type="tender.extract_started",
        payload={"tender_id": tender_id, "task_id": task.id},
    )
    db.commit()
    return {"task_id": task.id}


@router.get("/criteria/{tender_id}")
def list_criteria(
    tender_id: int,
    user: User = Depends(require_roles("uploader", "evaluator", "approver", "auditor")),
):
    rows = list(get_mongo_db()["criteria"].find({"tender_id": tender_id}))
    for r in rows:
        r.pop("_id", None)
    return rows


@router.post("", status_code=status.HTTP_202_ACCEPTED)
def start_evaluation(
    body: StartEvaluationBody,
    user: User = Depends(require_roles("evaluator", "approver")),
    db: Session = Depends(get_db),
):
    tender = db.get(Tender, body.tender_id)
    if tender is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "tender_not_found")

    out = []
    for bid_id in body.bidder_ids:
        bidder = db.get(Bidder, bid_id)
        if bidder is None or bidder.tender_id != body.tender_id:
            continue
        ev = Evaluation(tender_id=body.tender_id, bidder_id=bid_id, status="queued")
        db.add(ev)
        db.flush()
        task = task_evaluate.delay(ev.id)
        append_audit(
            db,
            actor_id=user.id,
            event_type="evaluation.queued",
            payload={"evaluation_id": ev.id, "task_id": task.id},
        )
        out.append({"evaluation_id": ev.id, "bidder_id": bid_id, "task_id": task.id})
    db.commit()
    return {"jobs": out}


@router.get("/{evaluation_id}")
def get_evaluation(
    evaluation_id: int,
    user: User = Depends(require_roles("uploader", "evaluator", "approver", "auditor")),
    db: Session = Depends(get_db),
):
    ev = db.get(Evaluation, evaluation_id)
    if ev is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "evaluation_not_found")
    evidence_rows = list(
        get_mongo_db()["evidence"].find({"bidder_id": ev.bidder_id})
    )
    for r in evidence_rows:
        r.pop("_id", None)
    return {
        "id": ev.id,
        "tender_id": ev.tender_id,
        "bidder_id": ev.bidder_id,
        "verdict": ev.verdict,
        "overall_confidence": ev.overall_confidence,
        "status": ev.status,
        "signed_pdf_path": ev.signed_pdf_path,
        "evidence": evidence_rows,
        "created_at": ev.created_at.isoformat(),
        "updated_at": ev.updated_at.isoformat(),
    }


@router.get("")
def list_evaluations(
    tender_id: int | None = None,
    user: User = Depends(require_roles("uploader", "evaluator", "approver", "auditor")),
    db: Session = Depends(get_db),
):
    q = db.query(Evaluation)
    if tender_id is not None:
        q = q.filter(Evaluation.tender_id == tender_id)
    rows = q.order_by(Evaluation.created_at.desc()).all()
    return [
        {
            "id": ev.id,
            "tender_id": ev.tender_id,
            "bidder_id": ev.bidder_id,
            "verdict": ev.verdict,
            "overall_confidence": ev.overall_confidence,
            "status": ev.status,
            "created_at": ev.created_at.isoformat(),
        }
        for ev in rows
    ]


@router.delete("/{evaluation_id}", status_code=status.HTTP_200_OK)
def delete_evaluation_endpoint(
    evaluation_id: int,
    user: User = Depends(require_roles("approver", "auditor")),
    db: Session = Depends(get_db),
):
    ev = db.get(Evaluation, evaluation_id)
    if ev is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "evaluation_not_found")
    bidder_id = ev.bidder_id
    tender_id = ev.tender_id
    if not delete_evaluation(db, evaluation_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "evaluation_not_found")
    append_audit(
        db,
        actor_id=user.id,
        event_type="evaluation.deleted",
        payload={"evaluation_id": evaluation_id, "tender_id": tender_id, "bidder_id": bidder_id},
    )
    db.commit()
    return {"deleted": True, "evaluation_id": evaluation_id}
