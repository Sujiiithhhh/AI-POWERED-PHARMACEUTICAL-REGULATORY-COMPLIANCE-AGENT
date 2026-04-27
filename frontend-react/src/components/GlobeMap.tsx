import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import type { Topology } from "topojson-specification";

// ── Public types ──────────────────────────────────────────────────────────────
export interface ViolationSummary {
  type: string;
  severity: string;
  evidence: string;
  regulatory_basis: string;
  explanation?: string;
  suggested_fix?: string;
}

interface GlobeMapProps {
  violations?: ViolationSummary[];
  analysisComplete?: boolean;
}

// ── Country name lookup (ISO 3166-1 numeric) ──────────────────────────────────
const COUNTRY_NAMES: Record<string, string> = {
  "840": "United States",
  "276": "Germany",
  "250": "France",
  "380": "Italy",
  "724": "Spain",
  "528": "Netherlands",
  "752": "Sweden",
  "040": "Austria",
  "056": "Belgium",
  "620": "Portugal",
  "826": "United Kingdom",
  "356": "India",
  "392": "Japan",
  "124": "Canada",
  "036": "Australia",
};

// ── Regulatory jurisdiction → country codes ───────────────────────────────────
const JURISDICTION_COUNTRIES: Record<string, string[]> = {
  FDA:            ["840"],
  HIPAA:          ["840"],
  EMA:            ["276", "250", "380", "724", "528", "752", "040", "056", "620"],
  MHRA:           ["826"],
  CDSCO:          ["356"],
  ICH:            ["840", "276", "250", "826", "392", "124", "036"],
  PMDA:           ["392"],
  "HEALTH CANADA": ["124"],
  TGA:            ["036"],
};

// ── Static fallback data (shown before any analysis) ─────────────────────────
interface StaticCountry {
  name: string;
  count: number;
  types: string[];
  severity: "critical" | "high" | "medium" | "low";
}

const STATIC_VIOLATIONS: Record<string, StaticCountry> = {
  "840": { name: "United States",  count: 47, severity: "critical", types: ["HIPAA Privacy Breach", "FDA Off-label Promotion", "Adverse Event Delay"] },
  "156": { name: "China",          count: 38, severity: "critical", types: ["Import Safety Violations", "Counterfeit Reporting Gaps"] },
  "356": { name: "India",          count: 31, severity: "high",     types: ["CDSCO Non-compliance", "Adverse Event Delay"] },
  "076": { name: "Brazil",         count: 22, severity: "high",     types: ["ANVISA Non-compliance", "Safety Narrative Gaps"] },
  "643": { name: "Russia",         count: 15, severity: "high",     types: ["Safety Reporting Delay", "Documentation Issues"] },
  "276": { name: "Germany",        count: 10, severity: "medium",   types: ["EMA GVP Module VI", "Data Privacy (GDPR)"] },
  "250": { name: "France",         count: 9,  severity: "medium",   types: ["EMA Reporting", "Patient Identifiers"] },
  "380": { name: "Italy",          count: 8,  severity: "medium",   types: ["AIFA Compliance", "EMA Signal Management"] },
  "826": { name: "United Kingdom", count: 6,  severity: "low",      types: ["MHRA Post-marketing", "ICH E2D Gaps"] },
  "124": { name: "Canada",         count: 5,  severity: "low",      types: ["Health Canada Reporting", "Safety Signal"] },
  "036": { name: "Australia",      count: 4,  severity: "low",      types: ["TGA Adverse Event", "Labelling Issues"] },
  "392": { name: "Japan",          count: 4,  severity: "low",      types: ["PMDA Safety Signal", "ICH E2D"] },
};

// ── Colours ───────────────────────────────────────────────────────────────────
const SEVERITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f97316",
  medium:   "#eab308",
  low:      "#22c55e",
};
const SEV_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const OCEAN_COLOR     = "#0d1b2a";
const LAND_DEFAULT    = "#1e293b";
const GRATICULE_COLOR = "rgba(255,255,255,0.05)";
const BORDER_COLOR    = "rgba(255,255,255,0.12)";

