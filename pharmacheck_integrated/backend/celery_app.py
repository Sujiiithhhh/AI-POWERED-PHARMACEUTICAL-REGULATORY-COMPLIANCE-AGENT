"""
Celery Application — PharmaCheck async task queue
===================================================
Workers handle:
  • compliance checks (long-running LLM + RAG pipeline)
  • alert polling (FDA / EMA regulatory feeds via Celery Beat)
  • document antivirus scanning (ClamAV)
  • ML model retraining

Run worker:
    celery -A backend.celery_app worker --loglevel=info --concurrency=4

Run scheduler (Beat):
    celery -A backend.celery_app beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler
    # Or simple file-backed:
    celery -A backend.celery_app beat --loglevel=info
"""

import logging
import os

from celery import Celery
from celery.schedules import crontab

logger = logging.getLogger(__name__)

# ── Redis connection ───────────────────────────────────────────────────────────
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# ── Celery app ─────────────────────────────────────────────────────────────────
celery_app = Celery(
    "pharmacheck",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "backend.tasks.compliance_tasks",
        "backend.tasks.alert_tasks",
        "backend.tasks.document_tasks",
    ],
)

celery_app.conf.update(
    # Serialisation
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    # Timezone
    timezone="UTC",
    enable_utc=True,
    # Task routing
    task_routes={
        "backend.tasks.compliance_tasks.*": {"queue": "compliance"},
        "backend.tasks.alert_tasks.*":      {"queue": "alerts"},
        "backend.tasks.document_tasks.*":   {"queue": "documents"},
    },
    # Result expiry (24 h)
    result_expires=86400,
    # Retry settings
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    # Worker settings
    worker_prefetch_multiplier=1,   # one task at a time per worker slot
    task_soft_time_limit=120,       # 2 min soft limit
    task_time_limit=180,            # 3 min hard limit
    # Beat schedule — runs automatically when celery beat is started
    beat_schedule={
        # Poll FDA MedWatch every 6 hours
        "poll-fda-medwatch": {
            "task": "backend.tasks.alert_tasks.poll_fda_medwatch",
            "schedule": crontab(minute=0, hour="*/6"),
            "options": {"queue": "alerts"},
        },
        # Poll EMA safety alerts every 12 hours
        "poll-ema-alerts": {
            "task": "backend.tasks.alert_tasks.poll_ema_alerts",
            "schedule": crontab(minute=30, hour="*/12"),
            "options": {"queue": "alerts"},
        },
        # Daily ML model health check at 02:00 UTC
        "ml-model-health": {
            "task": "backend.tasks.compliance_tasks.ml_health_check",
            "schedule": crontab(minute=0, hour=2),
            "options": {"queue": "compliance"},
        },
    },
)
