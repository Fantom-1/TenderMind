from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.audit import append_audit
from app.db.mongo import get_mongo_db
from app.db.postgres import get_db
from app.deps import require_roles
from app.models.evaluation import Evaluation
from app.models.user import User

router = APIRouter(prefix="/review", tags=["review"])


class OverrideBody(BaseModel):
    evaluation_id: int
    criterion_id: str
    new_meets: bool | None
    reason: str = Field(..., min_length=5, max_length=2000)


@router.post("/override")
def override_criterion(
    body: OverrideBody,
    user: User = Depends(require_roles("evaluator", "approver")),
    db: Session = Depends(get_db),
):
    ev = db.get(Evaluation, body.evaluation_id)
    if ev is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "evaluation_not_found")

    coll = get_mongo_db()["evidence"]
    res = coll.update_one(
        {"bidder_id": ev.bidder_id, "criterion_id": body.criterion_id},
        {
            "$set": {
                "officer_override": {
                    "by_user_id": user.id,
                    "by_email": user.email,
                    "new_meets": body.new_meets,
                    "reason": body.reason,
                }
            }
        },
    )
    if res.matched_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "evidence_not_found")

    append_audit(
        db,
        actor_id=user.id,
        event_type="review.override",
        payload={
            "evaluation_id": ev.id,
            "criterion_id": body.criterion_id,
            "new_meets": body.new_meets,
            "reason": body.reason,
        },
    )
    db.commit()
    return {"ok": True}


@router.get("/queue")
def review_queue(
    user: User = Depends(require_roles("evaluator", "approver", "auditor")),
    db: Session = Depends(get_db),
):
    """Every evaluation currently sitting at needs_review, oldest first."""
    rows = (
        db.query(Evaluation)
        .filter(Evaluation.verdict == "needs_review")
        .order_by(Evaluation.updated_at.asc())
        .all()
    )
    return [
        {
            "id": ev.id,
            "tender_id": ev.tender_id,
            "bidder_id": ev.bidder_id,
            "overall_confidence": ev.overall_confidence,
            "updated_at": ev.updated_at.isoformat(),
        }
        for ev in rows
    ]
