"""
HemoLens — FastAPI Application Entry Point
==========================================
Start the server (from project root):

    uvicorn backend.main:app --reload --port 8000

Or via the convenience script:

    python -m uvicorn backend.main:app --reload --port 8000

Environment variables (optional, via .env.local or system env):
    ALLOWED_ORIGINS — comma-separated list of allowed CORS origins
                      (defaults to localhost:3000 + localhost:3001)
"""

from __future__ import annotations

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from backend.routers import screen, features, analyze
except ModuleNotFoundError:
    from routers import screen, features, analyze

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# CORS origins
# ---------------------------------------------------------------------------
_default_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
]

_env_origins = os.getenv("ALLOWED_ORIGINS", "")
_extra_origins = [o.strip() for o in _env_origins.split(",") if o.strip()]
ALLOWED_ORIGINS: list[str] = list(dict.fromkeys(_default_origins + _extra_origins))

from contextlib import asynccontextmanager

# ---------------------------------------------------------------------------
# Lifespan: preload ML models once at application startup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        try:
            from backend.ml import load_model_bundle
        except ModuleNotFoundError:
            from ml import load_model_bundle
        load_model_bundle()
        logger.info("HemoLens ML model bundle preloaded successfully at startup.")
    except Exception as exc:
        logger.warning("Could not preload ML model bundle at startup: %s", exc)
    yield


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="HemoLens API",
    description=(
        "Backend service for HemoLens — AI-powered preliminary anemia screening. "
        "Provides image quality validation, CV preprocessing, and ML inference endpoints."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(screen.router)
app.include_router(features.router)
app.include_router(analyze.router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    """Liveness probe — returns 200 when the server is up."""
    return {"status": "ok", "service": "hemolens-api"}
