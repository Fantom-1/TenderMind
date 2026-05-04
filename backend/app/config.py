from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"
_ENV_OVERRIDE = _BACKEND_DIR / ".env.override"


class Settings(BaseSettings):
    """Single source of truth for runtime config.

    Reads `.env` (committed defaults) then `.env.override` (gitignored,
    machine-specific). Override values win.
    """

    model_config = SettingsConfigDict(
        env_file=(str(_ENV_FILE), str(_ENV_OVERRIDE)),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # App
    app_env: Literal["dev", "prod"] = "dev"
    app_port: int = 8000
    frontend_origin: str = "http://localhost:3000"

    # Storage
    storage_root: Path = Field(default=Path("D:/AI4Bharat/storage"))
    signing_key_path: Path = Field(default=Path("D:/AI4Bharat/storage/keys/report_signing.pem"))
    chroma_path: Path = Field(default=Path("D:/AI4Bharat/storage/chroma"))

    # Auth
    jwt_secret: str = "change-me"
    jwt_alg: str = "HS256"
    jwt_expire_min: int = 480

    # Databases
    postgres_dsn: str = "postgresql+psycopg2://tendermind:tendermind@localhost:5432/tendermind"
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "tendermind"
    redis_url: str = "redis://localhost:6379/0"

    # LLM
    ollama_host: str = "http://localhost:11434"
    llm_primary: str = "gemma3:4b"
    llm_temperature: float = 0.1
    llm_timeout_s: int = 120

    # Embeddings
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"

    # OCR
    ocr_engine: Literal["tesseract", "paddle"] = "tesseract"
    tesseract_cmd: str | None = None
    layout_engine: Literal["none", "layoutlmv3"] = "none"

    # Thresholds
    confidence_threshold: float = 0.85
    ocr_confidence_threshold: float = 0.70

    # Upload
    max_upload_mb: int = 50

    def ensure_dirs(self) -> None:
        """Create storage directories on first boot. Fails loud if path is unwritable."""
        for p in (self.storage_root, self.signing_key_path.parent, self.chroma_path):
            p.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    s = Settings()
    s.ensure_dirs()
    return s
