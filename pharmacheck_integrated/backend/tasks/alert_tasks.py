"""
Alert Scheduler Tasks — Celery Beat
=====================================
Polls FDA MedWatch and EMA safety alert feeds periodically.
Stores new alerts in the DB and (optionally) sends webhook notifications.

Runs via: celery -A backend.celery_app beat --loglevel=info
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx

from backend.celery_app import celery_app

logger = logging.getLogger(__name__)

# ── Feed URLs ─────────────────────────────────────────────────────────────────
FDA_MEDWATCH_URL = "https://api.fda.gov/drug/event.json?limit=10&sort=receivedate:desc"
EMA_ALERTS_URL   = "https://www.ema.europa.eu/en/rss/safety-updates.xml"

# Webhook for Slack/Teams notifications (optional)
ALERT_WEBHOOK_URL = os.environ.get("ALERT_WEBHOOK_URL", "")


# ── Tasks ─────────────────────────────────────────────────────────────────────

@celery_app.task(name="backend.tasks.alert_tasks.poll_fda_medwatch", bind=True, max_retries=3)
def poll_fda_medwatch(self):
    """
    Poll FDA OpenFDA drug adverse events API.
    Extracts new events and writes them to the regulatory_alerts table.
    """
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.get(FDA_MEDWATCH_URL)
            resp.raise_for_status()
            data = resp.json()

        results = data.get("results", [])
        new_count = 0

        for event in results:
            alert = {
                "source": "FDA_MEDWATCH",
                "alert_type": "adverse_event",
                "title": _fda_event_title(event),
                "severity": _fda_event_severity(event),
                "summary": _fda_event_summary(event),
                "external_id": event.get("safetyreportid", ""),
                "received_date": event.get("receivedate", ""),
                "raw_json": event,
            }
            saved = _save_alert(alert)
            if saved:
                new_count += 1

        logger.info("FDA MedWatch poll: %d events fetched, %d new", len(results), new_count)

        if new_count > 0 and ALERT_WEBHOOK_URL:
            _send_webhook(f"FDA MedWatch: {new_count} new adverse event alerts")

        return {"status": "ok", "fetched": len(results), "new": new_count}

    except httpx.HTTPError as exc:
        logger.error("FDA MedWatch poll failed: %s", exc)
        raise self.retry(exc=exc, countdown=60)
    except Exception as exc:
        logger.error("Unexpected error in FDA poll: %s", exc)
        return {"status": "error", "message": str(exc)}


@celery_app.task(name="backend.tasks.alert_tasks.poll_ema_alerts", bind=True, max_retries=3)
def poll_ema_alerts(self):
    """
    Poll EMA safety updates RSS feed.
    Parses entries and stores new alerts.
    """
    try:
        import xml.etree.ElementTree as ET

        with httpx.Client(timeout=30) as client:
            resp = client.get(EMA_ALERTS_URL)
            resp.raise_for_status()
            content = resp.text

        root = ET.fromstring(content)
        ns = {"atom": "http://www.w3.org/2005/Atom"}

        # Try Atom feed first, fall back to RSS
        entries = root.findall(".//atom:entry", ns) or root.findall(".//item")
        new_count = 0

        for entry in entries[:20]:
            title = (
                _xml_text(entry, "atom:title", ns) or
                _xml_text(entry, "title", {}) or ""
            )
            link = (
                _xml_text(entry, "atom:link", ns) or
                _xml_text(entry, "link", {}) or ""
            )
            summary = (
                _xml_text(entry, "atom:summary", ns) or
                _xml_text(entry, "description", {}) or ""
            )
            alert_id = (
                _xml_text(entry, "atom:id", ns) or
                _xml_text(entry, "guid", {}) or link
            )

            alert = {
                "source": "EMA",
                "alert_type": "safety_update",
                "title": title[:512],
                "severity": _ema_severity(title),
                "summary": summary[:2048],
                "external_id": alert_id[:256],
                "received_date": datetime.now(timezone.utc).isoformat(),
                "raw_json": {"title": title, "link": link, "summary": summary},
            }
            saved = _save_alert(alert)
            if saved:
                new_count += 1

        logger.info("EMA poll: %d entries parsed, %d new", len(entries), new_count)

        if new_count > 0 and ALERT_WEBHOOK_URL:
            _send_webhook(f"EMA Safety Updates: {new_count} new alerts")

        return {"status": "ok", "fetched": len(entries), "new": new_count}

    except Exception as exc:
        logger.error("EMA poll failed: %s", exc)
        raise self.retry(exc=exc, countdown=120)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fda_event_title(event: dict) -> str:
    drugs = event.get("patient", {}).get("drug", [{}])
    drug_name = drugs[0].get("medicinalproduct", "Unknown Drug") if drugs else "Unknown Drug"
    return f"Adverse Event: {drug_name}"


def _fda_event_severity(event: dict) -> str:
    serious = event.get("serious", 1)
    seriousness = event.get("seriousnessother", 0)
    if serious == 1:
        if event.get("seriousnessdeath") == 1:
            return "critical"
        if event.get("seriousnesshospitalization") == 1:
            return "high"
        return "medium"
    return "low"


def _fda_event_summary(event: dict) -> str:
    reactions = event.get("patient", {}).get("reaction", [])
    reaction_names = [r.get("reactionmeddrapt", "") for r in reactions[:3]]
    return "Reactions: " + ", ".join(filter(None, reaction_names))


def _ema_severity(title: str) -> str:
    title_lower = title.lower()
    if any(w in title_lower for w in ["recall", "withdrawal", "urgent", "death", "fatal"]):
        return "critical"
    if any(w in title_lower for w in ["restriction", "contraindication", "warning"]):
        return "high"
    if any(w in title_lower for w in ["update", "revision", "caution"]):
        return "medium"
    return "low"


def _xml_text(element, tag: str, ns: dict) -> Optional[str]:
    try:
        el = element.find(tag, ns)
        return el.text if el is not None else None
    except Exception:
        return None


def _save_alert(alert: dict) -> bool:
    """
    Saves alert to regulatory_alerts table (auto-created if absent).
    Returns True if new record was inserted.
    """
    import os
    from sqlalchemy import create_engine, text, inspect

    db_url = os.environ.get("DATABASE_URL", "sqlite:///./pharmacheck.db")
    sync_url = db_url.replace("postgresql+asyncpg://", "postgresql://").replace("sqlite+aiosqlite://", "sqlite://")

    try:
        engine = create_engine(sync_url)
        with engine.connect() as conn:
            # Ensure table exists
            if not inspect(engine).has_table("regulatory_alerts"):
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS regulatory_alerts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        source TEXT NOT NULL,
                        alert_type TEXT,
                        title TEXT,
                        severity TEXT,
                        summary TEXT,
                        external_id TEXT UNIQUE,
                        received_date TEXT,
                        raw_json TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.commit()

            # Skip duplicates
            existing = conn.execute(
                text("SELECT id FROM regulatory_alerts WHERE external_id = :eid"),
                {"eid": alert["external_id"]}
            ).fetchone()

            if existing:
                return False

            conn.execute(
                text("""
                    INSERT INTO regulatory_alerts
                        (source, alert_type, title, severity, summary, external_id, received_date, raw_json)
                    VALUES
                        (:source, :alert_type, :title, :severity, :summary, :external_id, :received_date, :raw_json)
                """),
                {**alert, "raw_json": json.dumps(alert["raw_json"])}
            )
            conn.commit()
            return True
    except Exception as exc:
        logger.warning("Could not save alert: %s", exc)
        return False


def _send_webhook(message: str):
    """Send a simple text notification to Slack/Teams webhook."""
    try:
        with httpx.Client(timeout=10) as client:
            client.post(ALERT_WEBHOOK_URL, json={"text": f"🚨 PharmaCheck Alert: {message}"})
    except Exception as exc:
        logger.warning("Webhook notification failed: %s", exc)
