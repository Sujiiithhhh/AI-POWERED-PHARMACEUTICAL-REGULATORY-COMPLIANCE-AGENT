import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, AlertTriangle, Quote, Lightbulb, Hash } from 'lucide-react'

const SEV = {
  critical: { label:'Critical', border:'viol-critical', bg:'rgba(239,68,68,0.05)',  dot:'#ef4444', text:'#f87171', badge:'sev-critical' },
  high:     { label:'High',     border:'viol-high',     bg:'rgba(249,115,22,0.05)', dot:'#f97316', text:'#fb923c', badge:'sev-high' },
  medium:   { label:'Medium',   border:'viol-medium',   bg:'rgba(245,158,11,0.04)', dot:'#f59e0b', text:'#fbbf24', badge:'sev-medium' },
  low:      { label:'Low',      border:'viol-low',      bg:'rgba(59,130,246,0.04)', dot:'#3b82f6', text:'#60a5fa', badge:'sev-low' },
}

export default function ViolationCard({ violation, index }) {
  const [open, setOpen] = useState(true)   // all cards expanded by default
  const cfg = SEV[violation.severity] || SEV.low

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, ease: [0.16,1,0.3,1] }}
      className={`rounded-2xl overflow-hidden ${cfg.border}`}
      style={{ background: cfg.bg, border: '1px solid rgba(255,255,255,0.06)' }}>

      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left"
        style={{ background: 'transparent' }}
        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
        onMouseOut={e => e.currentTarget.style.background = 'transparent'}>

        {/* Severity dot */}
        <div className="mt-1.5 shrink-0 w-2 h-2 rounded-full"
          style={{
            background: cfg.dot,
            boxShadow: `0 0 8px ${cfg.dot}80`,
            animation: 'glowPulse 2s ease-in-out infinite',
          }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className="text-sm font-semibold text-text-primary">{violation.type}</span>
            <span className={`${cfg.badge} text-[9px] font-bold px-2 py-0.5 rounded-md`}>
              {cfg.label}
            </span>
            {violation.rule_id && (
              <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded"
                style={{ color: '#4a4a6a', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <Hash size={7} />
                {violation.rule_id}
              </span>
            )}
          </div>
          {!open && violation.evidence && (
            <p className="text-[11px] truncate" style={{ color: '#4a4a6a' }}>
              {violation.evidence.substring(0, 90)}…
            </p>
          )}
        </div>

        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={14} style={{ color: '#4a4a6a' }} />
        </motion.div>
      </button>

      {/* Expanded */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16,1,0.3,1] }}
            className="overflow-hidden">
            <div className="px-4 pb-4 space-y-3">
              <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

              {/* Evidence */}
              {violation.evidence && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Quote size={9} style={{ color: cfg.text }} />
                    <span className="mono-label" style={{ color: cfg.text }}>Evidence</span>
                  </div>
                  <div className="code-block">{violation.evidence}</div>
                </div>
              )}

              {/* Explanation */}
              {violation.explanation && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle size={9} style={{ color: '#fbbf24' }} />
                    <span className="mono-label" style={{ color: '#fbbf24' }}>Why This Matters</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: '#9494b8' }}>
                    {violation.explanation}
                  </p>
                </div>
              )}

              {/* Fix */}
              {violation.suggested_fix && (
                <div className="rounded-xl p-3.5"
                  style={{ background: 'rgba(163,230,53,0.05)', border: '1px solid rgba(163,230,53,0.12)' }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Lightbulb size={9} style={{ color: '#a3e635' }} />
                    <span className="mono-label" style={{ color: '#a3e635' }}>Suggested Fix</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: '#9494b8' }}>
                    {violation.suggested_fix}
                  </p>
                </div>
              )}

              {/* Regulatory basis */}
              {violation.regulatory_basis && (
                <p className="text-[10px] font-mono" style={{ color: '#3a3a56' }}>
                  Source: {violation.regulatory_basis}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
