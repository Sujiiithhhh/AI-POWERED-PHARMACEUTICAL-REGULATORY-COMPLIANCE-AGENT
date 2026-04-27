"""
Auth router — register, login, refresh, /me.
All endpoints write to the audit log.
"""

import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import AuditLog, RefreshToken, Tenant, User
from ..auth import (
    ACCESS_TOKEN_MINUTES,
    REFRESH_TOKEN_DAYS,
    create_access_token,
    create_refresh_token,
    get_current_user,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from ..schemas import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_FAILED_LOGINS = 5
LOCKOUT_MINUTES   = 15


# ── Helpers ───────────────────────────────────────────────────────────────────

def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    return forwarded.split(",")[0].strip() if forwarded else request.client.host


async def _write_audit(
    db: AsyncSession,
    tenant_id: str,
    user_id: str | None,
    event_type: str,
    payload: dict,
    ip: str | None,
) -> None:
    """Append a tamper-evident audit log entry."""
    # Get the hash of the last row for this tenant
    result = await db.execute(
        select(AuditLog.row_hash)
        .where(AuditLog.tenant_id == tenant_id)
        .order_by(AuditLog.id.desc())
        .limit(1)
    )
    prev_hash = result.scalar_one_or_none() or "GENESIS"

    payload_json = json.dumps(payload, default=str)
    row_hash = AuditLog.compute_hash(prev_hash, event_type, user_id or "", payload_json)

    log = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        event_type=event_type,
        payload_json=payload_json,
        prev_hash=prev_hash,
        row_hash=row_hash,
        ip_address=ip,
    )
    db.add(log)


# ── Register ──────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    body: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # Check email uniqueness
    existing = await db.execute(select(User).where(User.email == body.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    # Create or derive tenant
    slug = (body.tenant_name or body.email.split("@")[1]).lower().replace(" ", "-")[:60]
    tenant_result = await db.execute(select(Tenant).where(Tenant.slug == slug))
    tenant = tenant_result.scalar_one_or_none()
    if not tenant:
        tenant = Tenant(name=body.tenant_name or slug, slug=slug)
        db.add(tenant)
        await db.flush()   # get tenant.id

    user = User(
        tenant_id=tenant.id,
        email=body.email.lower(),
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role="admin",    # first user in tenant is admin
    )
    db.add(user)
    await db.flush()

    # Issue tokens
    access_token = create_access_token(user.id, tenant.id, user.email, user.role)
    raw_rt, hashed_rt = create_refresh_token()
    rt = RefreshToken(
        user_id=user.id,
        token_hash=hashed_rt,
        expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS),
    )
    db.add(rt)

    await _write_audit(db, tenant.id, user.id, "user.registered",
                       {"email": user.email, "role": user.role}, _client_ip(request))
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_rt,
        expires_in=ACCESS_TOKEN_MINUTES * 60,
    )


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()

    def _bad_creds():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user or not user.is_active:
        _bad_creds()

    # Lockout check
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account locked. Try again after {user.locked_until.isoformat()}",
        )

    if not verify_password(body.password, user.hashed_password):
        user.failed_logins += 1
        if user.failed_logins >= MAX_FAILED_LOGINS:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
            await _write_audit(db, user.tenant_id, user.id, "auth.lockout",
                               {"reason": "max_failed_logins"}, _client_ip(request))
        await db.commit()
        _bad_creds()

    # Successful login — reset counter
    user.failed_logins = 0
    user.locked_until  = None

    access_token = create_access_token(user.id, user.tenant_id, user.email, user.role)
    raw_rt, hashed_rt = create_refresh_token()
    rt = RefreshToken(
        user_id=user.id,
        token_hash=hashed_rt,
        expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS),
    )
    db.add(rt)

    await _write_audit(db, user.tenant_id, user.id, "auth.login",
                       {"email": user.email}, _client_ip(request))
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_rt,
        expires_in=ACCESS_TOKEN_MINUTES * 60,
    )


# ── Refresh ───────────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    hashed = hash_refresh_token(body.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == hashed,
            RefreshToken.revoked    == False,  # noqa: E712
        )
    )
    rt = result.scalar_one_or_none()

    if not rt or rt.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Refresh token invalid or expired")

    # Rotate: revoke old, issue new
    rt.revoked = True

    user_result = await db.execute(select(User).where(User.id == rt.user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    access_token = create_access_token(user.id, user.tenant_id, user.email, user.role)
    raw_rt, hashed_rt = create_refresh_token()
    new_rt = RefreshToken(
        user_id=user.id,
        token_hash=hashed_rt,
        expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS),
    )
    db.add(new_rt)
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_rt,
        expires_in=ACCESS_TOKEN_MINUTES * 60,
    )


# ── /me ───────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserOut)
async def me(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == current_user["sub"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ── Logout (revoke refresh token) ─────────────────────────────────────────────

@router.post("/logout", status_code=204)
async def logout(
    body: RefreshRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    hashed = hash_refresh_token(body.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == hashed)
    )
    rt = result.scalar_one_or_none()
    if rt:
        rt.revoked = True
        await db.commit()
