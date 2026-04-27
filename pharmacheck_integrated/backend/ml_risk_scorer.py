"""
ML Risk Scorer — Phase 5
========================
Scikit-learn clause-level classifier that assigns a 0-100 risk score
to each compliance check and flags high-risk clauses.

Model: TF-IDF + Logistic Regression (fast, auditable, no GPU needed)
Training: synthetic pharma violation dataset (bootstrapped from rules.yaml)
Persistence: outputs/ml_model/  (auto-trained on first run if missing)

Usage:
    scorer = RiskScorer()
    result = scorer.score(report_text, violations)
    # → {"risk_score": 72, "risk_level": "HIGH", "clause_scores": [...], "confidence": 0.84}
"""

import json
import logging
import os
import pickle
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).resolve().parent.parent / "outputs" / "ml_model"
MODEL_PATH = MODEL_DIR / "risk_classifier.pkl"
VECTORIZER_PATH = MODEL_DIR / "tfidf_vectorizer.pkl"


# ── Synthetic training data (bootstrapped from pharma domain knowledge) ────────

_TRAINING_SAMPLES = [
    # (text_snippet, label)  label: 0=low, 1=medium, 2=high, 3=critical
    ("patient showed adverse reaction to medication dosage exceeded recommended limit", 3),
    ("clinical trial data falsified in section 3", 3),
    ("expiration date missing from drug label", 2),
    ("batch number not recorded in manufacturing log", 2),
    ("promotional material makes unsupported efficacy claims", 2),
    ("off-label promotion of controlled substance", 3),
    ("storage temperature deviation during transport", 2),
    ("informed consent form not signed by patient", 3),
    ("sterility test failure in batch QC report", 3),
    ("drug interaction warning omitted from package insert", 2),
    ("manufacturing process deviates from approved protocol", 2),
    ("post-market surveillance report submitted on time", 0),
    ("all adverse events reported within 15 days", 0),
    ("GMP audit passed with no major findings", 0),
    ("label complies with FDA 21 CFR 201 requirements", 0),
    ("clinical data meets ICH E8 guideline standards", 0),
    ("product recall initiated for contamination risk", 3),
    ("inadequate stability data for shelf-life claim", 2),
    ("pharmacovigilance system not validated", 2),
    ("annual product review submitted and approved", 0),
    ("counterfeit drug suspected in supply chain", 3),
    ("raw material supplier not audited per SOP", 1),
    ("minor typographical error in SOP document", 0),
    ("SOP version control lapsed by two weeks", 1),
    ("equipment calibration overdue by 30 days", 1),
    ("critical equipment calibration overdue by 6 months", 2),
    ("investigational new drug application filed correctly", 0),
    ("phase III trial primary endpoint not achieved", 1),
    ("bioavailability study shows deviation from spec", 2),
    ("environmental monitoring alert in cleanroom", 2),
    ("water system out of specification for endotoxins", 3),
    ("change control approved and documented", 0),
    ("unapproved change to drug formulation", 3),
    ("complaint investigation not completed within 30 days", 1),
    ("distribution records incomplete for recalled product", 2),
    ("temperature excursion during cold chain shipment", 2),
    ("accelerated stability study data within limits", 0),
    ("no evidence of data integrity violation", 0),
    ("data integrity breach in LIMS system", 3),
    ("audit trail disabled in electronic records system", 3),
]


def _build_training_data():
    texts = [s[0] for s in _TRAINING_SAMPLES]
    labels = [s[1] for s in _TRAINING_SAMPLES]
    # Augment with simple perturbations
    augmented_texts, augmented_labels = list(texts), list(labels)
    for text, label in zip(texts, labels):
        augmented_texts.append(text.upper())
        augmented_labels.append(label)
        augmented_texts.append(f"report indicates {text}")
        augmented_labels.append(label)
    return augmented_texts, augmented_labels


def _train_and_save():
    """Train a fresh TF-IDF + LR model and persist to disk."""
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import LogisticRegression
        from sklearn.pipeline import Pipeline
    except ImportError:
        logger.warning("scikit-learn not installed — ML risk scorer disabled")
        return None, None

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    texts, labels = _build_training_data()

    vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=5000, sublinear_tf=True)
    clf = LogisticRegression(max_iter=1000, C=1.0, class_weight="balanced", random_state=42)

    X = vectorizer.fit_transform(texts)
    clf.fit(X, labels)

    with open(VECTORIZER_PATH, "wb") as f:
        pickle.dump(vectorizer, f)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(clf, f)

    logger.info("ML risk scorer trained and saved to %s", MODEL_DIR)
    return vectorizer, clf


