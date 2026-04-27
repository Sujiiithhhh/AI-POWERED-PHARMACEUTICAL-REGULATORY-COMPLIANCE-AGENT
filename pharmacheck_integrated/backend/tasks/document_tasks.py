"""
Document Processing Tasks
==========================
Celery tasks for:
  • ClamAV antivirus scanning
  • S3/MinIO encrypted document upload
  • Document text extraction pipeline
"""

import logging
import os
from pathlib import Path

from backend.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="backend.tasks.document_tasks.scan_and_store", bind=True, max_retries=2)
def scan_and_store(self, file_bytes_b64: str, filename: str, tenant_id: str, user_id: str):
    """
    1. Decode bytes
    2. ClamAV antivirus scan
    3. Upload to S3/MinIO with server-side encryption
    4. Return storage key + scan result

    Args:
        file_bytes_b64: base64-encoded file content
        filename: original filename
        tenant_id: owning tenant
        user_id: uploader
    """
    import base64
    raw = base64.b64decode(file_bytes_b64)

    # ── ClamAV scan ────────────────────────────────────────────────────────────
    scan_result = _clamav_scan(raw, filename)
    if not scan_result["clean"]:
        logger.warning("ClamAV detected threat in %s: %s", filename, scan_result["threat"])
        return {
            "status": "rejected",
            "reason": "antivirus",
            "threat": scan_result["threat"],
        }

    # ── S3/MinIO upload ────────────────────────────────────────────────────────
    from backend.s3_service import S3Service
    s3 = S3Service()
    key = s3.upload_document(raw, filename, tenant_id, user_id)

    logger.info("Document stored: key=%s tenant=%s", key, tenant_id)
    return {
        "status": "stored",
        "key": key,
        "filename": filename,
        "size_bytes": len(raw),
        "scan": scan_result,
    }


@celery_app.task(name="backend.tasks.document_tasks.extract_text", bind=True)
def extract_text(self, storage_key: str, tenant_id: str):
    """
    Download document from S3/MinIO and extract text content.
    Returns extracted text for compliance pipeline.
    """
    from backend.s3_service import S3Service
    s3 = S3Service()
    raw = s3.download_document(storage_key)

    if storage_key.lower().endswith(".pdf"):
        text = _extract_pdf_text(raw)
    else:
        text = raw.decode("utf-8", errors="replace")

    return {"text": text, "chars": len(text), "key": storage_key}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _clamav_scan(raw: bytes, filename: str) -> dict:
    """
    Run ClamAV scan via pyclamd (if available) or clamd socket.
    Falls back to clean=True if ClamAV is not configured (dev mode).
    """
    clamav_host = os.environ.get("CLAMAV_HOST", "")

    if not clamav_host:
        logger.debug("ClamAV not configured — skipping scan for %s", filename)
        return {"clean": True, "threat": None, "engine": "disabled"}

    try:
        import pyclamd
        cd = pyclamd.ClamdNetworkSocket(host=clamav_host, port=3310)
        if not cd.ping():
            logger.warning("ClamAV not responding — skipping scan")
            return {"clean": True, "threat": None, "engine": "unreachable"}

        result = cd.scan_stream(raw)
        if result is None:
            return {"clean": True, "threat": None, "engine": "clamav"}

        threat = list(result.values())[0][1] if result else None
        return {"clean": threat is None, "threat": threat, "engine": "clamav"}

    except ImportError:
        logger.debug("pyclamd not installed — ClamAV scan skipped")
        return {"clean": True, "threat": None, "engine": "not_installed"}
    except Exception as exc:
        logger.error("ClamAV scan error: %s", exc)
        return {"clean": True, "threat": None, "engine": "error", "error": str(exc)}


def _extract_pdf_text(raw: bytes) -> str:
    try:
        import io
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(raw))
        return "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    except Exception as exc:
        logger.error("PDF extraction failed: %s", exc)
        return ""
