/**
 * Scoring and categorisation utilities for compliance results.
 */

const SEVERITY_PENALTY = {
  critical: 30,
  high:     18,
  medium:   8,
  low:      3,
}

/** Map violation rule_id → display category */
const RULE_CATEGORY = {
  privacy:                    'Privacy',
  adverse_event:              'Safety',
  mandatory_reporting_context:'Safety',
  off_label_promotion:        'Labelling',
  comparative_claims:         'Claims',
}

/** 0–100 score based on violations */
export function calculateScore(violations = []) {
  let score = 100
  for (const v of violations) {
    score -= SEVERITY_PENALTY[v.severity] ?? 5
  }
  return Math.max(0, score)
}

/** Letter grade + label for a numeric score */
export function getLetterGrade(score) {
  if (score >= 90) return { grade: 'A', label: 'Excellent',      color: '#22c55e' }
  if (score >= 75) return { grade: 'B', label: 'Good',           color: '#84cc16' }
  if (score >= 60) return { grade: 'C', label: 'Acceptable',     color: '#f59e0b' }
  if (score >= 45) return { grade: 'D', label: 'At Risk',        color: '#f97316' }
  return            { grade: 'F', label: 'Non-Compliant',  color: '#ef4444' }
}

/** Per-category breakdown (score out of 25 each) */
export function getCategoryBreakdown(violations = []) {
  const categories = {
    Privacy:   { score: 25, max: 25, violations: [] },
    Safety:    { score: 25, max: 25, violations: [] },
    Labelling: { score: 25, max: 25, violations: [] },
    Claims:    { score: 25, max: 25, violations: [] },
  }

  for (const v of violations) {
    const cat = RULE_CATEGORY[v.rule_id] ?? 'Claims'
    if (categories[cat]) {
      categories[cat].violations.push(v)
      categories[cat].score = Math.max(
        0,
        categories[cat].score - (SEVERITY_PENALTY[v.severity] ?? 5)
      )
    }
  }

  return Object.entries(categories).map(([name, data]) => ({
    name,
    score:      data.score,
    max:        data.max,
    pct:        Math.round((data.score / data.max) * 100),
    violations: data.violations,
  }))
}

/** Map rule_id to regulation bodies mentioned */
export function getRegulatoryBodies(violations = []) {
  const bodies = new Set()
  for (const v of violations) {
    if (v.regulatory_basis) bodies.add(v.regulatory_basis)
  }
  return [...bodies]
}

/** Map status to display config */
export const STATUS_CONFIG = {
  PASS:         { label: 'PASS',         cls: 'badge-pass',   emoji: '✅', color: '#22c55e' },
  FAIL:         { label: 'FAIL',         cls: 'badge-fail',   emoji: '🔴', color: '#ef4444' },
  NEEDS_REVIEW: { label: 'NEEDS REVIEW', cls: 'badge-review', emoji: '⚠️', color: '#f59e0b' },
}

/** Severity display config */
export const SEVERITY_CONFIG = {
  critical: { label: 'CRITICAL', color: '#ef4444', bg: 'rgba(239,68,68,0.10)',   cls: 'sev-critical' },
  high:     { label: 'HIGH',     color: '#f97316', bg: 'rgba(249,115,22,0.10)',  cls: 'sev-high'     },
  medium:   { label: 'MEDIUM',   color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', cls: 'sev-medium'   },
  low:      { label: 'LOW',      color: '#22c55e', bg: 'rgba(34,197,94,0.10)',  cls: 'sev-low'      },
}

/**
 * Given a set of violations, determine the compliance status
 * for a specific jurisdiction (regulation source).
 */
export function getJurisdictionStatus(ruleIds, violations = []) {
  const relevant = violations.filter((v) => ruleIds.includes(v.rule_id))
  if (!relevant.length) return 'PASS'
  const severities = relevant.map((v) => v.severity)
  if (severities.includes('critical') || severities.includes('high')) return 'FAIL'
  if (severities.includes('medium')) return 'NEEDS_REVIEW'
  return 'PASS'
}
