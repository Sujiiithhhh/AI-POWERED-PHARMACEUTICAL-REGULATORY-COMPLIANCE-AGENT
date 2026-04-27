import { useRef, useState, useEffect } from 'react'
import { Upload, FileText, X, Zap, Sparkles, AlertCircle, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import useStore from '../store/useStore'
import useComplianceStream from '../hooks/useComplianceStream'
import StreamingProgress from './StreamingProgress'

const SAMPLE = `DRUG: Nexopravil 10mg Tablets
INDICATION: Treatment of type 2 diabetes mellitus in adults.

The patient, John Smith (DOB: 1978-04-12, phone: 555-234-5678),
presented with elevated HbA1c of 9.2%. Nexopravil is superior to
all competing agents and is the best-in-class treatment for diabetes.

Adverse events reported: nausea, dizziness, and headache in 3 patients.
No hospitalization occurred.

Note: Nexopravil may be effective for weight loss in non-diabetic patients.`

const REGS = [
  { name: 'FDA',   color: '#22d3ee' },
  { name: 'EMA',   color: '#818cf8' },
  { name: 'CDSCO', color: '#a3e635' },
  { name: 'HIPAA', color: '#fb7185' },
  { name: 'ICH',   color: '#fbbf24' },
]

export default function UploadSection() {
  const { reportText, setReportText, setResult, reset: storeReset } = useStore()
  const [isDragging, setIsDragging] = useState(false)
  const fileRef = useRef(null)

  const {
    startStream, steps, currentStep, isStreaming,
    result: streamResult, error, reset: streamReset,
  } = useComplianceStream()

  // ✅ Sync result via useEffect (prevents blank screen on 2nd run)
  useEffect(() => {
    if (streamResult) setResult(streamResult)
  }, [streamResult, setResult])

  function onDragOver(e)  { e.preventDefault(); setIsDragging(true) }
  function onDragLeave()  { setIsDragging(false) }
  function onDrop(e)      { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) readFile(f) }
  function readFile(file) { const r = new FileReader(); r.onload = e => setReportText(e.target.result); r.readAsText(file) }

  async function handleCheck() {
    if (!reportText.trim() || isStreaming) return
    const text = reportText
    storeReset()
    streamReset()
    await startStream(text)
  }

  function handleClear() {
    setReportText('')
    storeReset()
    streamReset()
  }

  const charCount = reportText.length
  const wordCount = reportText.trim() ? reportText.trim().split(/\s+/).length : 0
  const showProgress = isStreaming || (steps.length > 0 && !streamResult)

  return (
    <div className="space-y-4">
      {/* Main input card */}
      <div className={clsx(
        'border-card p-5 space-y-4 transition-all duration-300',
        isDragging && 'scale-[1.006]'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(163,230,53,0.1)', border: '1px solid rgba(163,230,53,0.18)' }}>
              <FileText size={14} style={{ color: '#a3e635' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary leading-none">Report Input</h3>
              <p className="text-[10px] mt-0.5" style={{ color: '#4a4a6a' }}>
                Paste, type, or drag & drop
              </p>
            </div>
          </div>

          <button
            onClick={() => { handleClear(); setReportText(SAMPLE) }}
            className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-xl transition-all"
            style={{
              color: '#6b6b8a',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
            onMouseOver={e => e.currentTarget.style.color = '#a3e635'}
            onMouseOut={e => e.currentTarget.style.color = '#6b6b8a'}>
            <Sparkles size={10} />
            Sample
          </button>
        </div>

        {/* Textarea */}
        <div
          className={clsx('drop-zone', isDragging && 'drag-over')}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}>
          <textarea
            className="report-textarea w-full p-4"
            style={{ minHeight: 220 }}
            placeholder={"Paste pharmaceutical compliance report…\n\nOr drag & drop a .txt / .pdf file here"}
            value={reportText}
            onChange={e => setReportText(e.target.value)}
            spellCheck={false}
            disabled={isStreaming}
          />
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={isStreaming}
            className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs">
            <Upload size={10} />
            Upload file
          </button>
          <input ref={fileRef} type="file" accept=".txt,.pdf,.md" className="hidden"
            onChange={e => e.target.files[0] && readFile(e.target.files[0])} />

          {(reportText || steps.length > 0) && (
            <button
              onClick={handleClear}
              disabled={isStreaming}
              className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs"
              style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.15)' }}>
              <X size={10} />
              Clear
            </button>
          )}

          {charCount > 0 && (
            <span className="ml-auto text-[10px] font-mono" style={{ color: '#3a3a56' }}>
              {charCount.toLocaleString()} chars · {wordCount}w
            </span>
          )}
        </div>

        {/* Regulation tags */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {REGS.map(r => (
            <span key={r.name}
              className="text-[9px] font-mono font-bold px-2 py-1 rounded-md tracking-widest uppercase"
              style={{
                color: r.color,
                background: `${r.color}10`,
                border: `1px solid ${r.color}22`,
              }}>
              {r.name}
            </span>
          ))}
          <span className="text-[9px] font-mono ml-auto" style={{ color: '#2a2a46' }}>
            5 regulatory frameworks
          </span>
        </div>

        {/* Error state */}
        <AnimatePresence>
          {error && !isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-2.5 text-xs rounded-xl p-3"
              style={{
                background: 'rgba(239,68,68,0.07)',
                border: '1px solid rgba(239,68,68,0.18)',
                color: '#f87171',
              }}>
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA */}
        <button
          onClick={handleCheck}
          disabled={!reportText.trim() || isStreaming}
          className="btn-primary w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-sm">
          {isStreaming ? (
            <>
              <div className="w-4 h-4 border-2 rounded-full animate-spin"
                style={{ borderColor: 'rgba(3,3,10,0.25)', borderTopColor: '#03030a' }} />
              <span>Analysing…</span>
            </>
          ) : (
            <>
              <Zap size={16} />
              <span>Run Compliance Check</span>
              <ChevronRight size={14} className="ml-0.5 opacity-60" />
            </>
          )}
        </button>
      </div>

      {/* Streaming progress */}
      <AnimatePresence>
        {showProgress && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16,1,0.3,1] }}>
            <StreamingProgress
              steps={steps}
              currentStep={currentStep}
              isStreaming={isStreaming}
              error={error}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
