import { useState, useEffect } from 'react'
import { Shield, Cpu } from 'lucide-react'

export default function Header() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className="sticky top-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(5,5,15,0.9)' : 'rgba(5,5,15,0.6)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: scrolled
          ? '1px solid rgba(255,255,255,0.07)'
          : '1px solid rgba(255,255,255,0.04)',
      }}>
      <div className="max-w-[1320px] mx-auto px-5 sm:px-8 lg:px-12 h-[58px] flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, #a3e635 0%, #22d3ee 100%)',
              boxShadow: '0 0 20px rgba(163,230,53,0.35)',
            }}>
            <Shield size={15} style={{ color: '#03030a', strokeWidth: 2.5 }} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-extrabold tracking-tight text-text-primary">
              Pharma<span className="text-accent-lime">Check</span>
            </span>
            <span className="hidden sm:block text-[10px] font-mono px-2 py-0.5 rounded-md"
              style={{
                color: '#4a4a6a',
                border: '1px solid rgba(255,255,255,0.07)',
                background: 'rgba(255,255,255,0.03)',
              }}>
              v2.0
            </span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* AI indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium"
            style={{
              background: 'rgba(163,230,53,0.07)',
              border: '1px solid rgba(163,230,53,0.14)',
              color: '#a3e635',
            }}>
            <Cpu size={10} />
            <span>Gemini 1.5 Flash</span>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium"
            style={{
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.16)',
              color: '#4ade80',
            }}>
            <span className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#22c55e', animation: 'glowPulse 2s ease-in-out infinite' }} />
            <span>Operational</span>
          </div>
        </div>
      </div>
    </header>
  )
}
