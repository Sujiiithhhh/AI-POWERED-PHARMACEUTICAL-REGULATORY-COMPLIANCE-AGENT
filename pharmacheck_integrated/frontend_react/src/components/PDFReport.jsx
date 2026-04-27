import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
} from '@react-pdf/renderer'
import { FileDown } from 'lucide-react'

// ── Palette ────────────────────────────────────────────────────────────────
const C = {
  bg:        '#08080f',
  card:      '#0f0f1a',
  lime:      '#a3e635',
  cyan:      '#22d3ee',
  violet:    '#818cf8',
  border:    '#1e1e35',
  textPri:   '#f1f5f9',
  textMuted: '#64748b',
  textSoft:  '#94a3b8',
  pass:      '#22c55e',
  fail:      '#ef4444',
  review:    '#f59e0b',
  critBg:    '#1a0a0a',
  highBg:    '#1a0f0a',
  medBg:     '#1a140a',
}

const SEV_COLOR = { critical: C.fail, high: '#f97316', medium: C.review, low: C.pass }

// ── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    backgroundColor: C.bg,
    color: C.textPri,
    fontFamily: 'Helvetica',
    paddingHorizontal: 36,
    paddingVertical: 32,
    fontSize: 9,
  },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  logoBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoBadge: {
    backgroundColor: '#1a2a0a', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3,
    border: '1px solid #a3e63533',
  },
  logoText: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.lime },
  logoSub:  { fontSize: 8, color: C.textMuted, marginTop: 2 },
  headerMeta: { alignItems: 'flex-end' },
  metaLine: { fontSize: 7.5, color: C.textMuted, marginBottom: 1 },

  // Divider
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },

  // Status banner
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusEmoji: { fontSize: 18 },
  statusLabel: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  statusSub: { fontSize: 8, color: C.textMuted, marginTop: 2 },
  scoreBox: { alignItems: 'flex-end' },
  scoreNum: { fontSize: 26, fontFamily: 'Helvetica-Bold' },
  scoreLabel: { fontSize: 8, color: C.textMuted },

  // Section heading
  sectionTitle: {
    fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
  },

  // Category grid
  catGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  catCard: {
    flex: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: C.card, border: '1px solid #1e1e35',
  },
  catName:  { fontSize: 7.5, color: C.textMuted, marginBottom: 2 },
  catScore: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  catPct:   { fontSize: 7, color: C.textMuted },

  // Violation card
  vCard: {
    borderRadius: 7, marginBottom: 8, overflow: 'hidden',
    border: '1px solid #1e1e35',
  },
  vHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, paddingVertical: 6,
  },
  vHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vType: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.textPri },
  sevBadge: {
    borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2,
    fontSize: 6.5, fontFamily: 'Helvetica-Bold',
  },
  ruleTag: {
    borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2,
    fontSize: 6.5, backgroundColor: C.card, color: C.textMuted,
    border: '1px solid #1e1e35',
  },
  vBody: {
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: C.card, gap: 6,
  },
  fieldLabel: { fontSize: 7, color: C.textMuted, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  evidenceBox: {
    backgroundColor: '#08080f', borderRadius: 4,
    paddingHorizontal: 7, paddingVertical: 5,
    border: '1px solid #1e1e35',
  },
  evidenceText: { fontSize: 7.5, color: C.textSoft, fontFamily: 'Courier', lineHeight: 1.5 },
  explanationText: { fontSize: 8, color: C.textSoft, lineHeight: 1.5 },
  fixBox: {
    borderRadius: 4, paddingHorizontal: 7, paddingVertical: 5,
  },
  fixText: { fontSize: 8, lineHeight: 1.5 },

  // Regulation clause
  regGroup: { marginBottom: 10 },
  regSource: { fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  regClause: {
    backgroundColor: C.card, borderRadius: 5,
    paddingHorizontal: 8, paddingVertical: 6,
    marginBottom: 4, border: '1px solid #1e1e35',
  },
  regText: { fontSize: 7.5, color: C.textSoft, lineHeight: 1.5, fontFamily: 'Courier' },

  // Footer
  footer: {
    position: 'absolute', bottom: 20, left: 36, right: 36,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  footerText: { fontSize: 7, color: C.textMuted },
  pageNum: { fontSize: 7, color: C.textMuted },
})

// ── Helpers ────────────────────────────────────────────────────────────────
function statusColors(status) {
  if (status === 'PASS')         return { bg: '#0a1f0a', text: C.pass,   border: '#22c55e33' }
  if (status === 'FAIL')         return { bg: '#1f0a0a', text: C.fail,   border: '#ef444433' }
  if (status === 'NEEDS_REVIEW') return { bg: '#1f170a', text: C.review, border: '#f59e0b33' }
  return                                { bg: C.card,    text: C.textSoft, border: C.border }
}

function gradeColor(score) {
  if (score >= 90) return C.pass
  if (score >= 75) return '#84cc16'
  if (score >= 60) return C.review
  if (score >= 45) return '#f97316'
  return C.fail
}

function calcScore(violations = []) {
  const P = { critical: 30, high: 18, medium: 8, low: 3 }
  let s = 100
  for (const v of violations) s -= (P[v.severity] ?? 5)
  return Math.max(0, s)
}

function getGrade(score) {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 45) return 'D'
  return 'F'
}

