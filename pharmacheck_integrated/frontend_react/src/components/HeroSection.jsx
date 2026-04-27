import { lazy, Suspense, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, ArrowDown, Shield } from 'lucide-react'

// Lazy-load the Spline 3D scene — large library, don't block initial render
const Spline = lazy(() => import('@splinetool/react-spline'))

// Pharma-themed Spline scene (abstract molecular / data sphere)
const SPLINE_SCENE = 'https://prod.spline.design/Slk6b8kz3LRlKiyk/scene.splinecode'

const NAV_LINKS = ['Platform', 'Regulations', 'Jurisdictions', 'Architecture', 'Docs']

function FadeUp({ children, delay = 0, className = '', style = {} }) {
  return (
    <motion.div
      className={className}
      style={{ opacity: 0, ...style }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      initial={{ opacity: 0, y: 22, filter: 'blur(4px)' }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  )
}

export default function HeroSection({ onScrollDown }) {
  const [splineLoaded, setSplineLoaded] = useState(false)

  return (
    <section
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: '#080808' }}>

      {/* ── Spline 3D background ────────────────────────────── */}
      <div className="absolute inset-0">
        <Suspense fallback={
          <div className="absolute inset-0" style={{ background: '#080808' }}>
            {/* Animated fallback grid */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `
                linear-gradient(rgba(163,230,53,0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(163,230,53,0.03) 1px, transparent 1px)
              `,
              backgroundSize: '60px 60px',
            }} />
          </div>
        }>
          <Spline
            scene={SPLINE_SCENE}
            className="w-full h-full"
            onLoad={() => setSplineLoaded(true)}
          />
        </Suspense>
      </div>

      {/* Dark overlay — denser at bottom so text reads clearly */}
      <div className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(8,8,8,0.96) 0%, rgba(8,8,8,0.55) 40%, rgba(8,8,8,0.2) 100%)',
        }} />

      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav className="relative z-20 flex items-center justify-between px-8 lg:px-16 py-6 pointer-events-auto">
        {/* Logo */}
        <motion.div
          className="flex items-center gap-2.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#a3e635,#22d3ee)', boxShadow: '0 0 16px rgba(163,230,53,0.35)' }}>
            <Shield size={14} style={{ color: '#080808', strokeWidth: 2.5 }} />
          </div>
          <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: '#f5f5f5', letterSpacing: '-0.01em' }}>
            PHARMA<span style={{ color: '#a3e635' }}>CHECK</span>
          </span>
        </motion.div>

        {/* Links */}
        <motion.div
          className="hidden md:flex items-center gap-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}>
          {NAV_LINKS.map(link => (
            <a key={link} href={`#${link.toLowerCase()}`}
              style={{
                fontFamily: 'Sora, sans-serif',
                fontSize: '0.7rem',
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'rgba(245,245,245,0.45)',
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}
              onMouseOver={e => e.target.style.color = 'rgba(245,245,245,0.9)'}
              onMouseOut={e => e.target.style.color = 'rgba(245,245,245,0.45)'}>
              {link}
            </a>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.button
          className="hidden md:flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          style={{
            fontFamily: 'Sora, sans-serif',
            fontSize: '0.68rem',
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#f5f5f5',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '10px 22px',
            borderRadius: 6,
            cursor: 'pointer',
            transition: 'all 0.15s',
            pointerEvents: 'auto',
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}>
          Run Analysis
        </motion.button>
      </nav>

      {/* ── Bottom-left hero content ─────────────────────────── */}
      <div className="relative z-20 flex-1 flex items-end pointer-events-none">
        <div className="w-full max-w-[90%] sm:max-w-lg lg:max-w-2xl px-8 md:px-16 pb-14 md:pb-16 space-y-5">

          {/* Eyebrow */}
          <FadeUp delay={0.15}>
            <div className="inline-flex items-center gap-2 pointer-events-auto"
              style={{
                background: 'rgba(163,230,53,0.08)',
                border: '1px solid rgba(163,230,53,0.2)',
                borderRadius: 99,
                padding: '5px 14px',
              }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#a3e635', boxShadow: '0 0 8px #a3e63580' }} />
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.65rem',
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#a3e635',
              }}>
                AI-Powered · Multi-Jurisdictional · Real-Time
              </span>
            </div>
          </FadeUp>

          {/* Headline */}
          <FadeUp delay={0.2}>
            <h1 style={{
              fontFamily: 'Sora, sans-serif',
              fontSize: 'clamp(2.8rem, 7vw, 5.5rem)',
              fontWeight: 700,
              lineHeight: 1.0,
              letterSpacing: '-0.04em',
              color: '#f5f5f5',
              textTransform: 'uppercase',
            }}>
              PHARMA
              <br />
              <span style={{ color: '#a3e635', textShadow: '0 0 48px rgba(163,230,53,0.35)' }}>
                COMPLIANCE
              </span>
              <br />
              <span style={{ fontSize: '0.48em', fontWeight: 500, color: 'rgba(245,245,245,0.5)', letterSpacing: '0.02em', textTransform: 'none' }}>
                Intelligence Platform
              </span>
            </h1>
          </FadeUp>

          {/* Subheading */}
          <FadeUp delay={0.32}>
            <p style={{
              fontFamily: 'Sora, sans-serif',
              fontSize: 'clamp(1rem, 2vw, 1.4rem)',
              fontWeight: 300,
              color: 'rgba(245,245,245,0.75)',
              lineHeight: 1.4,
            }}>
              Pharmaceutical compliance, enforced by AI.
            </p>
          </FadeUp>

          {/* Description */}
          <FadeUp delay={0.44}>
            <p style={{
              fontFamily: 'Sora, sans-serif',
              fontSize: 'clamp(0.82rem, 1.3vw, 1rem)',
              fontWeight: 300,
              color: 'rgba(245,245,245,0.42)',
              lineHeight: 1.7,
              maxWidth: 460,
            }}>
              Upload a drug dossier or paste a compliance report. PharmaCheck
              analyses it against FDA, EMA, CDSCO, HIPAA, and ICH regulations —
              live, with cited regulatory evidence and AI-generated remediation guidance.
            </p>
          </FadeUp>

          {/* CTAs */}
          <FadeUp delay={0.56}>
            <div className="flex flex-wrap gap-3 pointer-events-auto" style={{ fontFamily: 'Sora, sans-serif' }}>
              <button
                onClick={onScrollDown}
                style={{
                  background: '#a3e635',
                  color: '#080808',
                  padding: '14px 28px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  borderRadius: 4,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'filter 0.15s, transform 0.1s',
                }}
                onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                onMouseOut={e => e.currentTarget.style.filter = 'brightness(1)'}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
                <span>Run Analysis</span>
                <ChevronRight size={14} />
              </button>

              <button
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  color: '#f5f5f5',
                  padding: '14px 28px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  borderRadius: 4,
                  border: '1px solid rgba(255,255,255,0.12)',
                  cursor: 'pointer',
                  transition: 'background 0.15s, transform 0.1s',
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
                View Architecture
              </button>
            </div>
          </FadeUp>

          {/* Trust line */}
          <FadeUp delay={0.68}>
            <p style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.65rem',
              fontWeight: 400,
              color: 'rgba(245,245,245,0.25)',
              letterSpacing: '0.08em',
              paddingTop: 4,
            }}>
              649 regulatory chunks · 5 jurisdictions · 9 official sources
            </p>
          </FadeUp>
        </div>
      </div>

      {/* ── Scroll indicator ─────────────────────────────────── */}
      <motion.div
        className="absolute bottom-8 right-8 z-20 pointer-events-auto cursor-pointer"
        onClick={onScrollDown}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <motion.div
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}>
          <ArrowDown size={16} style={{ color: 'rgba(245,245,245,0.3)' }} />
        </motion.div>
        <span style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.55rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'rgba(245,245,245,0.2)',
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
        }}>
          Scroll
        </span>
      </motion.div>

      {/* ── Regulation badges row (bottom edge) ──────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center justify-end gap-6 px-8 md:px-16 py-3">
          {[
            { name: 'FDA',   color: '#22d3ee' },
            { name: 'EMA',   color: '#818cf8' },
            { name: 'CDSCO', color: '#a3e635' },
            { name: 'HIPAA', color: '#fb7185' },
            { name: 'ICH',   color: '#fbbf24' },
          ].map(r => (
            <span key={r.name} style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.6rem',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: r.color,
              opacity: 0.55,
            }}>
              {r.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
