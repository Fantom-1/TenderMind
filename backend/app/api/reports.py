from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.audit import append_audit
from app.core.pdf_signer import sign_evaluation
from app.db.mongo import get_mongo_db
from app.db.postgres import get_db
from app.deps import require_roles
from app.models.bidder import Bidder
from app.models.evaluation import Evaluation
from app.models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/approve/{evaluation_id}")
def approve_and_sign(
    evaluation_id: int,
    user: User = Depends(require_roles("approver")),
    db: Session = Depends(get_db),
):
    """Approver-only. Generates and signs the evaluation PDF.

    Role separation guarantee from the doc: an uploader/evaluator cannot hit
    this endpoint. require_roles enforces 403 otherwise.
    """
    ev = db.get(Evaluation, evaluation_id)
    if ev is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "evaluation_not_found")
    if ev.status != "done":
        raise HTTPException(status.HTTP_409_CONFLICT, "evaluation_not_ready")

    bidder = db.get(Bidder, ev.bidder_id)
    bidder_name = bidder.name if bidder else f"Bidder #{ev.bidder_id}"

    evidence = list(get_mongo_db()["evidence"].find({"bidder_id": ev.bidder_id}))
    scores = [e["score"] for e in evidence if "score" in e]

    pdf_path = sign_evaluation(
        evaluation_id=ev.id,
        bidder_name=bidder_name,
        summary={
            "verdict": ev.verdict,
            "overall_confidence": ev.overall_confidence,
            "reason": "Approved by " + user.email,
        },
        scores=scores,
    )

    ev.signed_pdf_path = str(pdf_path)
    ev.verdict = "approved"
    ev.approved_by = user.id
    ev.approved_at = datetime.utcnow()

    append_audit(
        db,
        actor_id=user.id,
        event_type="evaluation.approved",
        payload={
            "evaluation_id": ev.id,
            "signed_pdf_path": str(pdf_path),
            "approver": user.email,
        },
    )
    db.commit()
    return {"ok": True, "signed_pdf_path": str(pdf_path)}


@router.get("/download/{evaluation_id}")
def download_signed_pdf(
    evaluation_id: int,
    user: User = Depends(require_roles("approver", "auditor", "evaluator")),
    db: Session = Depends(get_db),
):
    ev = db.get(Evaluation, evaluation_id)
    if ev is None or not ev.signed_pdf_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "report_not_available")
    return FileResponse(
        ev.signed_pdf_path,
        media_type="application/pdf",
        filename=f"evaluation_{ev.id}.pdf",
    )
