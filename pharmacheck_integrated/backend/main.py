"""
PharmaCheck — SaaS Backend  (Phase 5: Full Architecture)
=========================================================
Drop this file into your project as backend/main.py.
Run with:  uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

Environment variables (see .env.example):
  DATABASE_URL          postgresql+asyncpg://user:pass@host/db  (default: SQLite)
  JWT_PRIVATE_KEY       RS256 PEM private key  (run scripts/generate_keys.py)
  JWT_PUBLIC_KEY        RS256 PEM public key
  GEMINI_API_KEY        (or GROQ_API_KEY / OPENAI_API_KEY)
  COMPLIANCE_USE_LLM    1 | 0  (default 1)
  RATE_LIMIT            e.g. "30/minute" (default "60/minute")
  REDIS_URL             redis://localhost:6379/0
  S3_ENDPOINT_URL       http://minio:9000  (blank = AWS S3)
  S3_ACCESS_KEY         minioadmin
  S3_SECRET_KEY         minioadmin
  OTEL_EXPORTER_OTLP_ENDPOINT  http://otel-collector:4317
  ALERT_WEBHOOK_URL     https://hooks.slack.com/...
"""

import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# ── Path bootstrap ────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# ── .env ──────────────────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")
except ImportError:
    pass

# ── Imports ───────────────────────────────────────────────────────────────────
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from backend.database import init_db
from backend.middleware import (
    SecurityHeadersMiddleware,
    InputSanitisationMiddleware,
    RequestTimingMiddleware,
)
from backend.routers.auth import router as auth_router
from backend.routers.compliance import router as compliance_router
from backend.routers.stream import router as stream_router
from backend.routers.security import router as security_router
from backend.routers.totp import router as totp_router

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

# ── Rate limiter ──────────────────────────────────────────────────────────────
RATE_LIMIT = os.environ.get("RATE_LIMIT", "60/minute")
limiter = Limiter(key_func=get_remote_address, default_limits=[RATE_LIMIT])

# ── App lifecycle ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()         # create tables on startup (use Alembic in prod)
    # Warm up ML risk scorer (loads/trains model in background)
    try:
        from backend.ml_risk_scorer import RiskScorer
        RiskScorer()
        logger.info("ML risk scorer initialised")
    except Exception as exc:
        logger.warning("ML risk scorer init failed: %s", exc)
    yield

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="PharmaCheck API",
    description="AI-powered pharmaceutical compliance — SaaS grade.",
    version="3.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── OpenTelemetry tracing ──────────────────────────────────────────────────────
try:
    from backend.telemetry import setup_tracing
    setup_tracing(app)
except Exception as exc:
    logger.warning("Telemetry setup failed: %s", exc)

# ── Prometheus metrics ─────────────────────────────────────────────────────────
try:
    from backend.metrics import setup_metrics
    setup_metrics(app)
except Exception as exc:
    logger.warning("Metrics setup failed: %s", exc)

