"""
Phase 2 — RAG-grounded LLM explanation only.
Retrieves top-k regulatory clauses from ChromaDB; calls LLM to explain violation and suggest fix.
LLM does NOT decide compliance; it only explains using retrieved text.
"""

import os
import json
import re
import time
from urllib import error as urllib_error
from urllib import request as urllib_request
from pathlib import Path
from typing import Any

from .schemas import RetrievedRegulation, Violation


def _normalize_llm_text(text: str) -> str:
    """Normalize markdown-ish output so UI shows clean plain text."""
    if not text:
        return ""
    cleaned = text.replace("**", "").replace("__", "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _split_explanation_and_fix(content: str) -> tuple[str, str]:
    """Parse flexible LLM output into explanation and suggested fix."""
    if not content:
        return "", ""

    text = content.strip()
    exp_match = re.search(r"EXPLANATION\s*:\s*(.*?)(?:\n+\s*SUGGESTED\s*FIX\s*:|$)", text, flags=re.IGNORECASE | re.DOTALL)
    fix_match = re.search(r"SUGGESTED\s*FIX\s*:\s*(.*)$", text, flags=re.IGNORECASE | re.DOTALL)

    if exp_match:
        explanation = exp_match.group(1).strip()
    else:
        explanation = text

    suggested_fix = fix_match.group(1).strip() if fix_match else ""
    return _normalize_llm_text(explanation), _normalize_llm_text(suggested_fix)


def _fallback_explanation(violation: dict, retrieved: list[RetrievedRegulation]) -> str:
    """Return a deterministic explanation when LLM output is incomplete."""
    vtype = (violation.get("violation_type") or "").strip().lower()
    evidence = (violation.get("evidence_text") or "the flagged content").strip()
    source = retrieved[0].source if retrieved else "retrieved regulations"

    if "off-label" in vtype:
        return (
            f"The statement \"{evidence}\" suggests an indication that may not be approved. "
            f"Verify the claim against approved labeling and {source} guidance before promotion."
        )
    if "comparative" in vtype:
        return (
            f"The phrase \"{evidence}\" is a superiority/comparative claim that requires substantiation. "
            f"Support it with robust evidence aligned with {source} promotional standards."
        )
    if "adverse event" in vtype:
        return (
            f"The evidence \"{evidence}\" indicates a potential adverse-event context. "
            f"Assess seriousness and reporting obligations using {source} safety-reporting requirements."
        )
    if "privacy" in vtype or "phi" in vtype or "pii" in vtype:
        return (
            f"The content \"{evidence}\" appears to contain personal or health-identifying information. "
            f"Remove or anonymize identifiers per {source} privacy requirements."
        )
    return (
        f"The evidence \"{evidence}\" may conflict with the retrieved regulatory context from {source}. "
        "Review and revise the statement to ensure compliant wording."
    )


def _fallback_fix(violation: dict) -> str:
    """Return a specific, actionable suggested fix based on violation type."""
    vtype = (violation.get("violation_type") or "").strip().lower()
    evidence = (violation.get("evidence_text") or "").strip()

    if "privacy" in vtype or "phi" in vtype or "pii" in vtype:
        parts = []
        if "phone number" in evidence:
            parts.append("remove or mask the phone number")
        if "email" in evidence:
            parts.append("remove or mask the email address")
        if "patient/person name" in evidence or "name" in evidence:
            parts.append("replace the patient's name with initials or an anonymous identifier")
        if parts:
            return "Edit the report to " + ", ".join(parts) + ", then re-run the compliance check."
        return "Remove all personally identifiable or health-related information from the report and re-run the compliance check."

    if "off-label" in vtype:
        return (
            "Revise the promotional statement to reference only the drug's approved indication, "
            "or add a clear disclaimer and regulatory approval citation before re-submitting."
        )

    if "comparative" in vtype:
        return (
            "Replace the superiority claim with a qualified statement supported by cited clinical data, "
            "or remove the comparative language if substantiation is not available."
        )

    if "adverse event" in vtype:
        return (
            "Add the required adverse event reporting context (e.g. seriousness assessment, "
            "hospitalization details, or outcome) alongside the flagged statement, then re-run the check."
        )

    if "mandatory reporting" in vtype:
        return (
            "Escalate this report through the mandatory reporting process per applicable regulations "
            "and document the reporting timeline and responsible party."
        )

    return (
        "Review the flagged statement against the retrieved regulatory text, revise it for compliance, "
        "and re-run the compliance check."
    )


def _looks_incomplete_fix(text: str) -> bool:
    """Detect a generic or empty suggested fix."""
    if not text or len(text.strip()) < 10:
        return True
    generic = "redact or revise the flagged content and re-run compliance check"
    return text.strip().lower().rstrip(".") == generic


def _looks_incomplete_explanation(text: str) -> bool:
    """Detect clipped or low-information explanation text."""
    if not text:
        return True
    t = text.strip()
    if len(t) < 40:
        return True
    if t.endswith((":", ",", ";", "-")):
        return True
    if t[-1] not in ".!?":
        return True
    return False


def _get_project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def retrieve(
    query: str,
    index_path: Path,
    top_k: int = 3,
    collection_name: str = "policy_chunks",
) -> list[RetrievedRegulation]:
    """Query ChromaDB for top-k chunks. Uses ChromaDB ONNX all-MiniLM-L6-v2 (same model as Phase 1, no PyTorch)."""
    import chromadb
    from chromadb.config import Settings
    from chromadb.utils.embedding_functions.onnx_mini_lm_l6_v2 import ONNXMiniLM_L6_V2

    try:
        client = chromadb.PersistentClient(path=str(index_path), settings=Settings(anonymized_telemetry=False))
        collection = client.get_collection(collection_name)
        ef = ONNXMiniLM_L6_V2()
        q_emb = ef([query])
        q_emb_list = [emb.tolist() for emb in q_emb]
        results = collection.query(
            query_embeddings=q_emb_list,
            n_results=min(top_k, collection.count()),
            include=["documents", "metadatas"],
        )
        docs = results["documents"][0] or []
        metas = results["metadatas"][0] or []
        return [
            RetrievedRegulation(source=meta.get("source", "Unknown"), text=doc)
            for doc, meta in zip(docs, metas)
        ]
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning(
            "ChromaDB retrieval failed (index may not be built yet): %s. "
            "Run notebooks/03_vector_index.ipynb after downloading PDFs. "
            "Returning empty retrieved_regulations.",
            exc,
        )
        return []


def _select_provider() -> str | None:
    """Select LLM provider from env; precedence can be overridden by LLM_PROVIDER."""
    forced = os.environ.get("LLM_PROVIDER", "").strip().lower()
    if forced in {"gemini", "groq", "openai"}:
        return forced
    if os.environ.get("GEMINI_API_KEY", "").strip():
        return "gemini"
    if os.environ.get("GROQ_API_KEY", "").strip():
        return "groq"
    if os.environ.get("OPENAI_API_KEY", "").strip():
        return "openai"
    return None


def _call_gemini(prompt: str, api_key: str) -> str:
    """Call Gemini via REST to avoid extra SDK dependency conflicts."""
    model_name = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model_name}:generateContent?key={api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 400, "temperature": 0.2},
    }
    req = urllib_request.Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib_request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    candidates = body.get("candidates", [])
    if not candidates:
        return ""
    parts = candidates[0].get("content", {}).get("parts", [])
    return "\n".join(p.get("text", "") for p in parts if p.get("text")).strip()


