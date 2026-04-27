"""
Security-specific endpoints:
  - Honeypot   GET/POST /api/v1/admin/dump-all
  - File guard POST /api/upload  (MIME + magic-byte validation)

Any hit on the honeypot is logged as a high-severity security event.
"""

import hashlib
import json
import os
import struct
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, Request, UploadFile, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import AuditLog

router = APIRouter(tags=["security"])

# ─────────────────────────────────────────────────────────────────────────────
# Honeypot — fake admin endpoint
# Any attacker probing the API will hit this and get logged.
# Returns 200 with plausible-looking (but fake) data.
# ─────────────────────────────────────────────────────────────────────────────

_HONEYPOT_RESPONSE = {
    "status": "ok",
    "data": [],
    "message": "No records found.",
}


async def _honeypot_audit(request: Request, db: AsyncSession) -> None:
    """Write a CRITICAL security event to the audit log."""
    ip = (
        request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or (request.client.host if request.client else "unknown")
    )
    user_agent = request.headers.get("User-Agent", "")
    payload = {
        "alert":      "HONEYPOT_HIT",
        "severity":   "CRITICAL",
        "ip":         ip,
        "user_agent": user_agent,
        "method":     request.method,
        "path":       str(request.url),
        "headers":    dict(request.headers),
        "timestamp":  datetime.now(timezone.utc).isoformat(),
    }

    # Use a sentinel tenant_id for cross-tenant security events
    SECURITY_TENANT = "00000000-0000-0000-0000-000000000000"

    result = await db.execute(
        select(AuditLog.row_hash)
        .where(AuditLog.tenant_id == SECURITY_TENANT)
        .order_by(AuditLog.id.desc())
        .limit(1)
    )
    prev_hash = result.scalar_one_or_none() or "GENESIS"
    payload_json = json.dumps(payload, default=str)
    row_hash = AuditLog.compute_hash(prev_hash, "security.honeypot", None, payload_json)

    db.add(AuditLog(
        tenant_id=SECURITY_TENANT,
        user_id=None,
        event_type="security.honeypot",
        payload_json=payload_json,
        prev_hash=prev_hash,
        row_hash=row_hash,
        ip_address=ip,
    ))
    await db.commit()


@router.get("/api/v1/admin/dump-all")
@router.post("/api/v1/admin/dump-all")
async def honeypot(request: Request, db: AsyncSession = Depends(get_db)):
    """
    🍯 Honeypot endpoint.
    Returns a convincing empty response while logging the caller.
    Production note: wire this to a real-time alert (PagerDuty / Slack).
    """
    await _honeypot_audit(request, db)
    return _HONEYPOT_RESPONSE


# ─────────────────────────────────────────────────────────────────────────────
# File upload guard
# MIME type check + magic-byte validation + size limit
# ─────────────────────────────────────────────────────────────────────────────

# Allowed: plain text and PDF
ALLOWED_MIME = {"text/plain", "application/pdf"}
MAX_FILE_BYTES = 10 * 1024 * 1024   # 10 MB

# Magic bytes (file signatures)
MAGIC = {
    b"%PDF":    "application/pdf",
    b"\xef\xbb\xbf":  "text/plain",   # UTF-8 BOM
}


def _detect_magic(header: bytes) -> str | None:
    """Return detected MIME from magic bytes, or None if unknown."""
    for magic, mime in MAGIC.items():
        if header.startswith(magic):
            return mime
    # Plain text heuristic: first 512 bytes are printable ASCII / UTF-8
    try:
        header[:512].decode("utf-8")
        return "text/plain"
    except UnicodeDecodeError:
        return None


@router.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    request: Request = None,
):
    """
    Secure file upload with:
      1. MIME type check (Content-Type header)
      2. Magic-byte validation (actual file content)
      3. Size limit (10 MB)
    Returns the extracted text content.
    """
    # ── MIME check ────────────────────────────────────────────────────────────
    declared_mime = (file.content_type or "").split(";")[0].strip().lower()
    if declared_mime and declared_mime not in ALLOWED_MIME:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {declared_mime}. Only .txt and .pdf are accepted.",
        )

    # ── Read with size guard ──────────────────────────────────────────────────
    raw = await file.read(MAX_FILE_BYTES + 1)
    if len(raw) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {MAX_FILE_BYTES // (1024*1024)} MB limit.",
        )

    # ── Magic-byte validation ─────────────────────────────────────────────────
    actual_mime = _detect_magic(raw[:512])
    if actual_mime not in ALLOWED_MIME:
        raise HTTPException(
            status_code=415,
            detail="File content does not match an accepted format (txt/pdf). "
                   "Extension spoofing is not permitted.",
        )

    # ── Extract text ──────────────────────────────────────────────────────────
    if actual_mime == "application/pdf":
        try:
            import io
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(raw))
            text = "\n".join(
                page.extract_text() or "" for page in reader.pages
            ).strip()
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Could not parse PDF: {exc}")
    else:
        text = raw.decode("utf-8", errors="replace")

    return {
        "filename":  file.filename,
        "size_bytes": len(raw),
        "mime":      actual_mime,
        "text":      text,
        "chars":     len(text),
    }
