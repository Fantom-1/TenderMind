from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.audit import append_audit
from app.core.cleanup import delete_bidder
from app.core.storage import store_upload
from app.db.postgres import get_db
from app.deps import require_roles
from app.models.bidder import Bidder
from app.models.tender import Tender
from app.models.user import User
from app.tasks.pipeline_tasks import task_index_bidder

router = APIRouter(prefix="/bidders", tags=["bidders"])


ALLOWED_EXT = {".pdf", ".docx", ".doc", ".jpg", ".jpeg", ".png", ".tif", ".tiff"}


@router.post("", status_code=status.HTTP_201_CREATED)
def upload_bidder(
    tender_id: int = Form(...),
    name: str = Form(...),
    files: list[UploadFile] = File(...),
    user: User = Depends(require_roles("uploader", "evaluator", "approver")),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    tender = db.get(Tender, tender_id)
    if tender is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "tender_not_found")

    paths: list[str] = []
    hashes: list[str] = []
    for f in files:
        raw = f.file.read()
        if len(raw) > settings.max_upload_mb * 1024 * 1024:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"file_too_large:{f.filename}")
        suffix = "." + (f.filename or "").rsplit(".", 1)[-1].lower() if "." in (f.filename or "") else ""
        if suffix not in ALLOWED_EXT:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"unsupported_format:{suffix}")
        path, sha = store_upload(f"bidders/{tender_id}", f.filename or "bidder", raw)
        paths.append(str(path))
        hashes.append(sha)

    bidder = Bidder(
        tender_id=tender_id,
        name=name,
        uploaded_by=user.id,
        file_paths=paths,
        file_hashes=hashes,
    )
    db.add(bidder)
    db.flush()

    append_audit(
        db,
        actor_id=user.id,
        event_type="bidder.uploaded",
        payload={
            "bidder_id": bidder.id,
            "tender_id": tender_id,
            "files": [{"path": p, "sha256": h} for p, h in zip(paths, hashes)],
        },
    )
    db.commit()

    # Async index.
    task_index_bidder.delay(bidder.id)
    return {"id": bidder.id, "tender_id": tender_id, "name": name, "n_files": len(paths)}


@router.get("")
def list_bidders(
    tender_id: int | None = None,
    user: User = Depends(require_roles("uploader", "evaluator", "approver", "auditor")),
    db: Session = Depends(get_db),
):
    q = db.query(Bidder)
    if tender_id is not None:
        q = q.filter(Bidder.tender_id == tender_id)
    rows = q.order_by(Bidder.created_at.desc()).all()
    return [
        {
            "id": b.id,
            "tender_id": b.tender_id,
            "name": b.name,
            "n_files": len(b.file_paths or []),
            "created_at": b.created_at.isoformat(),
        }
        for b in rows
    ]


@router.delete("/{bidder_id}", status_code=status.HTTP_200_OK)
def delete_bidder_endpoint(
    bidder_id: int,
    user: User = Depends(require_roles("approver", "auditor")),
    db: Session = Depends(get_db),
):
    bidder = db.get(Bidder, bidder_id)
    if bidder is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "bidder_not_found")
    name = bidder.name
    tender_id = bidder.tender_id
    if not delete_bidder(db, bidder_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "bidder_not_found")
    append_audit(
        db,
        actor_id=user.id,
        event_type="bidder.deleted",
        payload={"bidder_id": bidder_id, "tender_id": tender_id, "name": name},
    )
    db.commit()
    return {"deleted": True, "bidder_id": bidder_id}