def _call_openai_compatible(prompt: str, api_key: str, provider: str) -> str:
    """Call OpenAI or Groq using the OpenAI-compatible chat API."""
    from openai import OpenAI

    if provider == "groq":
        model_name = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")
        client = OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")
    else:
        model_name = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
        client = OpenAI(api_key=api_key)

    resp = client.chat.completions.create(
        model=model_name,
        temperature=0.2,
        max_tokens=400,
        messages=[
            {
                "role": "system",
                "content": "You are a strict regulatory explainer. Never invent regulations.",
            },
            {"role": "user", "content": prompt},
        ],
    )
    return (resp.choices[0].message.content or "").strip()


def explain_violation_with_llm(
    violation: dict,
    retrieved: list[RetrievedRegulation],
    api_key: str | None = None,
    report_text: str | None = None,
) -> tuple[str, str]:
    """
    Call configured LLM to generate explanation and suggested_fix. No compliance decision.
    Returns (explanation, suggested_fix).
    """
    provider = _select_provider()
    if not provider:
        return (
            "Explanation unavailable (set GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY). Review retrieved regulations below.",
            "Redact or revise the flagged content and re-run compliance check.",
        )

    if provider == "gemini":
        key = api_key or os.environ.get("GEMINI_API_KEY", "").strip()
    elif provider == "groq":
        key = api_key or os.environ.get("GROQ_API_KEY", "").strip()
    else:
        key = api_key or os.environ.get("OPENAI_API_KEY", "").strip()

    if not key:
        return (
            f"Explanation unavailable (missing API key for provider '{provider}'). Review retrieved regulations below.",
            "Redact or revise the flagged content and re-run compliance check.",
        )

    reg_snippets = "\n\n".join([
        f"[{r.source}]: {r.text[:500]}..." if len(r.text) > 500 else f"[{r.source}]: {r.text}"
        for r in retrieved
    ])

    # Include a trimmed excerpt of the original report for context
    report_section = ""
    if report_text:
        excerpt = report_text.strip()[:1500]
        if len(report_text.strip()) > 1500:
            excerpt += "... [truncated]"
        report_section = f"\nORIGINAL REPORT CONTENT (for context):\n{excerpt}\n"

    prompt = f"""You are a compliance assistant. You must ONLY explain and suggest fixes. You must NOT decide whether something is compliant. Do NOT invent any regulations.

VIOLATION DETECTED (by a rule-based system):
- Type: {violation.get('violation_type', 'Unknown')}
- Evidence: {violation.get('evidence_text', '')}
{report_section}
RELEVANT REGULATORY TEXT (retrieved from official sources — cite only these):
{reg_snippets}

Tasks:
1. In 1–3 plain-English sentences, explain specifically why the flagged content in the report may violate the regulations above. Reference the actual words or phrases from the report. Cite the relevant regulatory source and key phrase.
2. In one sentence, suggest a concrete fix tailored to the flagged content (e.g. "Replace 'best in class' with a qualified claim supported by cited clinical data" or "Remove the patient's full name and replace with initials or an anonymous identifier").

Reply in this exact format:
EXPLANATION: <your explanation>
SUGGESTED FIX: <your one-sentence fix>"""

    max_retries = 3
    last_error: Exception | None = None

    for attempt in range(max_retries):
        try:
            if provider == "gemini":
                content = _call_gemini(prompt, key)
            else:
                content = _call_openai_compatible(prompt, key, provider)

            expl, fix = _split_explanation_and_fix(content)
            if _looks_incomplete_explanation(expl):
                expl = _fallback_explanation(violation, retrieved)
            if _looks_incomplete_fix(fix):
                fix = _fallback_fix(violation)
            return (expl, fix)

        except urllib_error.HTTPError as e:
            last_error = e
            if e.code == 429 and attempt < max_retries - 1:
                # Exponential backoff: 2s, 4s before final attempt
                time.sleep(2 ** (attempt + 1))
                continue
            # On final 429 or other HTTP error, use deterministic fallback
            expl = _fallback_explanation(violation, retrieved)
            fix = _fallback_fix(violation)
            return (expl, fix)

        except Exception as e:
            last_error = e
            if attempt < max_retries - 1:
                time.sleep(2 ** (attempt + 1))
                continue
            expl = _fallback_explanation(violation, retrieved)
            fix = _fallback_fix(violation)
            return (expl, fix)

    # Should not reach here, but safety net
    expl = _fallback_explanation(violation, retrieved)
    return (expl, _fallback_fix(violation))


