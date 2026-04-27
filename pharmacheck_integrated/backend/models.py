"""
SQLAlchemy async ORM models.
All tenant-scoped tables include tenant_id — enforced at query time.

Tables:
  tenants          — one row per subscribed organisation
  users            — one row per user, always linked to a tenant
  refresh_tokens   — hashed refresh tokens (many per user)
  compliance_checks — full compliance run results per tenant
  audit_log        — tamper-evident SHA-256 chained log
"""

import hashlib
import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)

def _uuid() -> str:
    return str(uuid.uuid4())


# ── Tenant ────────────────────────────────────────────────────────────────────

class Tenant(Base):
    __tablename__ = "tenants"

    id:         Mapped[str]  = mapped_column(String(36), primary_key=True, default=_uuid)
    name:       Mapped[str]  = mapped_column(String(120), nullable=False)
    slug:       Mapped[str]  = mapped_column(String(60), unique=True, nullable=False)
    plan:       Mapped[str]  = mapped_column(String(20), default="free")   # free | pro | enterprise
    is_active:  Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    users:    Mapped[list["User"]]            = relationship("User",           back_populates="tenant", cascade="all, delete")
    checks:   Mapped[list["ComplianceCheck"]] = relationship("ComplianceCheck", back_populates="tenant", cascade="all, delete")
    audits:   Mapped[list["AuditLog"]]        = relationship("AuditLog",        back_populates="tenant", cascade="all, delete")


# ── User ──────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("email", name="uq_user_email"),)

    id:              Mapped[str]  = mapped_column(String(36), primary_key=True, default=_uuid)
    tenant_id:       Mapped[str]  = mapped_column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    email:           Mapped[str]  = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str]  = mapped_column(String(255), nullable=False)
    full_name:       Mapped[str]  = mapped_column(String(120), default="")
    role:            Mapped[str]  = mapped_column(String(20), default="member")   # admin | member
    is_active:       Mapped[bool] = mapped_column(Boolean, default=True)
    failed_logins:   Mapped[int]  = mapped_column(Integer, default=0)
    locked_until:    Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # ── TOTP 2FA (Layer A security) ───────────────────────────────────────────
    totp_secret:      Mapped[str | None]  = mapped_column(String(64),  nullable=True)
    totp_enabled:     Mapped[bool]        = mapped_column(Boolean, default=False)
    totp_backup_codes: Mapped[str | None] = mapped_column(String(255), nullable=True)   # comma-separated
    created_at:      Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    tenant:          Mapped["Tenant"]               = relationship("Tenant",       back_populates="users")
    refresh_tokens:  Mapped[list["RefreshToken"]]   = relationship("RefreshToken", back_populates="user", cascade="all, delete")
    checks:          Mapped[list["ComplianceCheck"]] = relationship("ComplianceCheck", back_populates="user")


# ── Refresh token ──────────────────────────────────────────────────────────────

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id:         Mapped[str]      = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id:    Mapped[str]      = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str]      = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked:    Mapped[bool]     = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")


# ── Compliance check ──────────────────────────────────────────────────────────

class ComplianceCheck(Base):
    __tablename__ = "compliance_checks"

    id:          Mapped[str]  = mapped_column(String(36), primary_key=True, default=_uuid)
    tenant_id:   Mapped[str]  = mapped_column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    user_id:     Mapped[str]  = mapped_column(String(36), ForeignKey("users.id",   ondelete="SET NULL"), nullable=True)
    status:      Mapped[str]  = mapped_column(String(20), nullable=False)          # PASS | FAIL | NEEDS_REVIEW
    score:       Mapped[int]  = mapped_column(Integer, nullable=False, default=100)
    violation_count: Mapped[int] = mapped_column(Integer, default=0)
    report_text: Mapped[str]  = mapped_column(Text, nullable=False)
    result_json: Mapped[str]  = mapped_column(Text, nullable=False)               # full JSON blob
    created_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="checks")
    user:   Mapped["User"]   = relationship("User",   back_populates="checks")


# ── Audit log (SHA-256 hash chain) ────────────────────────────────────────────

class AuditLog(Base):
    """
    Tamper-evident audit log.
    Each row stores SHA-256( prev_hash + event_type + user_id + payload_json ).
    Deleting or modifying any row breaks the chain and is detectable.
    """
    __tablename__ = "audit_log"

    id:           Mapped[int]  = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id:    Mapped[str]  = mapped_column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    user_id:      Mapped[str | None] = mapped_column(String(36), nullable=True)
    event_type:   Mapped[str]  = mapped_column(String(60), nullable=False)
    payload_json: Mapped[str]  = mapped_column(Text, default="{}")
    prev_hash:    Mapped[str]  = mapped_column(String(64), nullable=False)
    row_hash:     Mapped[str]  = mapped_column(String(64), nullable=False)
    ip_address:   Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at:   Mapped[datetime]   = mapped_column(DateTime(timezone=True), default=_now)

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="audits")

    @staticmethod
    def compute_hash(prev_hash: str, event_type: str, user_id: str, payload_json: str) -> str:
        raw = f"{prev_hash}|{event_type}|{user_id or ''}|{payload_json}"
        return hashlib.sha256(raw.encode()).hexdigest()
