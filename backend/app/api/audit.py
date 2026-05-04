from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import verify_chain
from app.db.postgres import get_db
from app.deps import require_roles
from app.models.audit import AuditLog
from app.models.user import User

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
def list_audit(
    limit: int = 200,
    event_type: str | None = None,
    user: User = Depends(require_roles("auditor", "approver", "evaluator")),
    db: Session = Depends(get_db),
):
    stmt = select(AuditLog).order_by(AuditLog.id.desc()).limit(min(limit, 1000))
    if event_type:
        stmt = stmt.where(AuditLog.event_type == event_type)
    rows = db.execute(stmt).scalars().all()
    return [
        {
            "id": r.id,
            "ts": r.ts.isoformat(),
            "actor_id": r.actor_id,
            "event_type": r.event_type,
            "payload": r.payload,
            "prev_hash": r.prev_hash,
            "this_hash": r.this_hash,
        }
        for r in rows
    ]


@router.get("/verify")
def verify_audit(
    user: User = Depends(require_roles("auditor", "approver")),
    db: Session = Depends(get_db),
):
    ok, err = verify_chain(db)
    return {"ok": ok, "error": err}
