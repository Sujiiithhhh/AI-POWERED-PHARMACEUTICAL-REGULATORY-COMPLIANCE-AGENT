"""
Prometheus Metrics — Phase 5
=============================
Exposes /metrics endpoint for Prometheus scraping.
Uses prometheus-fastapi-instrumentator for automatic request metrics.

Custom business metrics:
  - pharmacheck_compliance_checks_total (labels: status, tenant)
  - pharmacheck_violations_total (labels: severity, rule_id)
  - pharmacheck_risk_score (histogram)
  - pharmacheck_llm_latency_seconds (histogram)
  - pharmacheck_active_tenants (gauge)

Usage (main.py):
    from backend.metrics import setup_metrics
    setup_metrics(app)
"""

import logging
import os

logger = logging.getLogger(__name__)

METRICS_ENABLED = os.environ.get("METRICS_ENABLED", "1").strip().lower() in ("1", "true", "yes")


def setup_metrics(app):
    """Wire Prometheus metrics to the FastAPI app."""
    if not METRICS_ENABLED:
        return

    try:
        from prometheus_fastapi_instrumentator import Instrumentator
        from prometheus_client import Counter, Histogram, Gauge

        # ── HTTP metrics (auto) ────────────────────────────────────────────────
        Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

        # ── Business metrics ───────────────────────────────────────────────────
        global compliance_checks_total, violations_total, risk_score_histogram
        global llm_latency_histogram, active_tenants_gauge

        compliance_checks_total = Counter(
            "pharmacheck_compliance_checks_total",
            "Total compliance checks performed",
            ["status", "tenant_id"],
        )
        violations_total = Counter(
            "pharmacheck_violations_total",
            "Total violations detected",
            ["severity", "rule_id"],
        )
        risk_score_histogram = Histogram(
            "pharmacheck_risk_score",
            "ML risk score distribution",
            buckets=[10, 25, 40, 50, 60, 75, 85, 95, 100],
        )
        llm_latency_histogram = Histogram(
            "pharmacheck_llm_latency_seconds",
            "LLM call latency in seconds",
            buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 40.0, 60.0],
        )
        active_tenants_gauge = Gauge(
            "pharmacheck_active_tenants",
            "Number of tenants with activity in the last 24h",
        )

        logger.info("Prometheus metrics enabled at /metrics")

    except ImportError:
        logger.warning("prometheus-fastapi-instrumentator not installed — metrics disabled")
    except Exception as exc:
        logger.error("Metrics setup failed: %s", exc)


# ── Metric recorder helpers (safe to call even if prometheus is not installed) ─

def record_compliance_check(status: str, tenant_id: str):
    try:
        compliance_checks_total.labels(status=status, tenant_id=tenant_id[:8]).inc()
    except Exception:
        pass


def record_violations(violations: list):
    try:
        for v in violations:
            violations_total.labels(
                severity=v.get("severity", "unknown"),
                rule_id=v.get("rule_id", "unknown"),
            ).inc()
    except Exception:
        pass


def record_risk_score(score: int):
    try:
        risk_score_histogram.observe(score)
    except Exception:
        pass


def record_llm_latency(seconds: float):
    try:
        llm_latency_histogram.observe(seconds)
    except Exception:
        pass


# Placeholders so import doesn't crash if setup_metrics was never called
compliance_checks_total = None
violations_total = None
risk_score_histogram = None
llm_latency_histogram = None
active_tenants_gauge = None