def _load_or_train():
    if MODEL_PATH.exists() and VECTORIZER_PATH.exists():
        try:
            with open(VECTORIZER_PATH, "rb") as f:
                vectorizer = pickle.load(f)
            with open(MODEL_PATH, "rb") as f:
                clf = pickle.load(f)
            return vectorizer, clf
        except Exception as exc:
            logger.warning("Failed to load ML model (%s) — retraining", exc)
    return _train_and_save()


class RiskScorer:
    """Singleton ML risk scorer — load once, score many."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._init()
        return cls._instance

    def _init(self):
        self._vectorizer, self._clf = _load_or_train()
        self._enabled = self._vectorizer is not None

    # ── public API ─────────────────────────────────────────────────────────────

    def score(
        self,
        report_text: str,
        violations: list[dict],
    ) -> dict[str, Any]:
        """
        Compute risk score for a compliance report.

        Returns:
            {
                "risk_score": int 0-100,
                "risk_level": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL",
                "clause_scores": [{"text": str, "risk": int, "confidence": float}],
                "confidence": float,
                "ml_enabled": bool,
            }
        """
        if not self._enabled:
            return self._rule_based_score(violations)

        try:
            return self._ml_score(report_text, violations)
        except Exception as exc:
            logger.error("ML scoring failed: %s", exc)
            return self._rule_based_score(violations)

    # ── internals ──────────────────────────────────────────────────────────────

    def _ml_score(self, report_text: str, violations: list[dict]) -> dict:
        # Split report into clauses (sentences / paragraphs)
        import re
        clauses = [s.strip() for s in re.split(r"[.\n]+", report_text) if len(s.strip()) > 20][:50]

        if not clauses:
            return self._rule_based_score(violations)

        X = self._vectorizer.transform(clauses)
        probs = self._clf.predict_proba(X)   # shape (n_clauses, 4)
        # Weighted risk per clause: 0*P0 + 25*P1 + 60*P2 + 100*P3
        weights = np.array([0, 25, 60, 100])
        clause_risks = (probs * weights).sum(axis=1)   # 0-100 per clause
        clause_confidences = probs.max(axis=1)

        # Overall score: blend ML top-clause score with rule-engine violations
        ml_score = float(np.percentile(clause_risks, 90))  # 90th percentile
        rule_score = self._rule_based_score(violations)["risk_score"]
        blended = round(0.6 * ml_score + 0.4 * rule_score)

        # Top-5 risky clauses
        top_idx = np.argsort(clause_risks)[::-1][:5]
        clause_scores = [
            {
                "text": clauses[i][:120],
                "risk": int(round(clause_risks[i])),
                "confidence": round(float(clause_confidences[i]), 3),
            }
            for i in top_idx
            if clause_risks[i] > 10
        ]

        return {
            "risk_score": max(0, min(100, blended)),
            "risk_level": _risk_level(blended),
            "clause_scores": clause_scores,
            "confidence": round(float(clause_confidences.mean()), 3),
            "ml_enabled": True,
        }

    def _rule_based_score(self, violations: list[dict]) -> dict:
        """Fallback when scikit-learn is unavailable."""
        severity_weights = {"critical": 40, "high": 25, "medium": 15, "low": 5}
        raw = sum(severity_weights.get(v.get("severity", "low"), 5) for v in violations)
        score = min(100, raw)
        return {
            "risk_score": score,
            "risk_level": _risk_level(score),
            "clause_scores": [],
            "confidence": 1.0,
            "ml_enabled": False,
        }

    def retrain(self):
        """Force retrain (e.g., after adding labeled data)."""
        self._vectorizer, self._clf = _train_and_save()
        self._enabled = self._vectorizer is not None
        RiskScorer._instance = None  # reset singleton


def _risk_level(score: int) -> str:
    if score >= 75:
        return "CRITICAL"
    if score >= 50:
        return "HIGH"
    if score >= 25:
        return "MEDIUM"
    return "LOW"