// ── Affected country type ─────────────────────────────────────────────────────
interface AffectedCountry {
  code: string;
  name: string;
  severity: string;
  violations: ViolationSummary[];
}

// ── Map violations → countries ────────────────────────────────────────────────
function computeAffectedCountries(
  violations: ViolationSummary[],
): Record<string, AffectedCountry> {
  const result: Record<string, AffectedCountry> = {};

  for (const v of violations) {
    const basis = (v.regulatory_basis || "").toUpperCase();
    const vtype = (v.type || "").toLowerCase();
    const codes = new Set<string>();

    if (basis.includes("FDA") || vtype.includes("off-label") || vtype.includes("comparative") || vtype.includes("promotional")) {
      JURISDICTION_COUNTRIES.FDA.forEach((c) => codes.add(c));
    }
    if (basis.includes("HIPAA") || vtype.includes("privacy") || vtype.includes("phi") || vtype.includes("pii")) {
      JURISDICTION_COUNTRIES.HIPAA.forEach((c) => codes.add(c));
    }
    if (basis.includes("EMA") || basis.includes("GVP")) {
      JURISDICTION_COUNTRIES.EMA.forEach((c) => codes.add(c));
    }
    if (basis.includes("MHRA")) {
      JURISDICTION_COUNTRIES.MHRA.forEach((c) => codes.add(c));
    }
    if (basis.includes("CDSCO")) {
      JURISDICTION_COUNTRIES.CDSCO.forEach((c) => codes.add(c));
    }
    if (basis.includes("ICH") || basis.includes("E2D")) {
      JURISDICTION_COUNTRIES.ICH.forEach((c) => codes.add(c));
    }
    if (vtype.includes("adverse event") || vtype.includes("adverse_event")) {
      // AE obligations span FDA + EMA jurisdictions
      JURISDICTION_COUNTRIES.FDA.forEach((c) => codes.add(c));
      JURISDICTION_COUNTRIES.EMA.forEach((c) => codes.add(c));
    }
    if (basis.includes("HEALTH CANADA") || basis.includes("HEALTH_CANADA")) {
      JURISDICTION_COUNTRIES["HEALTH CANADA"].forEach((c) => codes.add(c));
    }
    if (basis.includes("TGA")) {
      JURISDICTION_COUNTRIES.TGA.forEach((c) => codes.add(c));
    }
    if (basis.includes("PMDA")) {
      JURISDICTION_COUNTRIES.PMDA.forEach((c) => codes.add(c));
    }

    // Default: FDA if no specific jurisdiction matched
    if (codes.size === 0) {
      JURISDICTION_COUNTRIES.FDA.forEach((c) => codes.add(c));
    }

    for (const code of codes) {
      const name = COUNTRY_NAMES[code] || `Country ${code}`;
      if (!result[code]) {
        result[code] = { code, name, severity: v.severity, violations: [v] };
      } else {
        if ((SEV_RANK[v.severity] || 0) > (SEV_RANK[result[code].severity] || 0)) {
          result[code].severity = v.severity;
        }
        // Avoid duplicate violations
        if (!result[code].violations.find((x) => x.type === v.type && x.evidence === v.evidence)) {
          result[code].violations.push(v);
        }
      }
    }
  }

  return result;
}

