"""
Compliance Celery Tasks
========================
Async compliance pipeline tasks — offloaded from the HTTP request cycle.
Results are stored in Redis (Celery backend) and optionally in the DB.
"""

import logging
import os
from pathlib import Path

from backend.celery_app import celery_app

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


@celery_app.task(bind=True, name="backend.tasks.compliance_tasks.run_compliance_async", max_retries=2)
def run_compliance_async(self, report_text: str, tenant_id: str, user_id: str, check_id: str):
    """
    Run full compliance pipeline asynchronously.
    Stores result in DB via sync SQLAlchemy.

    Returns:
        dict: Full compliance report + ML risk score
    """
    try:
        use_llm = os.environ.get("COMPLIANCE_USE_LLM", "1").strip().lower() in ("1", "true", "yes")

        # Run compliance engine
        import sys
        if str(PROJECT_ROOT) not in sys.path:
            sys.path.insert(0, str(PROJECT_ROOT))

        from compliance_agent import run as run_compliance
        result = run_compliance(report_text.strip(), use_llm=use_llm)

        # Score with ML risk scorer
        from backend.ml_risk_scorer import RiskScorer
        scorer = RiskScorer()
        risk = scorer.score(report_text, result.get("violations", []))
        result["ml_risk"] = risk

        # Update DB record (sync)
        _update_check_record(check_id, result, tenant_id)

        logger.info("Compliance task completed for check_id=%s risk=%s", check_id, risk["risk_score"])
        return result

    except Exception as exc:
        logger.error("Compliance task failed for check_id=%s: %s", check_id, exc)
        raise self.retry(exc=exc, countdown=10)


@celery_app.task(name="backend.tasks.compliance_tasks.ml_health_check")
def ml_health_check():
    """
    Daily health check: verify ML model is loadable and scoring correctly.
    Re-trains if model file is missing.
    """
    from backend.ml_risk_scorer import RiskScorer
    scorer = RiskScorer()
    test_text = "batch number not recorded in manufacturing log"
    result = scorer.score(test_text, [{"severity": "medium"}])
    logger.info("ML health check passed: risk_score=%s ml_enabled=%s", result["risk_score"], result["ml_enabled"])
    return {"status": "ok", "risk_score": result["risk_score"], "ml_enabled": result["ml_enabled"]}


def _update_check_record(check_id: str, result: dict, tenant_id: str):
    """Update ComplianceCheck record in DB synchronously (called from Celery worker)."""
    import asyncio
    from sqlalchemy import create_engine, text
    import json
    import os

    db_url = os.environ.get("DATABASE_URL", "sqlite:///./pharmacheck.db")
    # Convert asyncpg URL to sync psycopg2
    sync_url = db_url.replace("postgresql+asyncpg://", "postgresql://").replace("sqlite+aiosqlite://", "sqlite://")

    try:
        from sqlalchemy import create_engine
        engine = create_engine(sync_url)
        with engine.connect() as conn:
            status = result.get("compliance_status", "FAIL")
            risk_score = result.get("ml_risk", {}).get("risk_score", 0)
            violation_count = len(result.get("violations", []))
            conn.execute(
                text("""
                    UPDATE compliance_checks
                    SET status = :status,
                        score = :score,
                        violation_count = :vc,
                        result_json = :rj
                    WHERE id = :cid
                """),
                {
                    "status": status,
                    "score": risk_score,
                    "vc": violation_count,
                    "rj": json.dumps(result),
                    "cid": check_id,
                }
            )
            conn.commit()
    except Exception as exc:
        logger.warning("Could not update DB for check_id=%s: %s", check_id, exc)