const CAT_MAP = {
  privacy: 'Privacy', adverse_event: 'Safety',
  mandatory_reporting_context: 'Safety',
  off_label_promotion: 'Labelling', comparative_claims: 'Claims',
}
const CAT_COLORS = { Privacy: C.cyan, Safety: '#f97316', Labelling: C.lime, Claims: C.violet }

function getCats(violations = []) {
  const cats = { Privacy: 25, Safety: 25, Labelling: 25, Claims: 25 }
  const P = { critical: 30, high: 18, medium: 8, low: 3 }
  for (const v of violations) {
    const cat = CAT_MAP[v.rule_id] ?? 'Claims'
    cats[cat] = Math.max(0, cats[cat] - (P[v.severity] ?? 5))
  }
  return Object.entries(cats).map(([name, score]) => ({ name, score, color: CAT_COLORS[name] }))
}

// ── PDF Document ───────────────────────────────────────────────────────────
function CompliancePDF({ result }) {
  const violations  = result?.violations ?? []
  const regulations = result?.retrieved_regulations ?? []
  const status      = result?.compliance_status ?? 'PASS'
  const score       = calcScore(violations)
  const grade       = getGrade(score)
  const sc          = statusColors(status)
  const categories  = getCats(violations)
  const now         = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  // Group regulations by source
  const grouped = {}
  for (const r of regulations) {
    const k = r.source ?? 'Unknown'
    if (!grouped[k]) grouped[k] = []
    grouped[k].push(r)
  }

  const statusEmoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '🔴' : '⚠️'
  const statusLabel =
    status === 'PASS' ? 'Compliant' : status === 'FAIL' ? 'Non-Compliant' : 'Needs Review'

  return (
    <Document>
      {/* ── Page 1: Summary ── */}
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.logoBox}>
            <View style={s.logoBadge}>
              <Text style={s.logoText}>PharmaCheck</Text>
            </View>
            <View>
              <Text style={{ fontSize: 8, color: C.textMuted }}>AI Compliance Report</Text>
            </View>
          </View>
          <View style={s.headerMeta}>
            <Text style={s.metaLine}>Generated: {now}</Text>
            <Text style={s.metaLine}>Engine: RAG + Rule-based + LLM</Text>
            <Text style={s.metaLine}>Sources: FDA · EMA · CDSCO · HIPAA · ICH</Text>
          </View>
        </View>
        <View style={s.divider} />

        {/* Status banner */}
        <View style={[s.statusBanner, { backgroundColor: sc.bg, border: `1px solid ${sc.border}` }]}>
          <View style={s.statusLeft}>
            <Text style={s.statusEmoji}>{statusEmoji}</Text>
            <View>
              <Text style={[s.statusLabel, { color: sc.text }]}>{statusLabel}</Text>
              <Text style={s.statusSub}>
                {violations.length} violation{violations.length !== 1 ? 's' : ''} ·{' '}
                {regulations.length} regulatory clauses retrieved
              </Text>
            </View>
          </View>
          <View style={s.scoreBox}>
            <Text style={[s.scoreNum, { color: gradeColor(score) }]}>{grade}</Text>
            <Text style={[s.scoreLabel, { color: gradeColor(score) }]}>{score}/100</Text>
          </View>
        </View>

        {/* Category breakdown */}
        <Text style={s.sectionTitle}>Category Breakdown</Text>
        <View style={s.catGrid}>
          {categories.map((cat) => (
            <View key={cat.name} style={s.catCard}>
              <Text style={s.catName}>{cat.name}</Text>
              <Text style={[s.catScore, { color: cat.color }]}>{cat.score}/25</Text>
              <Text style={s.catPct}>{Math.round((cat.score / 25) * 100)}% compliant</Text>
            </View>
          ))}
        </View>

        <View style={s.divider} />

        {/* Violations */}
        <Text style={[s.sectionTitle, { marginTop: 4 }]}>
          Violations ({violations.length})
        </Text>

        {violations.length === 0 ? (
          <View style={[s.vCard, { padding: 12, backgroundColor: '#0a1f0a' }]}>
            <Text style={{ color: C.pass, fontSize: 9 }}>
              ✓ No violations detected. Report meets all checked regulatory requirements.
            </Text>
          </View>
        ) : (
          violations.map((v, i) => {
            const sevColor = SEV_COLOR[v.severity] ?? C.review
            return (
              <View key={i} style={[s.vCard, { borderLeftWidth: 3, borderLeftColor: sevColor }]}>
                {/* Violation header */}
                <View style={[s.vHeader, { backgroundColor: `${sevColor}11` }]}>
                  <View style={s.vHeaderLeft}>
                    <Text style={s.vType}>{v.type}</Text>
                    <View style={[s.sevBadge, { backgroundColor: `${sevColor}22`, color: sevColor }]}>
                      <Text style={{ color: sevColor, fontSize: 6.5, fontFamily: 'Helvetica-Bold' }}>
                        {(v.severity ?? '').toUpperCase()}
                      </Text>
                    </View>
                    {v.regulatory_basis && (
                      <View style={s.ruleTag}>
                        <Text>{v.regulatory_basis}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 7, color: C.textMuted, fontFamily: 'Courier' }}>
                    {v.rule_id}
                  </Text>
                </View>

                {/* Violation body */}
                <View style={s.vBody}>
                  {!!v.evidence && (
                    <View>
                      <Text style={s.fieldLabel}>EVIDENCE</Text>
                      <View style={s.evidenceBox}>
                        <Text style={s.evidenceText}>{v.evidence}</Text>
                      </View>
                    </View>
                  )}
                  {!!v.explanation && (
                    <View>
                      <Text style={s.fieldLabel}>WHY THIS VIOLATES</Text>
                      <Text style={s.explanationText}>{v.explanation}</Text>
                    </View>
                  )}
                  {!!v.suggested_fix && (
                    <View>
                      <Text style={s.fieldLabel}>SUGGESTED FIX</Text>
                      <View style={[s.fixBox, { backgroundColor: `${sevColor}11`, border: `1px solid ${sevColor}22` }]}>
                        <Text style={[s.fixText, { color: sevColor }]}>{v.suggested_fix}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )
          })
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            PharmaCheck · Confidential Compliance Report · {now}
          </Text>
          <Text
            style={s.pageNum}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>

      {/* ── Page 2: Retrieved Regulations ── */}
      {regulations.length > 0 && (
        <Page size="A4" style={s.page}>
          <View style={s.header}>
            <View style={s.logoBox}>
              <View style={s.logoBadge}>
                <Text style={s.logoText}>PharmaCheck</Text>
              </View>
            </View>
            <Text style={[s.metaLine, { alignSelf: 'center' }]}>
              Regulatory Evidence — Retrieved Clauses
            </Text>
          </View>
          <View style={s.divider} />

          <Text style={[s.sectionTitle, { marginTop: 4 }]}>
            Retrieved Regulatory Clauses ({regulations.length})
          </Text>
          <Text style={{ fontSize: 8, color: C.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
            The following clauses were retrieved from the PharmaCheck vector index via cosine
            similarity search (ChromaDB / HNSW) and used to ground the LLM explanations above.
          </Text>

          {Object.entries(grouped).map(([source, regs]) => {
            const sc = { FDA: C.cyan, EMA: C.violet, CDSCO: C.lime, HIPAA: '#f97316', ICH: C.review }
            const color = sc[source] ?? C.textMuted
            return (
              <View key={source} style={s.regGroup}>
                <Text style={[s.regSource, { color }]}>▶ {source}</Text>
                {regs.map((reg, i) => (
                  <View key={i} style={s.regClause}>
                    <Text style={s.regText}>
                      {reg.text.length > 600 ? reg.text.slice(0, 600) + '…' : reg.text}
                    </Text>
                  </View>
                ))}
              </View>
            )
          })}

          <View style={s.divider} />
          <Text style={{ fontSize: 7.5, color: C.textMuted, lineHeight: 1.6 }}>
            DISCLAIMER: This report is generated by an automated AI compliance tool for informational
            purposes only. It does not constitute legal or regulatory advice. All findings should be
            reviewed by a qualified regulatory affairs professional before submission to any authority.
          </Text>

          <View style={s.footer} fixed>
            <Text style={s.footerText}>
              PharmaCheck · Confidential · {now}
            </Text>
            <Text
              style={s.pageNum}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            />
          </View>
        </Page>
      )}
    </Document>
  )
}

// ── Export button (rendered in React tree) ─────────────────────────────────
export default function PDFExportButton({ result }) {
  const fileName = `PharmaCheck_Report_${new Date().toISOString().slice(0, 10)}.pdf`

  return (
    <PDFDownloadLink
      document={<CompliancePDF result={result} />}
      fileName={fileName}
    >
      {({ loading }) => (
        <button
          disabled={loading}
          className="btn-ghost flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg"
          style={loading ? { opacity: 0.5 } : {}}
        >
          <FileDown size={12} />
          {loading ? 'Building PDF…' : 'Export PDF Report'}
        </button>
      )}
    </PDFDownloadLink>
  )
}
