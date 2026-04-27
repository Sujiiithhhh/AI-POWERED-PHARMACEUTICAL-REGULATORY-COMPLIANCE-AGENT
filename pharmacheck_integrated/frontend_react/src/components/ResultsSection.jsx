import { lazy, Suspense, useCallback } from 'react'
import { Download, RefreshCw, AlertTriangle, CheckCircle2, Clock, FileJson, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import useStore from '../store/useStore'
import ScoreCard from './ScoreCard'
import ViolationCard from './ViolationCard'
import RegulationsPanel from './RegulationsPanel'
import { calculateScore, getLetterGrade } from '../utils/scoring'

const PDFExportButton = lazy(() =>
  import('./PDFReport').then(m => ({ default: m.PDFExportButton }))
)

const STATUS_META = {
  PASS:         { label:'Compliant',     Icon: CheckCircle2, color:'#22c55e', bg:'rgba(34,197,94,0.07)',   border:'rgba(34,197,94,0.18)' },
  FAIL:         { label:'Non-Compliant', Icon: AlertTriangle, color:'#ef4444', bg:'rgba(239,68,68,0.07)',   border:'rgba(239,68,68,0.18)' },
  NEEDS_REVIEW: { label:'Needs Review',  Icon: Clock,         color:'#f59e0b', bg:'rgba(245,158,11,0.07)',  border:'rgba(245,158,11,0.18)' },
}

function Metric({ value, label, color }) {
  return (
    <div className="flex flex-col items-center gap-1 px-5 py-3 rounded-2xl"
      style={{ background: `${color}0a`, border: `1px solid ${color}18` }}>
      <span className="text-2xl font-black font-mono leading-none" style={{ color }}>{value}</span>
      <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: `${color}90` }}>{label}</span>
    </div>
  )
}

export default function ResultsSection() {
  const { result, setResult, setReportText, reportText, reset } = useStore()
  if (!result) return null

  const { compliance_status, violations = [], retrieved_regulations = [] } = result
  const meta  = STATUS_META[compliance_status] || STATUS_META.NEEDS_REVIEW
  const { Icon } = meta
  const score = calculateScore(violations)
  const { grade, color: gc } = getLetterGrade(score)
  const crit  = violations.filter(v => v.severity === 'critical').length
  const high  = violations.filter(v => v.severity === 'high').length

  const handleReset = useCallback(() => { reset(); setReportText('') }, [reset, setReportText])

  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), {
      href: url,
      download: `pharmacheck_${new Date().toISOString().slice(0,10)}.json`,
    }).click()
    URL.revokeObjectURL(url)
  }, [result])

  return (
    <div className="space-y-6">
      {/* Verdict banner */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16,1,0.3,1] }}
        className="rounded-2xl p-6"
        style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>

        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Status */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}28` }}>
              <Icon size={22} style={{ color: meta.color }} />
            </div>
            <div>
              <p className="text-[11px] font-semibold mb-0.5 mono-label" style={{ color: `${meta.color}90` }}>
                Final Verdict
              </p>
              <h2 className="text-2xl font-black tracking-tight leading-none" style={{ color: meta.color }}>
                {meta.label}
              </h2>
            </div>
          </div>

          {/* Metrics */}
          <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
            <Metric value={grade}            label="Grade"    color={gc} />
            <Metric value={score}            label="Score"    color={gc} />
            <Metric value={violations.length} label="Flags"   color={meta.color} />
            {crit > 0 && <Metric value={crit} label="Critical" color="#ef4444" />}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-5 pt-5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={exportJSON}
            className="btn-ghost flex items-center gap-1.5 px-3.5 py-2 text-xs">
            <FileJson size={11} /> Export JSON
          </button>
          <Suspense fallback={
            <button className="btn-ghost flex items-center gap-1.5 px-3.5 py-2 text-xs opacity-50">
              <Download size={11} /> Export PDF
            </button>
          }>
            <PDFExportButton result={result} reportText={reportText} />
          </Suspense>
          <button onClick={handleReset}
            className="btn-ghost flex items-center gap-1.5 px-3.5 py-2 text-xs ml-auto"
            style={{ color: '#6b6b8a' }}>
            <RefreshCw size={11} /> New Check
          </button>
        </div>
      </motion.div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Score */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, ease: [0.16,1,0.3,1] }}>
          <ScoreCard violations={violations} />
        </motion.div>

        {/* Violations + Regulations */}
        <motion.div
          className="lg:col-span-2 space-y-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, ease: [0.16,1,0.3,1] }}>

          {violations.length > 0 ? (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-text-primary">Violations Detected</h3>
                  {crit > 0 && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-md sev-critical">
                      {crit} critical
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg"
                  style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.18)' }}>
                  {violations.length} found
                </span>
              </div>
              <div className="space-y-2.5">
                {violations.map((v, i) => <ViolationCard key={i} violation={v} index={i} />)}
              </div>
            </div>
          ) : (
            <div className="card p-10 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <Sparkles size={26} style={{ color: '#22c55e' }} />
              </div>
              <div>
                <p className="text-base font-bold text-text-primary mb-1">No Violations Found</p>
                <p className="text-xs" style={{ color: '#4a4a6a' }}>
                  This report passed all regulatory compliance checks.
                </p>
              </div>
            </div>
          )}

          <RegulationsPanel retrieved={retrieved_regulations} />
        </motion.div>
      </div>
    </div>
  )
}
