import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import dashboard

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="FinOps API",
    description="Cloud spend aggregation and AI insights",
    version="1.0.0",
)

# ── CORS — allow Next.js UI to call this service ──────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # local dev
        "http://ui:3000",          # docker-compose internal
        "*",                       # override via ALLOWED_ORIGINS env if needed
    ],
    allow_credentials=True,
    allow_methods=["GET", "DELETE"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────
app.include_router(dashboard.router, tags=["dashboard"])


@app.get("/health")
async def health():
    return {"status": "ok"}
