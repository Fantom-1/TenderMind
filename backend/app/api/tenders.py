from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.audit import append_audit
from app.core.cleanup import delete_tender
from app.core.storage import store_upload
from app.db.postgres import get_db
from app.deps import require_roles
from app.models.tender import Tender
from app.models.user import User

router = APIRouter(prefix="/tenders", tags=["tenders"])

ALLOWED_EXT = {".pdf", ".docx", ".doc"}


@router.post("", status_code=status.HTTP_201_CREATED)
def upload_tender(
    title: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(require_roles("uploader", "evaluator", "approver")),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    raw = file.file.read()
    if len(raw) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "file_too_large")
    suffix = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ""
    if suffix not in ALLOWED_EXT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"unsupported_format:{suffix}")

    path, sha256 = store_upload("tenders", file.filename or "tender", raw)

    tender = Tender(
        title=title,
        uploaded_by=user.id,
        file_hash=sha256,
        file_path=str(path),
        status="uploaded",
    )
    db.add(tender)
    db.flush()

    append_audit(
        db,
        actor_id=user.id,
        event_type="tender.uploaded",
        payload={"tender_id": tender.id, "sha256": sha256, "filename": file.filename},
    )
    db.commit()
    return {"id": tender.id, "title": tender.title, "status": tender.status, "sha256": sha256}


@router.get("")
def list_tenders(
    user: User = Depends(require_roles("uploader", "evaluator", "approver", "auditor")),
    db: Session = Depends(get_db),
):
    rows = db.query(Tender).order_by(Tender.created_at.desc()).all()
    return [
        {"id": t.id, "title": t.title, "status": t.status, "created_at": t.created_at.isoformat()}
        for t in rows
    ]


@router.delete("/{tender_id}", status_code=status.HTTP_200_OK)
def delete_tender_endpoint(
    tender_id: int,
    user: User = Depends(require_roles("approver", "auditor")),
    db: Session = Depends(get_db),
):
    tender = db.get(Tender, tender_id)
    if tender is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "tender_not_found")
    title = tender.title
    if not delete_tender(db, tender_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "tender_not_found")
    append_audit(
        db,
        actor_id=user.id,
        event_type="tender.deleted",
        payload={"tender_id": tender_id, "title": title},
    )
    db.commit()
    return {"deleted": True, "tender_id": tender_id}
