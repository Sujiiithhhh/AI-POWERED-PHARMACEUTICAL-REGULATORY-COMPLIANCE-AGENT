"""
Protected compliance router.
All endpoints require a valid JWT (Bearer token).
Results are stored in the DB per tenant with full audit trail.
"""

import json
import os
import sys
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..database import get_db
from ..models import AuditLog, ComplianceCheck
from ..schemas import CheckHistoryItem, CheckHistoryResponse, CheckRequest

# Add project root so compliance_agent is importable
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

router = APIRouter(prefix="/api", tags=["compliance"])


def _calc_score(violations: list) -> int:
    PENALTY = {"critical": 30, "high": 18, "medium": 8, "low": 3}
    score = 100
    for v in violations:
        score -= PENALTY.get(v.get("severity", "low"), 5)
    return max(0, score)


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


async def _write_audit(db, tenant_id, user_id, event_type, payload, ip):
    result = await db.execute(
        select(AuditLog.row_hash)
        .where(AuditLog.tenant_id == tenant_id)
        .order_by(AuditLog.id.desc())
        .limit(1)
    )
    prev_hash = result.scalar_one_or_none() or "GENESIS"
    payload_json = json.dumps(payload, default=str)
    row_hash = AuditLog.compute_hash(prev_hash, event_type, user_id or "", payload_json)
    db.add(AuditLog(
        tenant_id=tenant_id, user_id=user_id,
        event_type=event_type, payload_json=payload_json,
        prev_hash=prev_hash, row_hash=row_hash, ip_address=ip,
    ))


# ── POST /api/check ───────────────────────────────────────────────────────────

@router.post("/check")
async def check_compliance(
    body: CheckRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Auth-gated compliance check.
    Runs the Phase 2 engine and persists result to DB under the caller's tenant.
    """
    tenant_id = current_user["tenant_id"]
    user_id   = current_user["sub"]
    use_llm   = os.environ.get("COMPLIANCE_USE_LLM", "1").strip().lower() in ("1", "true", "yes")

    try:
        from compliance_agent import run
        result = run(body.report_text.strip(), use_llm=use_llm)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Engine error: {exc}")

    violations = result.get("violations", [])
    score      = _calc_score(violations)

    check = ComplianceCheck(
        tenant_id       = tenant_id,
        user_id         = user_id,
        status          = result["compliance_status"],
        score           = score,
        violation_count = len(violations),
        report_text     = body.report_text[:5000],  # cap stored text
        result_json     = json.dumps(result),
    )
    db.add(check)

    await _write_audit(db, tenant_id, user_id, "compliance.check", {
        "check_id": check.id,
        "status":   result["compliance_status"],
        "score":    score,
        "violations": len(violations),
    }, _client_ip(request))

    await db.commit()

    # Return full result + the check ID so frontend can link to history
    return {**result, "check_id": check.id, "score": score}


# ── GET /api/history ──────────────────────────────────────────────────────────

@router.get("/history", response_model=CheckHistoryResponse)
async def get_history(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return this tenant's compliance check history (paginated)."""
    tenant_id = current_user["tenant_id"]

    total_result = await db.execute(
        select(func.count()).where(ComplianceCheck.tenant_id == tenant_id)
    )
    total = total_result.scalar_one()

    items_result = await db.execute(
        select(ComplianceCheck)
        .where(ComplianceCheck.tenant_id == tenant_id)
        .order_by(ComplianceCheck.created_at.desc())
        .offset(skip)
        .limit(min(limit, 100))
    )
    items = items_result.scalars().all()

    return CheckHistoryResponse(
        items=[CheckHistoryItem.model_validate(i) for i in items],
        total=total,
    )


# ── GET /api/history/{check_id} ───────────────────────────────────────────────

@router.get("/history/{check_id}")
async def get_check_detail(
    check_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the full result JSON for a specific past check (tenant-scoped)."""
    tenant_id = current_user["tenant_id"]
    result = await db.execute(
        select(ComplianceCheck).where(
            ComplianceCheck.id == check_id,
            ComplianceCheck.tenant_id == tenant_id,   # tenant isolation
        )
    )
    check = result.scalar_one_or_none()
    if not check:
        raise HTTPException(status_code=404, detail="Check not found")

    return {
        "check_id":   check.id,
        "created_at": check.created_at,
        "status":     check.status,
        "score":      check.score,
        **json.loads(check.result_json),
    }


# ── GET /api/audit ────────────────────────────────────────────────────────────

@router.get("/audit")
async def get_audit_log(
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return audit log entries for this tenant (admin only in production)."""
    tenant_id = current_user["tenant_id"]
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.tenant_id == tenant_id)
        .order_by(AuditLog.id.desc())
        .offset(skip)
        .limit(min(limit, 200))
    )
    entries = result.scalars().all()
    return [
        {
            "id":           e.id,
            "event_type":   e.event_type,
            "user_id":      e.user_id,
            "payload":      json.loads(e.payload_json),
            "row_hash":     e.row_hash,
            "prev_hash":    e.prev_hash,
            "ip_address":   e.ip_address,
            "created_at":   e.created_at,
        }
        for e in entries
    ]
