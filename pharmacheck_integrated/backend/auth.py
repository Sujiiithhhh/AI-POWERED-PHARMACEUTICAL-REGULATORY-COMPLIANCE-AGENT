"""
JWT RS256 authentication utilities.
- Access tokens:  15 min expiry, signed with RS256 private key
- Refresh tokens: 7 day expiry, stored hash in DB
- Password:       bcrypt via passlib
"""

import os
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt, JWTError
from passlib.context import CryptContext

# ── Key material ─────────────────────────────────────────────────────────────
# Keys are loaded from env vars (set in .env).
# In production, load from a secrets manager — never hard-code.

def _load_key(env_var: str) -> str:
    val = os.environ.get(env_var, "").strip()
    if not val:
        raise RuntimeError(
            f"Missing required env var: {env_var}. "
            "Run scripts/generate_keys.py and copy output into .env"
        )
    # Handle \n-escaped newlines that some .env loaders produce
    return val.replace("\\n", "\n")


def get_private_key() -> str:
    return _load_key("JWT_PRIVATE_KEY")

def get_public_key() -> str:
    return _load_key("JWT_PUBLIC_KEY")


# ── Token settings ────────────────────────────────────────────────────────────
ALGORITHM             = "RS256"
ACCESS_TOKEN_MINUTES  = int(os.environ.get("ACCESS_TOKEN_MINUTES",  "15"))
REFRESH_TOKEN_DAYS    = int(os.environ.get("REFRESH_TOKEN_DAYS",    "7"))

# ── Password context ──────────────────────────────────────────────────────────
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


# ── Token creation ────────────────────────────────────────────────────────────

def create_access_token(
    user_id: str,
    tenant_id: str,
    email: str,
    role: str = "member",
) -> str:
    """Return a signed RS256 JWT access token."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub":       user_id,
        "tenant_id": tenant_id,
        "email":     email,
        "role":      role,
        "iat":       now,
        "exp":       now + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type":      "access",
    }
    return jwt.encode(payload, get_private_key(), algorithm=ALGORITHM)


def create_refresh_token() -> tuple[str, str]:
    """
    Return (raw_token, hashed_token).
    Store the hash in DB; send raw token to client.
    """
    raw = secrets.token_urlsafe(48)
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return raw, hashed


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


# ── Token verification ────────────────────────────────────────────────────────

def decode_access_token(token: str) -> dict:
    """
    Decode and verify JWT. Raises JWTError on invalid/expired token.
    Returns the decoded payload dict.
    """
    try:
        payload = jwt.decode(token, get_public_key(), algorithms=[ALGORITHM])
    except JWTError as e:
        raise JWTError(f"Token invalid or expired: {e}") from e

    if payload.get("type") != "access":
        raise JWTError("Not an access token")

    return payload


# ── FastAPI dependency ────────────────────────────────────────────────────────

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    """
    FastAPI dependency. Returns decoded JWT payload dict with keys:
      sub, tenant_id, email, role
    Raises 401 if token is missing or invalid.
    """
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_access_token(creds.credentials)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Further restrict to admin role."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user
