"""
SSE streaming compliance endpoint.
POST /api/stream  →  text/event-stream

Yields one SSE event per pipeline stage so the UI can show live progress.
The synchronous compliance engine runs in an asyncio thread executor so it
never blocks the FastAPI event loop.

Event shape (JSON inside each `data:` line):
  { "step": str, "message": str, "progress": int (0-100), "detail": str? }
  { "step": "complete", "result": { ...full compliance dict... }, "progress": 100 }
  { "step": "error",    "message": str }
"""

import asyncio
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import AsyncGenerator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# Project root for importing Phase 2 modules
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

router = APIRouter(prefix="/api", tags=["streaming"])

# One shared executor for the blocking engine calls
_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="pharma-engine")


class StreamRequest(BaseModel):
    report_text: str


# ── SSE helpers ───────────────────────────────────────────────────────────────

def _sse(step: str, message: str, progress: int, **extra) -> str:
    """Format a single SSE data line (ends with double newline)."""
    payload = {"step": step, "message": message, "progress": progress, **extra}
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _sse_error(message: str) -> str:
    return f"data: {json.dumps({'step': 'error', 'message': message, 'progress': 0})}\n\n"


# ── Streaming generator ───────────────────────────────────────────────────────

async def _stream_pipeline(
    report_text: str,
    use_llm: bool,
) -> AsyncGenerator[str, None]:
    """
    Runs the Phase 2 pipeline stage-by-stage, yielding SSE events between steps.
    Each blocking call is offloaded to the thread executor.
    """
    loop = asyncio.get_running_loop()

    try:
        # ── Stage 1: parse / validate input ──────────────────────────────────
        yield _sse("parsing", "Parsing and normalising report text…", 8)
        await asyncio.sleep(0)   # let the client receive the event

        text = report_text.strip()
        if not text:
            yield _sse_error("Report text is empty.")
            return

        word_count = len(text.split())
        yield _sse(
            "parsing",
            f"Report accepted — {len(text):,} chars, ~{word_count:,} words",
            15,
            detail=f"{word_count} words",
        )

        # ── Stage 2: rule engine (deterministic) ──────────────────────────────
        yield _sse("rules", "Running deterministic rule engine…", 22)
        await asyncio.sleep(0)

        RULES_PATH = PROJECT_ROOT / "config" / "rules.yaml"
        INDEX_PATH = PROJECT_ROOT / "outputs" / "vector_index"

        from src.rule_engine import run_checks

        raw_violations = await loop.run_in_executor(
            _executor, run_checks, text, RULES_PATH
        )

        n = len(raw_violations)
        severity_summary = ", ".join(
            f"{v['violation_type']} ({v['severity']})" for v in raw_violations[:3]
        )
        yield _sse(
            "rules",
            f"Rule engine complete — {n} flag{'s' if n != 1 else ''} detected",
            38,
            detail=severity_summary or "No violations",
        )

        # ── Stage 3: hybrid decision (fast, no IO) ────────────────────────────
        from src.hybrid_decision import compute_status
        status = compute_status(raw_violations)
        yield _sse("decision", f"Preliminary status: {status}", 44)

        # ── Stage 4: vector retrieval (ChromaDB) ──────────────────────────────
        yield _sse("retrieving", "Querying regulatory knowledge base (ChromaDB)…", 52)
        await asyncio.sleep(0)

        # Check index is usable — run in thread executor so it never blocks the event loop
        def _probe_chroma(path: Path) -> bool:
            if not path.exists():
                return False
            try:
                import chromadb
                from chromadb.config import Settings as _S
                chromadb.PersistentClient(path=str(path), settings=_S(anonymized_telemetry=False))
                return True
            except Exception as _e:
                import logging
                logging.getLogger(__name__).warning(
                    "ChromaDB index not usable (%s) — rule-engine-only mode.", _e
                )
                return False

        index_usable = await loop.run_in_executor(_executor, _probe_chroma, INDEX_PATH)

        if not index_usable:
            # No usable vector index — return rule-engine results immediately
            from src.schemas import ComplianceReport, Violation
            violations_out = [
                Violation(
                    type=v["violation_type"], severity=v["severity"],
                    evidence=v["evidence_text"], rule_id=v["rule_id"],
                )
                for v in raw_violations
            ]
            report = ComplianceReport(
                compliance_status=status,
                violations=violations_out,
                retrieved_regulations=[],
            )
            yield _sse(
                "retrieving",
                "Knowledge base not built yet — run notebooks 01-03 after downloading PDFs.",
                65,
                detail="RAG skipped",
            )
            yield _sse("complete", f"Analysis complete — {status} (rule engine only).", 100,
                       result=report.to_dict())
            return

        from src.rag_explainer import retrieve

        all_retrieved = []
        seen: set[tuple] = set()

        for v in raw_violations:
            query = v.get("evidence_text") or v.get("violation_type", "")
            chunks = await loop.run_in_executor(
                _executor, lambda q=query: retrieve(q, INDEX_PATH, top_k=3)
            )
            for r in chunks:
                key = (r.source, r.text[:80])
                if key not in seen:
                    seen.add(key)
                    all_retrieved.append(r)

        sources = list({r.source for r in all_retrieved})
        yield _sse(
            "retrieving",
            f"Retrieved {len(all_retrieved)} clause{'s' if len(all_retrieved) != 1 else ''} "
            f"from {', '.join(sources) or 'knowledge base'}",
            65,
            detail=f"{len(all_retrieved)} chunks from {len(sources)} source(s)",
        )

        # ── Stage 5: LLM enrichment ───────────────────────────────────────────
        if use_llm and raw_violations and all_retrieved:
            yield _sse("explaining", "Generating LLM explanations (Gemini / Groq)…", 72)
            await asyncio.sleep(0)

            from src.rag_explainer import explain_violation_with_llm
            from src.schemas import RetrievedRegulation, Violation

            violations_out = []
            for i, v in enumerate(raw_violations):
                query = v.get("evidence_text") or v.get("violation_type", "")
                relevant = await loop.run_in_executor(
                    _executor, lambda q=query: retrieve(q, INDEX_PATH, top_k=3)
                )

                expl, fix = await loop.run_in_executor(
                    _executor,
                    lambda _v=v, _rel=relevant: explain_violation_with_llm(
                        _v, _rel, report_text=text
                    ),
                )

                violations_out.append(
                    Violation(
                        type=v["violation_type"],
                        severity=v["severity"],
                        evidence=v["evidence_text"],
                        rule_id=v["rule_id"],
                        regulatory_basis=relevant[0].source if relevant else "",
                        explanation=expl,
                        suggested_fix=fix,
                        retrieved_regulations=relevant,
                    )
                )

                pct = 72 + int((i + 1) / max(len(raw_violations), 1) * 15)
                yield _sse(
                    "explaining",
                    f"Explained {i + 1}/{len(raw_violations)}: {v['violation_type']}",
                    pct,
                )
                await asyncio.sleep(0)
        else:
            # No LLM or no violations — build violation objects without explanation
            from src.schemas import Violation, RetrievedRegulation
            violations_out = []
            for v in raw_violations:
                query = v.get("evidence_text") or v.get("violation_type", "")
                relevant = await loop.run_in_executor(
                    _executor, lambda q=query: retrieve(q, INDEX_PATH, top_k=3)
                )
                violations_out.append(
                    Violation(
                        type=v["violation_type"],
                        severity=v["severity"],
                        evidence=v["evidence_text"],
                        rule_id=v["rule_id"],
                        regulatory_basis=relevant[0].source if relevant else "",
                        explanation="",
                        suggested_fix="",
                        retrieved_regulations=relevant,
                    )
                )

        # ── Stage 6: score + final report ─────────────────────────────────────
        yield _sse("scoring", "Computing compliance score…", 90)
        await asyncio.sleep(0)

        PENALTY = {"critical": 30, "high": 18, "medium": 8, "low": 3}
        score = max(0, 100 - sum(PENALTY.get(v.severity, 5) for v in violations_out))

        from src.schemas import ComplianceReport
        report = ComplianceReport(
            compliance_status=status,
            violations=violations_out,
            retrieved_regulations=all_retrieved,
        )
        result_dict = report.to_dict()

        yield _sse(
            "complete",
            f"Analysis complete — {status} (score {score}/100)",
            100,
            result={**result_dict, "score": score},
        )

    except Exception as exc:
        yield _sse_error(f"Pipeline error: {exc}")


# ── Endpoint ──────────────────────────────────────────────────────────────────

class StreamRequest(BaseModel):
    report_text: str


@router.post("/stream")
@router.get("/stream")   # keep GET for backward-compat (EventSource / legacy clients)
async def stream_compliance(
    request: Request,
    body: StreamRequest | None = None,   # POST body
    text: str | None = None,             # GET query param (legacy)
    token: str | None = None,
):
    """
    SSE streaming compliance check — accepts both POST (fetch/ReadableStream)
    and GET (EventSource / legacy) so all clients work.
    POST body: { report_text: "..." }
    GET  query: ?text=...
    """
    report_text = (body.report_text if body else None) or text or ""
    use_llm = os.environ.get("COMPLIANCE_USE_LLM", "1").strip().lower() in ("1", "true", "yes")

    async def event_generator():
        if not report_text.strip():
            yield _sse_error("report_text is empty.")
            return
        async for chunk in _stream_pipeline(report_text, use_llm):
            if await request.is_disconnected():
                break
            yield chunk

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",   # disable Nginx buffering
            "Connection":        "keep-alive",
        },
    )
