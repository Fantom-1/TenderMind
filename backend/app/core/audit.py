"""Append-only hash-chained audit log.

Each record stores SHA-256(canonical_json(prev_hash || ts || actor_id ||
event_type || payload)). The verify() function recomputes the chain offline.
"""
import hashlib
import json
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def _canonical(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), default=str)


def _row_hash(prev_hash: str | None, ts: datetime, actor_id: int | None,
              event_type: str, payload: dict) -> str:
    h = hashlib.sha256()
    h.update((prev_hash or "").encode())
    h.update(b"|")
    h.update(ts.isoformat().encode())
    h.update(b"|")
    h.update(str(actor_id or "").encode())
    h.update(b"|")
    h.update(event_type.encode())
    h.update(b"|")
    h.update(_canonical(payload).encode())
    return h.hexdigest()


def append_audit(db: Session, *, actor_id: int | None, event_type: str,
                 payload: dict) -> AuditLog:
    last = db.execute(
        select(AuditLog).order_by(AuditLog.id.desc()).limit(1)
    ).scalar_one_or_none()
    prev_hash = last.this_hash if last else None
    ts = datetime.utcnow()
    this_hash = _row_hash(prev_hash, ts, actor_id, event_type, payload)
    row = AuditLog(
        ts=ts,
        actor_id=actor_id,
        event_type=event_type,
        payload=payload,
        prev_hash=prev_hash,
        this_hash=this_hash,
    )
    db.add(row)
    db.flush()
    return row


def verify_chain(db: Session) -> tuple[bool, str | None]:
    """Re-walk the chain. Returns (ok, error_msg).

    A broken chain points to a forced INSERT bypassing append_audit, or
    to a successful tamper that defeated the trigger (worth investigating).
    """
    prev_hash: str | None = None
    rows = db.execute(select(AuditLog).order_by(AuditLog.id.asc())).scalars()
    for row in rows:
        expected = _row_hash(prev_hash, row.ts, row.actor_id, row.event_type, row.payload)
        if row.prev_hash != prev_hash:
            return False, f"row {row.id}: prev_hash mismatch"
        if row.this_hash != expected:
            return False, f"row {row.id}: this_hash mismatch (tamper or bypass)"
        prev_hash = row.this_hash
    return True, None
