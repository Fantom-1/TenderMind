from datetime import datetime

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.postgres import Base


class AuditLog(Base):
    """Append-only hash-chained audit log.

    A Postgres trigger blocks UPDATE/DELETE; only INSERT is permitted.
    Each row stores prev_hash (the previous row's this_hash) so the chain
    can be verified offline by app.core.audit.verify.
    """

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    payload: Mapped[dict] = mapped_column(JSON)
    prev_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    this_hash: Mapped[str] = mapped_column(String(64))
