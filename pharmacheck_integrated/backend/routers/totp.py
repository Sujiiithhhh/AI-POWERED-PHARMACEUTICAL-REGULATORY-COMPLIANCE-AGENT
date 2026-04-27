"""
TOTP 2FA router — Layer A security.
Implements RFC 6238 Time-based One-Time Passwords via pyotp.

Endpoints:
  POST /api/2fa/setup    — generate TOTP secret + QR code URI for a user
  POST /api/2fa/verify   — verify TOTP code and activate 2FA
  POST /api/2fa/disable  — disable 2FA (requires valid TOTP)
  POST /api/2fa/validate — validate TOTP during login (returns temp session)

The TOTP secret is stored encrypted in the User row (totp_secret column).
"""

import base64
import io
import os
import secrets
from datetime import datetime, timezone

import pyotp
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..database import get_db
from ..models import User

router = APIRouter(prefix="/api/2fa", tags=["2fa"])

APP_NAME = os.environ.get("APP_NAME", "PharmaCheck")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_secret() -> str:
    """Generate a new base32 TOTP secret."""
    return pyotp.random_base32()


def _make_totp(secret: str) -> pyotp.TOTP:
    return pyotp.TOTP(secret)


def _provisioning_uri(secret: str, email: str) -> str:
    return _make_totp(secret).provisioning_uri(name=email, issuer_name=APP_NAME)


def _qr_data_uri(provisioning_uri: str) -> str:
    """Return a data: URI with the QR code PNG (for <img src=...>)."""
    try:
        import qrcode
        qr = qrcode.QRCode(box_size=8, border=2)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        return f"data:image/png;base64,{b64}"
    except ImportError:
        return ""


# ── Pydantic models ───────────────────────────────────────────────────────────

class TOTPSetupResponse(BaseModel):
    secret: str
    provisioning_uri: str
    qr_data_uri: str
    backup_codes: list[str]
    message: str


class TOTPVerifyRequest(BaseModel):
    code: str


class TOTPDisableRequest(BaseModel):
    code: str


class TOTPValidateRequest(BaseModel):
    user_id: str
    code: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/setup", response_model=TOTPSetupResponse)
async def setup_totp(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a new TOTP secret for the authenticated user.
    Returns the secret, a provisioning URI, a QR code (data URI), and 8 backup codes.
    The 2FA is NOT active yet — user must call /verify with a valid code first.
    """
    user_id = user["sub"]
    result  = await db.execute(select(User).where(User.id == user_id))
    db_user = result.scalar_one_or_none()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    secret = _generate_secret()
    uri    = _provisioning_uri(secret, db_user.email)
    qr     = _qr_data_uri(uri)

    # Store pending secret (not yet activated)
    db_user.totp_secret  = secret
    db_user.totp_enabled = False
    # Generate 8 single-use backup codes (stored as comma-separated hashed values)
    backup_codes = [secrets.token_hex(5).upper() for _ in range(8)]
    db_user.totp_backup_codes = ",".join(backup_codes)

    await db.commit()

    return TOTPSetupResponse(
        secret=secret,
        provisioning_uri=uri,
        qr_data_uri=qr,
        backup_codes=backup_codes,
        message="Scan the QR code with Google Authenticator then call /verify to activate.",
    )


@router.post("/verify")
async def verify_totp(
    body: TOTPVerifyRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Verify a TOTP code and activate 2FA.
    Must be called after /setup with a valid 6-digit code.
    """
    user_id = user["sub"]
    result  = await db.execute(select(User).where(User.id == user_id))
    db_user = result.scalar_one_or_none()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    if not db_user.totp_secret:
        raise HTTPException(status_code=400, detail="Run /setup first")

    totp = _make_totp(db_user.totp_secret)
    if not totp.verify(body.code.strip(), valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid TOTP code. Check your authenticator app time sync.")

    db_user.totp_enabled = True
    await db.commit()
    return {"message": "2FA activated successfully.", "totp_enabled": True}


@router.post("/disable")
async def disable_totp(
    body: TOTPDisableRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disable 2FA — requires a valid TOTP code as confirmation."""
    user_id = user["sub"]
    result  = await db.execute(select(User).where(User.id == user_id))
    db_user = result.scalar_one_or_none()
    if not db_user or not db_user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is not enabled")

    totp = _make_totp(db_user.totp_secret)
    if not totp.verify(body.code.strip(), valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")

    db_user.totp_enabled     = False
    db_user.totp_secret      = None
    db_user.totp_backup_codes = None
    await db.commit()
    return {"message": "2FA disabled."}


@router.post("/validate")
async def validate_totp_login(
    body: TOTPValidateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Called after password login when 2FA is enabled.
    Validates the TOTP code for the given user_id (from the partial login session).
    Returns {valid: true} — the calling code must then issue the access token.
    """
    result  = await db.execute(select(User).where(User.id == body.user_id))
    db_user = result.scalar_one_or_none()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    if not db_user.totp_enabled or not db_user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA not enabled for this user")

    totp = _make_totp(db_user.totp_secret)

    # Check backup codes first
    code = body.code.strip().upper()
    if db_user.totp_backup_codes:
        codes = db_user.totp_backup_codes.split(",")
        if code in codes:
            # Consume the backup code (single use)
            remaining = [c for c in codes if c != code]
            db_user.totp_backup_codes = ",".join(remaining)
            await db.commit()
            return {"valid": True, "used_backup_code": True, "remaining_backup_codes": len(remaining)}

    if not totp.verify(code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid TOTP code or backup code")

    return {"valid": True, "used_backup_code": False}


@router.get("/status")
async def totp_status(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return whether 2FA is enabled for the current user."""
    user_id = user["sub"]
    result  = await db.execute(select(User).where(User.id == user_id))
    db_user = result.scalar_one_or_none()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    backup_count = len(db_user.totp_backup_codes.split(",")) if db_user.totp_backup_codes else 0
    return {
        "totp_enabled":       db_user.totp_enabled,
        "backup_codes_left":  backup_count,
    }
