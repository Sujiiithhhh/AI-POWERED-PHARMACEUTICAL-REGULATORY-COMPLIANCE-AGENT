import { motion } from 'framer-motion'
import { calculateScore, getLetterGrade, getCategoryBreakdown } from '../utils/scoring'

function Ring({ score, size = 100, radius = 38, strokeWidth = 7, color, children }) {
  const circ   = 2 * Math.PI * radius
  const offset = circ * (1 - Math.max(0, Math.min(100, score)) / 100)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth} />
        <motion.circle
          cx={size/2} cy={size/2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: [0.16,1,0.3,1], delay: 0.3 }}
          style={{ filter: `drop-shadow(0 0 8px ${color}70)` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  )
}

const CATS = [
  { name: 'Privacy',    color: '#22d3ee', icon: '🔒' },
  { name: 'Safety',     color: '#818cf8', icon: '🛡️' },
  { name: 'Labelling',  color: '#fbbf24', icon: '🏷️' },
  { name: 'Claims',     color: '#fb7185', icon: '📢' },
]

export default function ScoreCard({ violations = [] }) {
  const score = calculateScore(violations)
  const { grade, label, color } = getLetterGrade(score)
  const cats  = getCategoryBreakdown(violations)

  return (
    <div className="card p-6 h-full flex flex-col gap-6">
      {/* Main score */}
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="relative">
          <Ring score={score} size={140} radius={58} strokeWidth={9} color={color}>
            <div className="flex flex-col items-center">
              <motion.span
                className="font-black leading-none"
                style={{
                  fontSize: '3.8rem',
                  color,
                  letterSpacing: '-0.06em',
                  textShadow: `0 0 40px ${color}70, 0 0 80px ${color}25`,
                }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: [0.16,1,0.3,1], delay: 0.2 }}>
                {grade}
              </motion.span>
              <span className="text-[10px] font-mono mt-0.5" style={{ color: `${color}80` }}>
                {score}/100
              </span>
            </div>
          </Ring>
        </div>

        <div className="text-center">
          <p className="text-sm font-bold" style={{ color }}>{label}</p>
          <p className="text-xs mt-0.5" style={{ color: '#4a4a6a' }}>Compliance Score</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg"
              style={{ background: `${color}12`, color, border: `1px solid ${color}20` }}>
              {violations.length} violation{violations.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div>
        <p className="mono-label mb-3" style={{ color: '#3a3a56' }}>Category Breakdown</p>
        <div className="grid grid-cols-2 gap-2.5">
          {cats.map((cat, i) => {
            const cfg = CATS[i] || { color: '#818cf8', icon: '📋' }
            return (
              <div key={cat.name}
                className="p-3 rounded-2xl flex flex-col items-center gap-2"
                style={{
                  background: `${cfg.color}08`,
                  border: `1px solid ${cfg.color}15`,
                }}>
                <Ring score={cat.pct} size={56} radius={22} strokeWidth={5} color={cfg.color}>
                  <span className="text-sm leading-none">{cfg.icon}</span>
                </Ring>
                <div className="text-center">
                  <div className="text-xs font-bold font-mono" style={{ color: cfg.color }}>
                    {cat.pct}%
                  </div>
                  <div className="text-[9px]" style={{ color: '#4a4a6a' }}>{cat.name}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Grade legend */}
      <div className="grid grid-cols-3 gap-2">
        {[
          ['A', '#22c55e', 'Pass'],
          ['B/C', '#fbbf24', 'Review'],
          ['D/F', '#ef4444', 'Fail'],
        ].map(([g, c, l]) => (
          <div key={g} className="py-2.5 rounded-xl text-center"
            style={{ background: `${c}0a`, border: `1px solid ${c}18` }}>
            <div className="text-sm font-black" style={{ color: c }}>{g}</div>
            <div className="text-[8px] font-semibold mt-0.5" style={{ color: `${c}aa` }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
