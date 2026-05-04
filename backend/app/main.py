from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import audit as audit_router
from app.api import auth as auth_router
from app.api import bidders as bidders_router
from app.api import evaluations as evaluations_router
from app.api import reports as reports_router
from app.api import review as review_router
from app.api import tenders as tenders_router
from app.config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.settings = settings
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="TenderMind AI",
        version="0.1.0",
        description="Air-gapped, explainable tender evaluation backend.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        return {
            "status": "ok",
            "env": settings.app_env,
            "llm": settings.llm_primary,
            "ocr": settings.ocr_engine,
        }

    app.include_router(auth_router.router)
    app.include_router(tenders_router.router)
    app.include_router(bidders_router.router)
    app.include_router(evaluations_router.router)
    app.include_router(review_router.router)
    app.include_router(audit_router.router)
    app.include_router(reports_router.router)

    return app


app = create_app()
