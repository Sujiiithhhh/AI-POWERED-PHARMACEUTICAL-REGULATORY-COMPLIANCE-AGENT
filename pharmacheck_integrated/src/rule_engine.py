"""
Phase 2 — Rule-based compliance engine (deterministic).
Uses config/rules.yaml only. No LLM. Returns violation_type, severity, evidence_text, rule_id.
"""

import re
from pathlib import Path
from typing import Any

import yaml


# --- PII/PHI pattern-based detection (no NER, no real data) ---
PHONE_PATTERN = re.compile(
    r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{10,11}\b"
)
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
# "Patient X Y" or "patient: John Smith" or "Mr. Smith" / "Mrs. Jones" (simple heuristic)
PATIENT_NAME_PATTERN = re.compile(
    r"\bpatient\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b|\b(?:Mr|Mrs|Ms|Dr)\.?\s+[A-Z][a-z]+\b",
    re.IGNORECASE,
)


def load_rules(rules_path: Path) -> dict[str, Any]:
    """Load rules from config/rules.yaml (read-only)."""
    with open(rules_path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def _extract_sentence(text: str, keyword: str, window: int = 200) -> str:
    """
    Extract the actual sentence(s) from the report that contain the keyword.
    Falls back to a character-window snippet if sentence boundary not found.
    """
    text_lower = text.lower()
    kw_lower = keyword.lower()
    idx = text_lower.find(kw_lower)
    if idx == -1:
        return keyword  # keyword not literally in text (regex match), return as-is

    # Try to find sentence boundaries around the match
    start = text.rfind(".", 0, idx)
    start = start + 1 if start != -1 else max(0, idx - window)
    end = text.find(".", idx + len(keyword))
    end = end + 1 if end != -1 else min(len(text), idx + len(keyword) + window)

    snippet = text[start:end].strip()
    # Cap length to avoid overly long evidence
    if len(snippet) > 400:
        snippet = text[max(0, idx - window):idx + len(keyword) + window].strip()
    return snippet


def _extract_pattern_sentence(text: str, pattern: re.Pattern, window: int = 200) -> str:
    """Extract the sentence containing the first regex match."""
    m = pattern.search(text)
    if not m:
        return ""
    idx = m.start()
    start = text.rfind(".", 0, idx)
    start = start + 1 if start != -1 else max(0, idx - window)
    end = text.find(".", m.end())
    end = end + 1 if end != -1 else min(len(text), m.end() + window)
    return text[start:end].strip()


def _check_privacy(text: str, rules: dict) -> list[dict]:
    """Detect PII/PHI patterns. Severity: critical."""
    out = []
    evidence_parts = []
    snippets = []
    if PHONE_PATTERN.search(text):
        evidence_parts.append("phone number")
        s = _extract_pattern_sentence(text, PHONE_PATTERN)
        if s:
            snippets.append(s)
    if EMAIL_PATTERN.search(text):
        evidence_parts.append("email")
        s = _extract_pattern_sentence(text, EMAIL_PATTERN)
        if s and s not in snippets:
            snippets.append(s)
    if PATIENT_NAME_PATTERN.search(text):
        evidence_parts.append("patient/person name")
        s = _extract_pattern_sentence(text, PATIENT_NAME_PATTERN)
        if s and s not in snippets:
            snippets.append(s)
    if evidence_parts:
        detected = "PII/PHI detected: " + ", ".join(evidence_parts)
        excerpt = " | ".join(snippets[:2])  # up to 2 snippets
        evidence_text = f"{detected}. From report: \"{excerpt}\"" if excerpt else detected
        out.append({
            "violation_type": "Patient Privacy Violation",
            "severity": "critical",
            "evidence_text": evidence_text,
            "rule_id": "privacy",
        })
    return out


def _check_adverse_event(text: str, rules: dict) -> list[dict]:
    """AE trigger keywords present but no reporting context → high (non-compliance)."""
    ae = rules.get("adverse_event") or {}
    keywords = [k.strip().lower() for k in ae.get("trigger_keywords", [])]
    case_sensitive = ae.get("case_sensitive", False)
    text_check = text if case_sensitive else text.lower()
    found = [kw for kw in keywords if kw in text_check]
    if not found:
        return []
    # Reporting context = presence of mandatory_reporting escalation flags
    mrc = rules.get("mandatory_reporting_context") or {}
    flags = [f.strip().lower() for f in mrc.get("escalation_flags", [])]
    has_context = any(fl in text_check for fl in flags)
    if has_context:
        return []  # Handled by mandatory_reporting_context check
    # Extract actual sentence from report for the first matched keyword
    snippet = _extract_sentence(text, found[0])
    kw_summary = ', '.join(found[:5]) + ('...' if len(found) > 5 else '')
    evidence_text = (
        f"AE trigger keyword(s) found: {kw_summary}. "
        f"From report: \"{snippet}\""
    )
    return [{
        "violation_type": "Adverse Event Without Reporting Context",
        "severity": "high",
        "evidence_text": evidence_text,
        "rule_id": "adverse_event",
    }]


def _check_mandatory_reporting(text: str, rules: dict) -> list[dict]:
    """Escalation flags present → mandatory reporting required (high)."""
    mrc = rules.get("mandatory_reporting_context") or {}
    flags = [f.strip().lower() for f in mrc.get("escalation_flags", [])]
    text_lower = text.lower()
    found = [f for f in flags if f in text_lower]
    if not found:
        return []
    snippet = _extract_sentence(text, found[0])
    evidence_text = (
        f"Mandatory/expedited reporting flags present: {', '.join(found)}. "
        f"From report: \"{snippet}\""
    )
    return [{
        "violation_type": "Mandatory Reporting Required",
        "severity": "high",
        "evidence_text": evidence_text,
        "rule_id": "mandatory_reporting_context",
    }]


def _check_off_label(text: str, rules: dict) -> list[dict]:
    """Off-label phrase patterns → high. We do not have approved-indication DB; phrase detection only."""
    ol = rules.get("off_label_promotion") or {}
    patterns = [p.strip().lower() for p in ol.get("phrase_patterns", [])]
    text_lower = text.lower()
    found = [p for p in patterns if p in text_lower]
    if not found:
        return []
    snippet = _extract_sentence(text, found[0])
    evidence_text = (
        f"Off-label promotional phrase(s) detected: {', '.join(found)}. "
        f"From report: \"{snippet}\""
    )
    return [{
        "violation_type": "Off-Label Promotion",
        "severity": "high",
        "evidence_text": evidence_text,
        "rule_id": "off_label_promotion",
    }]


def _check_comparative(text: str, rules: dict) -> list[dict]:
    """Comparative/superiority indicators → medium."""
    cc = rules.get("comparative_claims") or {}
    indicators = [i.strip().lower() for i in cc.get("indicators", [])]
    text_lower = text.lower()
    found = [i for i in indicators if i in text_lower]
    if not found:
        return []
    snippet = _extract_sentence(text, found[0])
    evidence_text = (
        f"Comparative/superiority language detected: {', '.join(found)}. "
        f"From report: \"{snippet}\""
    )
    return [{
        "violation_type": "Improper Comparative Claim",
        "severity": "medium",
        "evidence_text": evidence_text,
        "rule_id": "comparative_claims",
    }]


def run_checks(text: str, rules_path: Path) -> list[dict]:
    """
    Run all deterministic checks. Returns list of dicts with:
    violation_type, severity, evidence_text, rule_id.
    """
    rules = load_rules(rules_path)
    violations = []
    violations.extend(_check_privacy(text, rules))
    violations.extend(_check_adverse_event(text, rules))
    violations.extend(_check_mandatory_reporting(text, rules))
    violations.extend(_check_off_label(text, rules))
    violations.extend(_check_comparative(text, rules))
    return violations
