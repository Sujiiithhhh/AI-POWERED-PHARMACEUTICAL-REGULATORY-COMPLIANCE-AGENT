import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const WORDS = ['Ingest', 'Analyse', 'Comply']
const DURATION = 2700   // ms total for 000 → 100
const INTERVAL = 900    // ms per word

export default function LoadingScreen({ onComplete }) {
  const [wordIndex, setWordIndex]   = useState(0)
  const [progress,  setProgress]    = useState(0)
  const onCompleteRef = useRef(onComplete)
  const calledRef     = useRef(false)

  // Keep ref fresh
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  // Word cycling — stops at last word
  useEffect(() => {
    if (wordIndex >= WORDS.length - 1) return
    const t = setTimeout(() => setWordIndex(i => i + 1), INTERVAL)
    return () => clearTimeout(t)
  }, [wordIndex])

  // Counter 000 → 100 over DURATION ms via rAF
  useEffect(() => {
    let start = null
    let raf

    function tick(ts) {
      if (!start) start = ts
      const elapsed = ts - start
      const p = Math.min((elapsed / DURATION) * 100, 100)
      setProgress(p)

      if (p < 100) {
        raf = requestAnimationFrame(tick)
      } else {
        // 100 hit — wait 400ms then fire onComplete
        if (!calledRef.current) {
          calledRef.current = true
          setTimeout(() => onCompleteRef.current?.(), 400)
        }
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col overflow-hidden"
      style={{ background: '#0a0a0a' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}>

      {/* ── Top-left: Platform label ─────────────────────────── */}
      <motion.div
        className="absolute top-8 left-8 md:top-12 md:left-12 select-none"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}>
        <span style={{
          fontFamily: 'Sora, sans-serif',
          fontSize: '0.7rem',
          fontWeight: 400,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: '#555',
        }}>
          Compliance Agent
        </span>
      </motion.div>

      {/* ── Top-right: PharmaCheck wordmark ─────────────────── */}
      <motion.div
        className="absolute top-8 right-8 md:top-12 md:right-12 select-none"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}>
        <span style={{
          fontFamily: 'Sora, sans-serif',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: '#f5f5f5',
        }}>
          Pharma<span style={{ color: '#a3e635' }}>Check</span>
        </span>
      </motion.div>

      {/* ── Center: Cycling words ────────────────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center select-none">
        <AnimatePresence mode="wait">
          <motion.span
            key={wordIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            style={{
              fontFamily: '"Instrument Serif", Georgia, serif',
              fontStyle: 'italic',
              fontSize: 'clamp(2.8rem, 8vw, 6rem)',
              color: 'rgba(245,245,245,0.82)',
              fontWeight: 400,
              letterSpacing: '-0.01em',
              lineHeight: 1,
            }}>
            {WORDS[wordIndex]}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* ── Bottom-right: Counter ────────────────────────────── */}
      <motion.div
        className="absolute bottom-8 right-8 md:bottom-12 md:right-12 select-none"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}>
        <span style={{
          fontFamily: '"Instrument Serif", Georgia, serif',
          fontSize: 'clamp(4rem, 10vw, 8rem)',
          color: '#f5f5f5',
          fontWeight: 400,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {Math.round(progress).toString().padStart(3, '0')}
        </span>
      </motion.div>

      {/* ── Bottom-left: FDA / EMA tags ──────────────────────── */}
      <motion.div
        className="absolute bottom-10 left-8 md:bottom-14 md:left-12 flex items-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.5 }}>
        {['FDA', 'EMA', 'CDSCO', 'ICH'].map((tag, i) => (
          <span key={tag} style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.6rem',
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.18)',
          }}>
            {tag}
          </span>
        ))}
      </motion.div>

      {/* ── Progress bar: bottom edge ────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0" style={{ height: 3, background: 'rgba(31,31,31,0.5)' }}>
        <motion.div
          className="h-full origin-left"
          style={{
            background: 'linear-gradient(90deg, #a3e635 0%, #22d3ee 100%)',
            boxShadow: '0 0 10px rgba(163,230,53,0.4)',
            scaleX: progress / 100,
          }}
          animate={{ scaleX: progress / 100 }}
          transition={{ duration: 0.08, ease: 'linear' }}
        />
      </div>

      {/* ── Subtle horizontal rule ───────────────────────────── */}
      <motion.div
        className="absolute left-8 right-8 md:left-12 md:right-12"
        style={{ bottom: 'calc(10px + env(safe-area-inset-bottom, 0px))', height: 1, background: 'rgba(31,31,31,0.6)' }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.2, delay: 0.3, ease: [0.16,1,0.3,1] }}
      />
    </motion.div>
  )
}
