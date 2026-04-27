import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

const STEPS = [
  { key: 'parsing',    label: 'Parsing Report',      desc: 'Text extraction & normalisation',   color: '#22d3ee' },
  { key: 'rules',      label: 'Rule Engine',          desc: 'PII · AE · Off-label · Comparative',color: '#818cf8' },
  { key: 'decision',   label: 'Preliminary Verdict',  desc: 'PASS / FAIL / NEEDS_REVIEW logic',  color: '#fbbf24' },
  { key: 'retrieving', label: 'RAG Retrieval',         desc: 'ChromaDB vector knowledge base',    color: '#22d3ee' },
  { key: 'explaining', label: 'LLM Enrichment',        desc: 'Gemini 1.5 Flash explanations',     color: '#a3e635' },
  { key: 'scoring',    label: 'Compliance Scoring',    desc: 'Weighted penalty calculation',      color: '#fb7185' },
  { key: 'complete',   label: 'Analysis Complete',     desc: 'Final report generated',            color: '#22c55e' },
]

export default function StreamingProgress({ steps, currentStep, isStreaming, error }) {
  const progress = currentStep?.progress ?? 0
  const doneSet = new Set(steps.map(s => s.key || s.step))
  const currentKey = currentStep?.step
  const isComplete = doneSet.has('complete') && !isStreaming

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5">
          {isStreaming ? (
            <Loader2 size={14} style={{ color: '#a3e635', animation: 'spin 1s linear infinite' }} />
          ) : error ? (
            <AlertCircle size={14} style={{ color: '#ef4444' }} />
          ) : (
            <CheckCircle2 size={14} style={{ color: '#22c55e' }} />
          )}
          <span className="text-sm font-semibold">
            {isStreaming ? 'Analysing…' : error ? 'Analysis Failed' : 'Analysis Complete'}
          </span>
        </div>
        <span className="text-sm font-black font-mono" style={{
          color: error ? '#ef4444' : '#a3e635',
        }}>
          {Math.round(progress)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="px-5 pt-4 pb-1">
        <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            className="h-full rounded-full relative overflow-hidden"
            style={{ background: error ? '#ef4444' : 'linear-gradient(90deg, #a3e635 0%, #22d3ee 100%)' }}
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }}>
            {isStreaming && (
              <div className="absolute inset-0 overflow-hidden">
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, width: '60%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
                  animation: 'shimmer 1.4s linear infinite',
                }} />
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-5 py-4 space-y-0">
        {STEPS.map((step, idx) => {
          const arrived = steps.find(s => (s.step || s.key) === step.key)
          const isDone  = !!arrived && (step.key !== currentKey || !isStreaming)
          const isCur   = currentKey === step.key && isStreaming
          const isPend  = !arrived && !isCur

          return (
            <div key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
              {/* Connector */}
              {idx < STEPS.length - 1 && (
                <div className="absolute left-[14px] top-8 bottom-0 w-px"
                  style={{
                    background: isDone
                      ? 'linear-gradient(to bottom, rgba(34,197,94,0.35), rgba(255,255,255,0.04))'
                      : 'rgba(255,255,255,0.04)',
                  }} />
              )}

              {/* Dot */}
              <div className="relative z-10 mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                style={{
                  background: isDone
                    ? 'rgba(34,197,94,0.12)'
                    : isCur
                    ? `${step.color}18`
                    : 'rgba(255,255,255,0.03)',
                  border: isDone
                    ? '1px solid rgba(34,197,94,0.28)'
                    : isCur
                    ? `1px solid ${step.color}40`
                    : '1px solid rgba(255,255,255,0.06)',
                  boxShadow: isCur ? `0 0 14px ${step.color}35` : 'none',
                  transition: 'all 0.3s',
                }}>
                {isDone ? (
                  <CheckCircle2 size={12} style={{ color: '#4ade80' }} />
                ) : isCur ? (
                  <div className="w-2 h-2 rounded-full" style={{
                    background: step.color,
                    boxShadow: `0 0 8px ${step.color}`,
                    animation: 'glowPulse 1s ease-in-out infinite',
                  }} />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#1e1e3a' }} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold transition-colors" style={{
                    color: isDone ? '#c8c8e0' : isCur ? '#f0f0ff' : '#2a2a46',
                  }}>
                    {step.label}
                  </span>

                  {isDone && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.18)' }}>
                      ✓
                    </motion.span>
                  )}

                  {isCur && (
                    <motion.span
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 1.4 }}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: `${step.color}12`, color: step.color, border: `1px solid ${step.color}28` }}>
                      live
                    </motion.span>
                  )}
                </div>

                <p className="text-[9px] font-mono mt-0.5" style={{ color: '#2a2a46' }}>
                  {step.desc}
                </p>

                {/* Live terminal message */}
                <AnimatePresence>
                  {isCur && currentStep?.message && (
                    <motion.div
                      key={currentStep.message}
                      initial={{ opacity: 0, y: -3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono"
                      style={{
                        background: `${step.color}08`,
                        border: `1px solid ${step.color}18`,
                        color: step.color,
                      }}>
                      › {currentStep.message}
                    </motion.div>
                  )}
                </AnimatePresence>

                {isDone && arrived?.detail && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[9px] font-mono mt-1" style={{ color: '#3a3a56' }}>
                    {arrived.detail}
                  </motion.p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-5 mb-4 flex items-start gap-2 text-xs rounded-xl p-3"
            style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}>
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
