import hashlib
import uuid
from pathlib import Path

from app.config import get_settings


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def store_upload(scope: str, original_filename: str, data: bytes) -> tuple[Path, str]:
    """Persist an uploaded file under STORAGE_ROOT/<scope>/<uuid>.<ext>.

    Returns (absolute_path, sha256_hex). Filenames are UUID-based so user input
    cannot influence the path on disk.
    """
    s = get_settings()
    suffix = Path(original_filename).suffix.lower()
    name = f"{uuid.uuid4().hex}{suffix}"
    target_dir = s.storage_root / scope
    target_dir.mkdir(parents=True, exist_ok=True)
    path = target_dir / name
    path.write_bytes(data)
    return path, sha256_bytes(data)