def enrich_violations_with_rag(
    raw_violations: list[dict],
    index_path: Path,
    top_k: int = 3,
    use_llm: bool = True,
    api_key: str | None = None,
    report_text: str | None = None,
) -> tuple[list[Violation], list[RetrievedRegulation]]:
    """
    For each violation: retrieve top-k clauses, optionally call LLM for explanation/suggested_fix.
    Returns (list of Violation, list of all retrieved regulations for report).
    """
    all_retrieved: list[RetrievedRegulation] = []
    seen: set[tuple[str, str]] = set()

    violations_out: list[Violation] = []
    for v in raw_violations:
        query = v.get("evidence_text", "") or v.get("violation_type", "")
        retrieved = retrieve(query, index_path, top_k=top_k)
        for r in retrieved:
            key = (r.source, r.text[:100])
            if key not in seen:
                seen.add(key)
                all_retrieved.append(r)
        regulatory_basis = retrieved[0].source if retrieved else ""
        explanation = ""
        suggested_fix = ""
        if use_llm:
            explanation, suggested_fix = explain_violation_with_llm(
                v, retrieved, api_key, report_text=report_text
            )
        violations_out.append(
            Violation(
                type=v["violation_type"],
                severity=v["severity"],
                evidence=v["evidence_text"],
                rule_id=v["rule_id"],
                regulatory_basis=regulatory_basis,
                explanation=explanation,
                suggested_fix=suggested_fix,
                retrieved_regulations=retrieved,
            )
        )
    return violations_out, all_retrieved