# ── Middleware (order matters — applied bottom-up by Starlette) ──────────────
# Outermost (runs last on request, first on response)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestTimingMiddleware)
app.add_middleware(InputSanitisationMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        os.environ.get("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)

# ── Rate limit error handler ──────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(compliance_router)
app.include_router(stream_router)
app.include_router(security_router)
app.include_router(totp_router)      # TOTP 2FA — Layer A security

# ── Alerts endpoint ───────────────────────────────────────────────────────────
from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import get_db
from backend.auth import get_current_user
from backend.models import User

@app.get("/api/alerts", tags=["alerts"])
@limiter.limit("30/minute")
async def get_regulatory_alerts(
    request: Request,
    limit: int = 20,
    severity: str = "",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get latest regulatory alerts (FDA/EMA) for the current tenant."""
    try:
        where = "WHERE 1=1"
        params = {"limit": limit}
        if severity:
            where += " AND severity = :severity"
            params["severity"] = severity

        result = await db.execute(
            text(f"""
                SELECT id, source, alert_type, title, severity, summary,
                       external_id, received_date, created_at
                FROM regulatory_alerts
                {where}
                ORDER BY created_at DESC
                LIMIT :limit
            """),
            params,
        )
        rows = result.fetchall()
        return {
            "alerts": [dict(zip(result.keys(), row)) for row in rows],
            "total": len(rows),
        }
    except Exception:
        # Table may not exist yet — return empty
        return {"alerts": [], "total": 0}


@app.post("/api/alerts/trigger-poll", tags=["alerts"])
@limiter.limit("5/minute")
async def trigger_alert_poll(request: Request, current_user: User = Depends(get_current_user)):
    """Manually trigger FDA/EMA poll (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        from backend.celery_app import celery_app
        from backend.tasks.alert_tasks import poll_fda_medwatch, poll_ema_alerts
        poll_fda_medwatch.delay()
        poll_ema_alerts.delay()
        return {"status": "queued", "message": "FDA and EMA poll tasks queued"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not queue tasks: {exc}")


# ── ML risk score endpoint (standalone) ──────────────────────────────────────
from pydantic import BaseModel

class _RiskScoreRequest(BaseModel):
    report_text: str

@app.post("/api/risk-score", tags=["compliance"])
@limiter.limit("20/minute")
async def compute_risk_score(
    req: _RiskScoreRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Compute ML risk score without full compliance pipeline."""
    from backend.ml_risk_scorer import RiskScorer
    scorer = RiskScorer()
    result = scorer.score(req.report_text, [])
    return result


# ── Legacy unauthenticated endpoint (kept for local demo / dev) ───────────────
class _LegacyCheckRequest(BaseModel):
    report_text: str

@app.post("/check_compliance", include_in_schema=False)
@limiter.limit("20/minute")
async def legacy_check(req: _LegacyCheckRequest, request: Request):
    """
    Unauthenticated shim — preserves backward compat with the original Phase 3
    frontend while you migrate to POST /api/check.
    """
    use_llm = os.environ.get("COMPLIANCE_USE_LLM", "1").strip().lower() in ("1", "true", "yes")
    try:
        from compliance_agent import run
        result = run(req.report_text.strip(), use_llm=use_llm)
        # Enrich with ML risk score
        try:
            from backend.ml_risk_scorer import RiskScorer
            scorer = RiskScorer()
            result["ml_risk"] = scorer.score(req.report_text, result.get("violations", []))
        except Exception:
            pass
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["ops"])
async def health():
    import platform
    return {
        "status": "ok",
        "version": "3.0.0",
        "python": platform.python_version(),
        "env": os.environ.get("APP_ENV", "development"),
    }


# ── Static file serving ───────────────────────────────────────────────────────
REACT_DIST    = PROJECT_ROOT / "frontend" / "dist"
LEGACY_DIR    = PROJECT_ROOT / "frontend"
LEGACY_STATIC = LEGACY_DIR / "static"

if REACT_DIST.exists():
    assets = REACT_DIST / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="react-assets")

@app.get("/static/{path:path}", include_in_schema=False)
async def legacy_static(path: str):
    fp = LEGACY_STATIC / path
    if fp.exists() and fp.is_file():
        return FileResponse(fp)
    raise HTTPException(status_code=404, detail="Not found")

@app.get("/{full_path:path}", response_class=HTMLResponse, include_in_schema=False)
async def spa_fallback(full_path: str):
    for candidate in [REACT_DIST / "index.html", LEGACY_DIR / "index.html"]:
        if candidate.exists():
            return FileResponse(candidate)
    raise HTTPException(status_code=404, detail="Frontend not built. Run: cd frontend_react && npm run build")

@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def root():
    for candidate in [REACT_DIST / "index.html", LEGACY_DIR / "index.html"]:
        if candidate.exists():
            return FileResponse(candidate)
    raise HTTPException(status_code=404, detail="Frontend not built.")
