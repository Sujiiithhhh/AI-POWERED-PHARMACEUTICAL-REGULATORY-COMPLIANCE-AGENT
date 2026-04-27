import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, ChevronDown, BookOpen } from 'lucide-react'

const SOURCE_META = {
  FDA:   { color: '#22d3ee', bg: 'rgba(34,211,238,0.1)',  border: 'rgba(34,211,238,0.2)',  url: 'https://www.fda.gov/drugs' },
  EMA:   { color: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.2)', url: 'https://www.ema.europa.eu/en/human-regulatory-overview' },
  CDSCO: { color: '#a3e635', bg: 'rgba(163,230,53,0.1)',  border: 'rgba(163,230,53,0.2)',  url: 'https://cdsco.gov.in/opencms/opencms/en/Home/' },
  HIPAA: { color: '#fb7185', bg: 'rgba(251,113,133,0.1)', border: 'rgba(251,113,133,0.2)', url: 'https://www.hhs.gov/hipaa/index.html' },
  ICH:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.2)',  url: 'https://www.ich.org/products/guidelines.html' },
}

function defaultMeta(src) {
  return { color: '#818cf8', bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.15)', url: '#' }
}

function RegClause({ text, source }) {
  const [expanded, setExpanded] = useState(false)
  const PREVIEW = 200
  const long = text.length > PREVIEW

  return (
    <div className="rounded-xl p-3 space-y-2"
      style={{ background: 'rgba(5,5,15,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-xs leading-relaxed" style={{ color: '#c8c8e0' }}>
        {expanded ? text : (long ? text.slice(0, PREVIEW) + '…' : text)}
      </p>
      {long && (
        <button onClick={() => setExpanded(!expanded)}
          className="text-[10px] font-medium transition-colors"
          style={{ color: '#6b6b8a' }}>
          {expanded ? '▲ Show less' : '▼ Show full clause'}
        </button>
      )}
    </div>
  )
}

function SourceGroup({ source, regs }) {
  const [open, setOpen] = useState(true)
  const meta = SOURCE_META[source] || defaultMeta(source)

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${meta.border}`, background: `${meta.bg}` }}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ borderBottom: open ? `1px solid ${meta.border}` : 'none' }}>
        <span className="reg-badge text-[9px]"
          style={{ color: meta.color, background: `${meta.color}20`, border: `1px solid ${meta.color}30` }}>
          {source}
        </span>
        <span className="text-xs font-semibold flex-1" style={{ color: meta.color }}>
          {regs.length} clause{regs.length !== 1 ? 's' : ''}
        </span>
        {meta.url !== '#' && (
          <a href={meta.url} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="p-1 rounded-lg transition-colors hover:opacity-80"
            style={{ color: meta.color }}>
            <ExternalLink size={11} />
          </a>
        )}
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={13} style={{ color: meta.color }} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="p-3 space-y-2">
              {regs.map((r, i) => <RegClause key={i} text={r.text} source={source} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function RegulationsPanel({ retrieved = [] }) {
  if (!retrieved.length) return null

  const grouped = retrieved.reduce((acc, r) => {
    const src = r.source || 'Unknown'
    if (!acc[src]) acc[src] = []
    acc[src].push(r)
    return acc
  }, {})

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.2)' }}>
          <BookOpen size={11} style={{ color: '#818cf8' }} />
        </div>
        <h3 className="text-sm font-semibold text-text-primary">Retrieved Regulations</h3>
        <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-md"
          style={{ color: '#818cf8', background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)' }}>
          {retrieved.length} clauses · {Object.keys(grouped).length} sources
        </span>
      </div>

      <div className="space-y-3">
        {Object.entries(grouped).map(([src, regs]) => (
          <SourceGroup key={src} source={src} regs={regs} />
        ))}
      </div>
    </div>
  )
}
