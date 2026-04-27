"""Pydantic v2 request/response schemas for the API."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email:       EmailStr
    password:    str
    full_name:   str      = ""
    tenant_name: str      = ""   # creates a new tenant if provided; else auto-slug from email

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    expires_in:    int        # seconds until access token expires


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id:         str
    email:      str
    full_name:  str
    role:       str
    tenant_id:  str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Compliance ────────────────────────────────────────────────────────────────

class CheckRequest(BaseModel):
    report_text: str


class CheckHistoryItem(BaseModel):
    id:              str
    status:          str
    score:           int
    violation_count: int
    created_at:      datetime

    model_config = {"from_attributes": True}


class CheckHistoryResponse(BaseModel):
    items: list[CheckHistoryItem]
    total: int