// ── Tooltip state ─────────────────────────────────────────────────────────────
interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  content: { name: string; severity: string; info: string } | null;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function GlobeMap({
  violations = [],
  analysisComplete = false,
}: GlobeMapProps) {
  const svgRef     = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, content: null,
  });
  const [loaded, setLoaded]               = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<AffectedCountry | null>(null);
  const selectedCountryRef = useRef<AffectedCountry | null>(null);

  // Compute affected countries from real violations
  const affectedCountries = useMemo(
    () =>
      analysisComplete && violations.length > 0
        ? computeAffectedCountries(violations)
        : {},
    [violations, analysisComplete],
  );

  const hasAnalysis = Object.keys(affectedCountries).length > 0;

  // ── Initial globe draw (once) ─────────────────────────────────────────────
  const drawGlobe = useCallback(
    (
      svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
      world: Topology,
      width: number,
      height: number,
    ) => {
      svg.selectAll("*").remove();

      const scale = Math.min(width, height) * 0.42;
      const cx    = width / 2;
      const cy    = height / 2;

      const projection = d3
        .geoOrthographic()
        .scale(scale)
        .translate([cx, cy])
        .rotate([-20, -20, 0])
        .clipAngle(90);

      const pathGen = d3.geoPath().projection(projection);

      // Defs: shadow + glow
      const defs   = svg.append("defs");
      const shadow = defs.append("filter").attr("id", "globe-shadow");
      shadow.append("feDropShadow")
        .attr("dx", 0).attr("dy", 4).attr("stdDeviation", 20)
        .attr("flood-color", "rgba(0,0,0,0.7)");

      const glow = defs.append("radialGradient")
        .attr("id", "globe-glow").attr("cx", "35%").attr("cy", "35%").attr("r", "65%");
      glow.append("stop").attr("offset", "0%").attr("stop-color", "rgba(255,255,255,0.06)");
      glow.append("stop").attr("offset", "100%").attr("stop-color", "rgba(255,255,255,0)");

      // Ocean
      svg.append("circle").attr("cx", cx).attr("cy", cy).attr("r", scale)
        .attr("fill", OCEAN_COLOR).attr("filter", "url(#globe-shadow)");

      // Graticule
      svg.append("path").datum(d3.geoGraticule()())
        .attr("d", pathGen).attr("fill", "none")
        .attr("stroke", GRATICULE_COLOR).attr("stroke-width", 0.4)
        .attr("class", "graticule");

      // Countries (initial fill from static data)
      const countries    = topojson.feature(world, (world as any).objects.countries);
      const countryFeats = (countries as any).features as Array<{
        id: string | number; properties: Record<string, unknown>;
      }>;

      svg.selectAll(".country")
        .data(countryFeats).enter().append("path")
        .attr("class", "country")
        .attr("d", (d) => pathGen(d as d3.GeoPermissibleObjects) ?? "")
        .attr("fill", (d) => {
          const id = String(d.id).padStart(3, "0");
          return STATIC_VIOLATIONS[id] ? SEVERITY_COLOR[STATIC_VIOLATIONS[id].severity] : LAND_DEFAULT;
        })
        .attr("stroke", BORDER_COLOR).attr("stroke-width", 0.4);

      // Glow overlay
      svg.append("circle").attr("cx", cx).attr("cy", cy).attr("r", scale)
        .attr("fill", "url(#globe-glow)").attr("pointer-events", "none");

      // Drag to rotate
      let lastX = 0, lastY = 0;
      const drag = d3.drag<SVGSVGElement, unknown>()
        .on("start", (event) => {
          lastX = event.x; lastY = event.y;
          svg.style("cursor", "grabbing");
        })
        .on("drag", (event) => {
          const dx = event.x - lastX; const dy = event.y - lastY;
          lastX = event.x; lastY = event.y;
          const [lam, phi] = projection.rotate();
          projection.rotate([lam + dx * 0.35, phi - dy * 0.35, 0]);
          svg.selectAll<SVGPathElement, d3.GeoPermissibleObjects>(".country,.graticule")
            .attr("d", (d) => pathGen(d) ?? "");
        })
        .on("end", () => { svg.style("cursor", "grab"); });

      svg.style("cursor", "grab").call(drag);
      setLoaded(true);
    },
    [],
  );

  // Mount + fetch TopoJSON
  useEffect(() => {
    if (!svgRef.current || !wrapperRef.current) return;
    const wrapper = wrapperRef.current;
    const width   = wrapper.clientWidth || 600;
    const height  = wrapper.clientHeight || 600;
    const svg     = d3.select(svgRef.current).attr("width", width).attr("height", height);

    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then((r) => r.json())
      .then((world: Topology) => drawGlobe(svg, world, width, height))
      .catch(console.error);
  }, [drawGlobe]);

  // ── Reactive: update fills + event handlers when violations change ─────────
  useEffect(() => {
    if (!svgRef.current || !loaded) return;
    const svg      = d3.select(svgRef.current);
    const affected = affectedCountries;
    const withData = Object.keys(affected).length > 0;

    svg.selectAll<SVGPathElement, { id: string | number }>(".country")
      .attr("fill", (d) => {
        const id = String(d.id).padStart(3, "0");
        if (withData) {
          return affected[id] ? SEVERITY_COLOR[affected[id].severity] : LAND_DEFAULT;
        }
        return STATIC_VIOLATIONS[id] ? SEVERITY_COLOR[STATIC_VIOLATIONS[id].severity] : LAND_DEFAULT;
      })
      .attr("cursor", (d) => {
        const id = String(d.id).padStart(3, "0");
        const clickable = withData ? !!affected[id] : !!STATIC_VIOLATIONS[id];
        return clickable ? "pointer" : "default";
      })
      .on("mousemove", function (event, d) {
        const id = String(d.id).padStart(3, "0");
        if (!wrapperRef.current) return;
        const rect = wrapperRef.current.getBoundingClientRect();

        if (withData) {
          if (!affected[id]) return;
          const a = affected[id];
          setTooltip({
            visible: true,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            content: {
              name: a.name,
              severity: a.severity,
              info: `${a.violations.length} violation${a.violations.length !== 1 ? "s" : ""} apply · click for details`,
            },
          });
        } else {
          const sv = STATIC_VIOLATIONS[id];
          if (!sv) return;
          setTooltip({
            visible: true,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            content: { name: sv.name, severity: sv.severity, info: `${sv.count} reported violations` },
          });
        }
        d3.select(this).attr("opacity", 0.75);
      })
      .on("mouseleave", function () {
        setTooltip((t) => ({ ...t, visible: false }));
        d3.select(this).attr("opacity", 1);
      })
      .on("click", (_event, d) => {
        const id = String(d.id).padStart(3, "0");
        if (withData && affected[id]) {
          setSelectedCountry(affected[id]);
          selectedCountryRef.current = affected[id];
        } else if (!withData && STATIC_VIOLATIONS[id]) {
          const sv = STATIC_VIOLATIONS[id];
          const fake: AffectedCountry = {
            code: id,
            name: sv.name,
            severity: sv.severity,
            violations: sv.types.map((t) => ({
              type: t,
              severity: sv.severity,
              evidence: "",
              regulatory_basis: sv.name,
            })),
          };
          setSelectedCountry(fake);
          selectedCountryRef.current = fake;
        }
      });

    // Clear selected country if it's no longer in the affected set
    if (
      withData &&
      selectedCountryRef.current &&
      !affected[selectedCountryRef.current.code]
    ) {
      setSelectedCountry(null);
      selectedCountryRef.current = null;
    }
  }, [affectedCountries, loaded]);

  // ── Legend ────────────────────────────────────────────────────────────────
  const legend = [
    { label: "Critical",  color: SEVERITY_COLOR.critical },
    { label: "High",      color: SEVERITY_COLOR.high },
    { label: "Medium",    color: SEVERITY_COLOR.medium },
    { label: "Low",       color: SEVERITY_COLOR.low },
    { label: "No data",   color: LAND_DEFAULT },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
    >
      {/* Header */}
      <div
        className="px-6 pt-5 pb-4 border-b"
        style={{ borderColor: "rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-white flex-1">
            {hasAnalysis ? "Jurisdiction Impact Map" : "Global Regulatory Jurisdiction Map"}
          </h3>
          {hasAnalysis && (
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                backgroundColor: "rgba(239,68,68,0.15)",
                color: "#f87171",
                border: "1px solid rgba(239,68,68,0.30)",
                animation: "glowPulse 2s ease-in-out infinite",
              }}
            >
              {violations.length} violation{violations.length !== 1 ? "s" : ""} mapped
            </span>
          )}
        </div>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
          {hasAnalysis
            ? "Countries highlighted by severity · Click a country to see which violations apply"
            : "Drag to rotate · Hover a country for details · Run analysis to see real-time jurisdiction impact"}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-0">
        {/* Globe canvas */}
        <div ref={wrapperRef} className="relative flex-1" style={{ minHeight: "480px" }}>
          <svg ref={svgRef} className="w-full h-full" style={{ display: "block" }} />

          {/* Skeleton */}
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-48 h-48 rounded-full border-4 animate-pulse"
                  style={{
                    borderColor: "rgba(255,255,255,0.10)",
                    backgroundColor: "rgba(255,255,255,0.04)",
                  }}
                />
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.30)" }}>
                  Loading globe…
                </span>
              </div>
            </div>
          )}

          {/* "Run analysis" hint when idle */}
          {loaded && !hasAnalysis && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
              <div
                className="flex items-center gap-2 text-xs px-4 py-2 rounded-full"
                style={{
                  backgroundColor: "rgba(0,0,0,0.60)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.40)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 inline-block" />
                Run compliance check to map jurisdiction impact
              </div>
            </div>
          )}

          {/* Hover tooltip */}
          {tooltip.visible && tooltip.content && (
            <div
              className="pointer-events-none absolute z-30 rounded-lg px-4 py-3 shadow-2xl border"
              style={{
                left: tooltip.x + 14,
                top: tooltip.y - 10,
                backgroundColor: "#0f172a",
                borderColor: "rgba(255,255,255,0.12)",
                maxWidth: 240,
                transform:
                  tooltip.x > (wrapperRef.current?.clientWidth ?? 600) * 0.65
                    ? "translateX(-110%)"
                    : "none",
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: SEVERITY_COLOR[tooltip.content.severity] }}
                />
                <span className="font-semibold text-white text-sm">{tooltip.content.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: `${SEVERITY_COLOR[tooltip.content.severity]}22`,
                    color: SEVERITY_COLOR[tooltip.content.severity],
                    border: `1px solid ${SEVERITY_COLOR[tooltip.content.severity]}44`,
                  }}
                >
                  {tooltip.content.severity.toUpperCase()}
                </span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {tooltip.content.info}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Side panel ─────────────────────────────────────────────────── */}
        <div
          className="lg:w-72 flex-shrink-0 p-5 border-t lg:border-t-0 lg:border-l"
          style={{ borderColor: "rgba(255,255,255,0.07)" }}
        >
          {selectedCountry ? (
            /* Country detail view */
            <div>
              <button
                onClick={() => setSelectedCountry(null)}
                className="flex items-center gap-1.5 text-xs mb-4 transition-colors"
                style={{ color: "rgba(255,255,255,0.35)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.70)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
              >
                ← Back to map
              </button>

              <div className="flex items-center gap-2 mb-4">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: SEVERITY_COLOR[selectedCountry.severity] || "#4b5563" }}
                />
                <span className="font-semibold text-white text-sm flex-1">
                  {selectedCountry.name}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: `${SEVERITY_COLOR[selectedCountry.severity] || "#4b5563"}22`,
                    color: SEVERITY_COLOR[selectedCountry.severity] || "#9ca3af",
                    border: `1px solid ${SEVERITY_COLOR[selectedCountry.severity] || "#4b5563"}44`,
                  }}
                >
                  {selectedCountry.severity.toUpperCase()}
                </span>
              </div>

              <p
                className="text-xs uppercase tracking-widest mb-3"
                style={{ color: "rgba(255,255,255,0.30)" }}
              >
                {hasAnalysis ? "Violations that apply here" : "Known violation types"}
              </p>

              <div className="space-y-3 overflow-y-auto" style={{ maxHeight: "320px" }}>
                {selectedCountry.violations.map((v, i) => (
                  <div
                    key={i}
                    className="rounded-lg p-3"
                    style={{
                      backgroundColor: `${SEVERITY_COLOR[v.severity] || "#4b5563"}0d`,
                      border: `1px solid ${SEVERITY_COLOR[v.severity] || "#4b5563"}2a`,
                    }}
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0"
                        style={{ backgroundColor: SEVERITY_COLOR[v.severity] || "#4b5563" }}
                      />
                      <span
                        className="text-xs font-semibold leading-snug"
                        style={{ color: "rgba(255,255,255,0.85)" }}
                      >
                        {v.type}
                      </span>
                    </div>
                    {v.evidence && (
                      <p
                        className="text-xs mt-1.5 leading-relaxed pl-3.5 italic"
                        style={{ color: "rgba(255,255,255,0.45)" }}
                      >
                        "{v.evidence.substring(0, 110)}{v.evidence.length > 110 ? "…" : ""}"
                      </p>
                    )}
                    {v.suggested_fix && (
                      <p
                        className="text-xs mt-2 leading-relaxed pl-3.5"
                        style={{ color: "rgba(163,230,53,0.70)" }}
                      >
                        💡 {v.suggested_fix.substring(0, 110)}{v.suggested_fix.length > 110 ? "…" : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Default: legend + affected countries / top hotspots */
            <>
              <p
                className="text-xs uppercase tracking-widest mb-3"
                style={{ color: "rgba(255,255,255,0.30)" }}
              >
                Severity Legend
              </p>
              <ul className="space-y-2 mb-6">
                {legend.map((l) => (
                  <li
                    key={l.label}
                    className="flex items-center gap-2.5 text-xs"
                    style={{ color: "rgba(255,255,255,0.65)" }}
                  >
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: l.color }}
                    />
                    {l.label}
                  </li>
                ))}
              </ul>

              {hasAnalysis ? (
                <>
                  <p
                    className="text-xs uppercase tracking-widest mb-3"
                    style={{ color: "rgba(255,255,255,0.30)" }}
                  >
                    Affected Jurisdictions
                  </p>
                  <ul className="space-y-2">
                    {Object.values(affectedCountries)
                      .sort(
                        (a, b) =>
                          (SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0),
                      )
                      .map((c) => (
                        <li key={c.code}>
                          <button
                            onClick={() => setSelectedCountry(c)}
                            className="w-full flex items-center justify-between gap-2 text-left text-xs rounded-lg px-3 py-2.5 transition-colors"
                            style={{
                              backgroundColor: "rgba(255,255,255,0.03)",
                              border: "1px solid rgba(255,255,255,0.06)",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.07)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)")
                            }
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: SEVERITY_COLOR[c.severity] }}
                              />
                              <span style={{ color: "rgba(255,255,255,0.75)" }}>{c.name}</span>
                            </div>
                            <span
                              className="font-semibold tabular-nums"
                              style={{ color: SEVERITY_COLOR[c.severity] }}
                            >
                              {c.violations.length}
                            </span>
                          </button>
                        </li>
                      ))}
                  </ul>
                </>
              ) : (
                <>
                  <p
                    className="text-xs uppercase tracking-widest mb-3"
                    style={{ color: "rgba(255,255,255,0.30)" }}
                  >
                    Global Hotspots
                  </p>
                  <ul className="space-y-2">
                    {Object.values(STATIC_VIOLATIONS)
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 8)
                      .map((v) => (
                        <li key={v.name} className="flex items-center justify-between gap-2">
                          <span
                            className="text-xs truncate"
                            style={{ color: "rgba(255,255,255,0.60)" }}
                          >
                            {v.name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <div
                              className="h-1.5 rounded-full"
                              style={{
                                width: `${Math.round((v.count / 47) * 44)}px`,
                                backgroundColor: SEVERITY_COLOR[v.severity],
                                opacity: 0.7,
                              }}
                            />
                            <span
                              className="text-xs font-medium tabular-nums"
                              style={{ color: SEVERITY_COLOR[v.severity] }}
                            >
                              {v.count}
                            </span>
                          </div>
                        </li>
                      ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
