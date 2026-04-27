import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LoadingScreen from './components/LoadingScreen'
import HeroSection from './components/HeroSection'
import UploadSection from './components/UploadSection'
import WorldMap from './components/WorldMap'
import ResultsSection from './components/ResultsSection'
import useStore from './store/useStore'

export default function App() {
  const [isLoading, setIsLoading] = useState(true)
  const { result } = useStore()
  const platformRef = useRef(null)

  // Scroll to platform section when results arrive
  useEffect(() => {
    if (result) {
      const el = document.getElementById('results-anchor')
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
    }
  }, [result])

  function scrollToPlatform() {
    platformRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      {/* ── Loading screen ───────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {isLoading && (
          <LoadingScreen key="loader" onComplete={() => setIsLoading(false)} />
        )}
      </AnimatePresence>

      {/* ── Main app ─────────────────────────────────────────── */}
      <div style={{ opacity: isLoading ? 0 : 1, transition: 'opacity 0.5s ease-out' }}>

        {/* Full-screen hero with Spline 3D */}
        <HeroSection onScrollDown={scrollToPlatform} />

        {/* ── Platform section ─────────────────────────────── */}
        <div ref={platformRef} id="platform" style={{ background: '#05050f' }}>
          <div className="ambient-bg" aria-hidden="true">
            <span /><span /><span />
          </div>

          <div className="relative z-10 max-w-[1320px] mx-auto px-5 sm:px-8 lg:px-12 pb-32 pt-20">

            {/* Section label */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="mb-10">
              <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full"
                style={{
                  background: 'rgba(163,230,53,0.07)',
                  border: '1px solid rgba(163,230,53,0.16)',
                }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#a3e635' }} />
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a3e635' }}>
                  Compliance Platform
                </span>
              </div>
              <h2 style={{
                fontFamily: 'Sora, sans-serif',
                fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
                fontWeight: 700,
                color: '#f0f0ff',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}>
                Upload. Analyse. <span style={{ color: '#a3e635' }}>Comply.</span>
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed" style={{ color: '#4a4a6a' }}>
                Paste a compliance report or upload a drug dossier. Results stream live with
                cited regulatory evidence across all 5 jurisdictions.
              </p>
            </motion.div>

            {/* Input + Map row */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mb-8">
              <motion.div
                className="xl:col-span-2"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}>
                <UploadSection />
              </motion.div>
              <motion.div
                className="xl:col-span-3"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.18 }}>
                <WorldMap />
              </motion.div>
            </div>

            {/* Results */}
            <AnimatePresence>
              {result && (
                <motion.div
                  id="results-anchor"
                  key="results"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }}>
                  <ResultsSection />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <footer className="relative z-10 py-10 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ fontFamily: 'JetBrains Mono', fontSize: '0.65rem', color: '#2a2a46', letterSpacing: '0.08em' }}>
              PharmaCheck · AI Pharmaceutical Compliance Platform · v2.0
            </p>
            <p style={{ fontFamily: 'JetBrains Mono', fontSize: '0.6rem', color: '#1e1e38', letterSpacing: '0.06em', marginTop: 4 }}>
              FDA · EMA · CDSCO · HIPAA · ICH — For research and educational purposes only
            </p>
          </footer>
        </div>
      </div>
    </>
  )
}
