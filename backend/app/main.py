import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import decisions, workspaces, analytics
from app.routers.decisions import reviews_router


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    # Future: connection pool warm-up, cache init, etc.
    yield


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Rationale API",
    description="Backend API for the Rationale decision-tracking platform.",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ── CORS ──────────────────────────────────────────────────────────────────────

# Allowed origins: Vercel preview + production URLs, plus local dev.
# Set FRONTEND_URL in .env to override for your Vercel deployment.
_frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        _frontend_url,
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",   # Alternative dev port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routers ───────────────────────────────────────────────────────────────────

API_PREFIX = "/api/v1"

app.include_router(workspaces.router,  prefix=API_PREFIX)
app.include_router(decisions.router,   prefix=API_PREFIX)
app.include_router(reviews_router,     prefix=API_PREFIX)  # /api/v1/decisions/{id}/review
app.include_router(analytics.router,   prefix=API_PREFIX)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    """Lightweight health-check for load balancers and uptime monitors."""
    return {"status": "ok"}
