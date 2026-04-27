import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { feature } from 'topojson-client'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe2, X, RotateCcw } from 'lucide-react'
import useStore from '../store/useStore'
import { getJurisdictionStatus } from '../utils/scoring'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

const COUNTRY_RULES = {
  840: ['privacy','adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
  276: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
  250: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
  380: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
  724: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
  826: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
  356: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
  392: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
  156: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
  124: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
   36: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
   76: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
  756: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
  528: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
  752: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
  208: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
  246: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
  578: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
  616: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
  620: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
   40: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
  300: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
   56: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
  710: ['adverse_event','mandatory_reporting_context','off_label_promotion','comparative_claims'],
}

const COUNTRY_NAMES = {
  840:'United States', 276:'Germany', 250:'France', 380:'Italy', 724:'Spain',
  826:'United Kingdom', 356:'India', 392:'Japan', 156:'China', 124:'Canada',
   36:'Australia', 76:'Brazil', 756:'Switzerland', 528:'Netherlands', 752:'Sweden',
  208:'Denmark', 246:'Finland', 578:'Norway', 616:'Poland', 620:'Portugal',
   40:'Austria', 300:'Greece', 56:'Belgium', 710:'South Africa',
}

const REGULATORS = {
  840:'FDA + HIPAA', 276:'EMA', 250:'EMA', 380:'EMA', 724:'EMA',
  826:'MHRA / EMA', 356:'CDSCO', 392:'PMDA / ICH', 156:'NMPA / ICH',
  124:'Health Canada / ICH', 36:'TGA / ICH', 76:'ANVISA / ICH',
}

// --- Colors ---
const COL = {
  DEFAULT:      '#12122a',
  HOVER:        '#1e1e40',
  PASS:         '#14532d',
  FAIL:         '#7f1d1d',
  NEEDS_REVIEW: '#78350f',
}
const GLOW = {
  PASS: '#22c55e', FAIL: '#ef4444', NEEDS_REVIEW: '#f59e0b',
}

export default function WorldMap() {
  const svgRef      = useRef(null)
  const rotateRef   = useRef(null)   // d3.timer handle
  const projRef     = useRef(null)
  const pathRef     = useRef(null)
  const rotationRef = useRef([20, -25, 0])
  const isDraggingRef = useRef(false)

  const [tooltip,  setTooltip]  = useState(null)
  const [selected, setSelected] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [stats,    setStats]    = useState({ pass:0, fail:0, review:0 })

  const { result } = useStore()
  const violations = result?.violations || []

  const getStatus = useCallback((id) => {
    const rules = COUNTRY_RULES[+id]
    if (!rules || !result) return 'DEFAULT'
    return getJurisdictionStatus(rules, violations)
  }, [result, violations])

  const recolour = useCallback(() => {
    if (!svgRef.current) return
    d3.select(svgRef.current).selectAll('path.country')
      .transition().duration(800).ease(d3.easeCubicOut)
      .attr('fill', d => COL[getStatus(d.id)] || COL.DEFAULT)
      .attr('stroke', d => {
        const s = getStatus(d.id)
        return s !== 'DEFAULT' ? `${GLOW[s]}60` : 'rgba(255,255,255,0.1)'
      })
      .attr('stroke-width', d => {
        const s = getStatus(d.id)
        return s !== 'DEFAULT' ? 0.8 : 0.35
      })
  }, [getStatus])

  useEffect(() => { recolour() }, [recolour])

  useEffect(() => {
    if (!result) { setStats({ pass:0, fail:0, review:0 }); return }
    let pass=0, fail=0, review=0
    Object.keys(COUNTRY_RULES).forEach(id => {
      const s = getStatus(+id)
      if (s === 'PASS') pass++
      else if (s === 'FAIL') fail++
      else if (s === 'NEEDS_REVIEW') review++
    })
    setStats({ pass, fail, review })
  }, [result, getStatus])

  useEffect(() => {
    const container = svgRef.current?.parentElement
    if (!container) return

    const W = container.clientWidth
    const H = Math.min(Math.max(W * 0.62, 320), 520)
    const radius = Math.min(W, H) / 2 - 24

    const projection = d3.geoOrthographic()
      .scale(radius)
      .translate([W/2, H/2])
      .clipAngle(90)
      .rotate(rotationRef.current)

    projRef.current = projection
    const pathGen = d3.geoPath().projection(projection)
    pathRef.current = pathGen

    const svg = d3.select(svgRef.current)
      .attr('width', W)
      .attr('height', H)

    svg.selectAll('*').remove()

    // Defs
    const defs = svg.append('defs')

    // Ocean gradient
    const oceanGrad = defs.append('radialGradient').attr('id','ocean-grad')
      .attr('cx','38%').attr('cy','32%').attr('r','70%')
    oceanGrad.append('stop').attr('offset','0%').attr('stop-color','#0f1235')
    oceanGrad.append('stop').attr('offset','100%').attr('stop-color','#03030a')

    // Atmosphere glow
    const atmosGrad = defs.append('radialGradient').attr('id','atmos-grad')
      .attr('cx','50%').attr('cy','50%').attr('r','50%')
    atmosGrad.append('stop').attr('offset','85%').attr('stop-color','transparent')
    atmosGrad.append('stop').attr('offset','100%').attr('stop-color','rgba(163,230,53,0.08)')

    // Glow filter
    const glowFilter = defs.append('filter').attr('id','country-glow').attr('x','-20%').attr('y','-20%').attr('width','140%').attr('height','140%')
    glowFilter.append('feGaussianBlur').attr('in','SourceGraphic').attr('stdDeviation','3').attr('result','blur')
    const merge = glowFilter.append('feMerge')
    merge.append('feMergeNode').attr('in','blur')
    merge.append('feMergeNode').attr('in','SourceGraphic')

    // Outer atmosphere ring
    svg.append('circle')
      .attr('cx', W/2).attr('cy', H/2)
      .attr('r', radius + 18)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(163,230,53,0.06)')
      .attr('stroke-width', 18)

    svg.append('circle')
      .attr('cx', W/2).attr('cy', H/2)
      .attr('r', radius + 3)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(163,230,53,0.12)')
      .attr('stroke-width', 1)

    // Ocean sphere
    svg.append('circle')
      .attr('cx', W/2).attr('cy', H/2)
      .attr('r', radius)
      .attr('fill', 'url(#ocean-grad)')

    // Graticule
    const grat = d3.geoGraticule().step([20, 20])
    svg.append('path')
      .datum(grat())
      .attr('class', 'grat')
      .attr('d', pathGen)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.04)')
      .attr('stroke-width', 0.5)

    // Countries
    const countriesG = svg.append('g')

    // ── DRAG TO ROTATE (BUG FIX: stop timer on START, not drag) ─────────────
    const drag = d3.drag()
      .on('start', () => {
        // ✅ CRITICAL FIX: stop timer immediately on mousedown/touchstart
        isDraggingRef.current = true
        if (rotateRef.current) { rotateRef.current.stop(); rotateRef.current = null }
        svg.attr('cursor', 'grabbing')
      })
      .on('drag', (event) => {
        const [λ, φ] = projection.rotate()
        const sens = 0.28
        const newRot = [
          λ + event.dx * sens,
          Math.max(-82, Math.min(82, φ - event.dy * sens)),
          0
        ]
        rotationRef.current = newRot
        projection.rotate(newRot)
        svg.selectAll('path.country').attr('d', pathGen)
        svg.select('path.grat').attr('d', pathGen)
      })
      .on('end', () => {
        isDraggingRef.current = false
        svg.attr('cursor', 'grab')
        startAutoRotate()
      })

    svg.call(drag).attr('cursor', 'grab')

    function redraw() {
      svg.selectAll('path.country').attr('d', pathGen)
      svg.select('path.grat').attr('d', pathGen)
    }

    function startAutoRotate() {
      if (rotateRef.current) rotateRef.current.stop()
      rotateRef.current = d3.timer(() => {
        const [λ, φ, γ] = projection.rotate()
        const newRot = [λ + 0.1, φ, γ]
        rotationRef.current = newRot
        projection.rotate(newRot)
        redraw()
      })
    }

    // Load geodata
    setLoading(true)
    d3.json(GEO_URL).then(world => {
      const countries = feature(world, world.objects.countries)

      countriesG.selectAll('path.country')
        .data(countries.features)
        .enter().append('path')
        .attr('class', 'country')
        .attr('d', pathGen)
        .attr('fill', d => COL[getStatus(d.id)] || COL.DEFAULT)
        .attr('stroke', 'rgba(255,255,255,0.1)')
        .attr('stroke-width', 0.35)
        .style('cursor', d => COUNTRY_NAMES[+d.id] ? 'pointer' : 'default')
        .on('mouseover', function(event, d) {
          if (!COUNTRY_NAMES[+d.id]) return
          d3.select(this).raise()
            .transition().duration(120)
            .attr('stroke', 'rgba(163,230,53,0.7)')
            .attr('stroke-width', 1.5)
          setTooltip({ id: +d.id, x: event.offsetX, y: event.offsetY })
        })
        .on('mousemove', function(event, d) {
          if (!COUNTRY_NAMES[+d.id]) return
          setTooltip(t => t ? { ...t, x: event.offsetX, y: event.offsetY } : null)
        })
        .on('mouseout', function(event, d) {
          const s = getStatus(d.id)
          d3.select(this)
            .transition().duration(200)
            .attr('stroke', s !== 'DEFAULT' ? `${GLOW[s]}60` : 'rgba(255,255,255,0.1)')
            .attr('stroke-width', s !== 'DEFAULT' ? 0.8 : 0.35)
          setTooltip(null)
        })
        .on('click', function(event, d) {
          if (!COUNTRY_NAMES[+d.id]) return
          setSelected({ id: +d.id, status: getStatus(d.id) })
          // Fly to country
          if (rotateRef.current) { rotateRef.current.stop(); rotateRef.current = null }
          const centroid = d3.geoCentroid(d)
          const target = [-centroid[0], -centroid[1] * 0.5, 0]
          const current = projection.rotate()
          const interp = d3.interpolate(current, target)
          d3.transition().duration(900).ease(d3.easeCubicInOut)
            .tween('rotate', () => t => {
              const r = interp(t)
              rotationRef.current = r
              projection.rotate(r)
              redraw()
            })
            .on('end', startAutoRotate)
        })

      setLoading(false)
      startAutoRotate()
    }).catch(() => setLoading(false))

    return () => { if (rotateRef.current) rotateRef.current.stop() }
  }, [])

  // Recolour on result change
  useEffect(() => { recolour() }, [recolour])

  const selName   = selected ? COUNTRY_NAMES[selected.id] : null
  const selReg    = selected ? REGULATORS[selected.id] || 'ICH Guidelines' : null
  const selStatus = selected?.status || 'DEFAULT'
  const relViols  = selected
    ? violations.filter(v => (COUNTRY_RULES[selected.id] || []).includes(v.rule_id))
    : []

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.18)' }}>
            <Globe2 size={15} style={{ color: '#22d3ee' }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary leading-none mb-0.5">
              Jurisdiction Coverage
            </h3>
            <p className="text-[10px] font-mono" style={{ color: '#4a4a6a' }}>
              {result ? `${stats.pass + stats.fail + stats.review} jurisdictions analysed` : 'Drag to rotate · Click a country'}
            </p>
          </div>
        </div>

        {/* Stats or hint */}
        <div className="flex items-center gap-2">
          {result ? (
            <>
              {stats.pass > 0 && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                  style={{ color: '#4ade80', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-status-pass" />
                  {stats.pass} Pass
                </span>
              )}
              {stats.review > 0 && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                  style={{ color: '#fbbf24', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#f59e0b' }} />
                  {stats.review} Review
                </span>
              )}
              {stats.fail > 0 && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                  style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-status-fail" />
                  {stats.fail} Fail
                </span>
              )}
            </>
          ) : (
            <span className="text-[10px] font-mono hidden sm:block" style={{ color: '#2a2a46' }}>
              24 tracked jurisdictions
            </span>
          )}
        </div>
      </div>

      {/* Globe */}
      <div className="relative" style={{ userSelect: 'none' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="w-7 h-7 rounded-full border-2 animate-spin"
              style={{ borderColor: 'rgba(163,230,53,0.15)', borderTopColor: '#a3e635' }} />
          </div>
        )}
        <svg
          ref={svgRef}
          className="w-full block"
          style={{ opacity: loading ? 0.15 : 1, transition: 'opacity 0.5s' }}
        />

        {/* Tooltip */}
        <AnimatePresence>
          {tooltip && COUNTRY_NAMES[tooltip.id] && (
            <motion.div
              key={tooltip.id}
              initial={{ opacity: 0, scale: 0.88, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88 }}
              transition={{ duration: 0.12 }}
              className="absolute pointer-events-none z-20 rounded-2xl px-4 py-3"
              style={{
                left: Math.min(tooltip.x + 14, (svgRef.current?.clientWidth || 600) - 180),
                top: tooltip.y - 50,
                background: 'rgba(10,10,24,0.97)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                backdropFilter: 'blur(16px)',
                minWidth: 148,
              }}>
              <div className="text-xs font-bold text-text-primary mb-1.5">
                {COUNTRY_NAMES[tooltip.id]}
              </div>
              {REGULATORS[tooltip.id] && (
                <div className="text-[9px] font-mono mb-1.5" style={{ color: '#4a4a6a' }}>
                  {REGULATORS[tooltip.id]}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full"
                  style={{ background: GLOW[getStatus(tooltip.id)] || '#2a2a4a' }} />
                <span className="text-[10px] font-semibold"
                  style={{ color: GLOW[getStatus(tooltip.id)] || '#4a4a6a' }}>
                  {getStatus(tooltip.id) === 'DEFAULT' ? 'Not analysed' : getStatus(tooltip.id).replace('_', ' ')}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend bar */}
      <div className="px-6 py-3 flex items-center gap-5 flex-wrap"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {[
          { label: 'Compliant',     color: COL.PASS,   dot: GLOW.PASS },
          { label: 'Non-Compliant', color: COL.FAIL,   dot: GLOW.FAIL },
          { label: 'Review Needed', color: COL.NEEDS_REVIEW, dot: GLOW.NEEDS_REVIEW },
          { label: 'Unaffected',    color: COL.DEFAULT, dot: '#2a2a4a' },
        ].map(({ label, color, dot }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ background: color, border: `1px solid ${dot}40` }} />
            <span className="text-[10px] font-mono" style={{ color: '#4a4a6a' }}>{label}</span>
          </div>
        ))}
        <button
          onClick={() => {
            if (rotateRef.current) rotateRef.current.stop()
            const proj = projRef.current
            if (!proj) return
            const start = proj.rotate()
            const end = [20, -25, 0]
            const interp = d3.interpolate(start, end)
            d3.transition().duration(800).ease(d3.easeCubicInOut)
              .tween('rotate', () => t => {
                const r = interp(t)
                rotationRef.current = r
                proj.rotate(r)
                if (svgRef.current) {
                  d3.select(svgRef.current).selectAll('path.country').attr('d', pathRef.current)
                  d3.select(svgRef.current).select('path.grat').attr('d', pathRef.current)
                }
              })
              .on('end', () => {
                rotateRef.current = d3.timer(() => {
                  const [λ,φ,γ] = proj.rotate()
                  const r = [λ+0.1,φ,γ]
                  rotationRef.current = r
                  proj.rotate(r)
                  if (svgRef.current) {
                    d3.select(svgRef.current).selectAll('path.country').attr('d', pathRef.current)
                    d3.select(svgRef.current).select('path.grat').attr('d', pathRef.current)
                  }
                })
              })
          }}
          className="ml-auto flex items-center gap-1.5 text-[10px] font-mono transition-colors"
          style={{ color: '#3a3a56' }}
          onMouseOver={e => e.currentTarget.style.color = '#6b6b8a'}
          onMouseOut={e => e.currentTarget.style.color = '#3a3a56'}>
          <RotateCcw size={9} />
          Reset
        </button>
      </div>

      {/* Country detail drawer */}
      <AnimatePresence>
        {selected && selName && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16,1,0.3,1] }}
            className="overflow-hidden"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="px-6 py-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-sm font-bold text-text-primary">{selName}</h4>
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: '#4a4a6a' }}>{selReg}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-3 py-1 rounded-xl"
                    style={{
                      color: GLOW[selStatus] || '#6b6b8a',
                      background: `${GLOW[selStatus] || '#6b6b8a'}12`,
                      border: `1px solid ${GLOW[selStatus] || '#6b6b8a'}22`,
                    }}>
                    {selStatus === 'DEFAULT' ? 'Not Analysed' : selStatus.replace('_', ' ')}
                  </span>
                  <button onClick={() => setSelected(null)}
                    className="w-7 h-7 rounded-xl flex items-center justify-center btn-ghost">
                    <X size={11} />
                  </button>
                </div>
              </div>

              {relViols.length > 0 ? (
                <div className="space-y-2">
                  {relViols.map((v, i) => (
                    <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-xl text-xs"
                      style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 sev-critical">
                        {v.severity?.toUpperCase()}
                      </span>
                      <span style={{ color: '#c8c8e0' }}>{v.type}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: '#4a4a6a' }}>
                  {result
                    ? 'No violations affect this jurisdiction.'
                    : 'Run a compliance check to see jurisdiction-specific results.'}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
