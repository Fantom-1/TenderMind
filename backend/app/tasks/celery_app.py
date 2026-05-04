from celery import Celery

from app.config import get_settings


def _build_celery() -> Celery:
    s = get_settings()
    broker = s.redis_url or "redis://localhost:6379/0"
    if not broker.startswith("redis://"):
        raise RuntimeError(f"Expected redis broker, got: {broker!r}")
    print(f"[celery] broker={broker}", flush=True)
    app = Celery(
        "tendermind",
        broker=broker,
        backend=broker,
    )
    app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
    )
    return app


celery_app = _build_celery()


# Task modules are imported here so Celery autoloads them at worker boot.
import app.tasks.pipeline_tasks  # noqa: E402, F401
