import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4";

const NAVY  = "hsl(201 100% 13%)";
const MUTED = "rgba(255,255,255,0.50)";

// ── Pipeline steps ────────────────────────────────────────────────────────────
const STEPS = [
  {
    number: "01",
    title:  "Submit your report",
    tag:    "Input",
    tagColor: "#6366f1",
    body:   "Paste any pharmaceutical text — promotional copy, adverse event narrative, clinical summary — or drop a PDF. Text is extracted and normalised before analysis begins.",
    aside:  "Supports plain text & PDF",
  },
  {
    number: "02",
    title:  "Deterministic rule engine",
    tag:    "Rules",
    tagColor: "#0891b2",
    body:   "Before any AI is involved, a hand-crafted rule set scans for off-label promotion, unsubstantiated comparative claims, missing adverse-event context, and PHI/PII. Every flag is reproducible and auditable.",
    aside:  "No ML — fully deterministic",
  },
  {
    number: "03",
    title:  "Regulatory clause retrieval",
    tag:    "RAG",
    tagColor: "#7c3aed",
    body:   "For each flagged issue, ChromaDB queries a vector index built from official FDA, EMA, HIPAA, ICH E2D and CDSCO source documents — returning the exact clauses that apply.",
    aside:  "Grounded in primary sources",
  },
  {
    number: "04",
    title:  "Gemini AI explanation",
    tag:    "AI",
    tagColor: "#db2777",
    body:   "Gemini 1.5 Flash receives the violation, the evidence, and the retrieved clauses. It explains precisely why the content is problematic and proposes a concrete rewrite — never inventing regulations.",
    aside:  "Explanation only — no decisions",
  },
  {
    number: "05",
    title:  "Score & jurisdiction map",
    tag:    "Output",
    tagColor: "#059669",
    body:   "A penalty-weighted compliance score (0–100) is computed. The 3-D globe highlights every jurisdiction affected by your violations. Click any country to see which specific rules apply there.",
    aside:  "FDA · EMA · HIPAA · ICH · CDSCO",
  },
];

// ── Nav link ──────────────────────────────────────────────────────────────────
function NavLink({
  label, active = false, onClick,
}: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-sm transition-colors"
      style={{ color: active ? "#fff" : MUTED }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
      onMouseLeave={(e) => (e.currentTarget.style.color = active ? "#fff" : MUTED)}
    >
      {label}
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function HowItWorks() {
  const navigate = useNavigate();

  return (
    <div style={{ fontFamily: "'Inter', 'Barlow', sans-serif" }}>

      {/* ══ HERO ══════════════════════════════════════════════════════════ */}
      <div className="relative min-h-screen w-full overflow-hidden" style={{ backgroundColor: NAVY }}>
        <video autoPlay loop muted playsInline
          className="absolute inset-0 w-full h-full object-cover" style={{ zIndex: 0 }}
          src={VIDEO_URL} />

        {/* Nav */}
        <nav className="relative flex items-center justify-between px-8 py-6 max-w-7xl mx-auto" style={{ zIndex: 10 }}>
          <span className="text-3xl tracking-tight cursor-pointer select-none text-white"
            style={{ fontFamily: "'Instrument Serif', serif" }} onClick={() => navigate("/")}>
            PHARMACHECK
          </span>
          <div className="hidden md:flex items-center gap-8">
            <NavLink label="Home"         onClick={() => navigate("/")} />
            <NavLink label="Check"        onClick={() => navigate("/check")} />
            <NavLink label="How it Works" active />
          </div>
        </nav>

        {/* Hero copy */}
        <div className="relative flex flex-col items-center justify-center text-center px-6"
          style={{ zIndex: 10, paddingTop: "90px", paddingBottom: "140px" }}>
          <h1 className="animate-fade-rise text-white font-normal leading-[0.95] max-w-5xl"
            style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(2.8rem, 7vw, 5.5rem)", letterSpacing: "-2px" }}>
            The platform that keeps your{" "}
            <em className="not-italic" style={{ color: MUTED }}>reports &amp; submissions compliant</em>
          </h1>
          <p className="animate-fade-rise-delay text-base sm:text-lg max-w-2xl mt-8 leading-relaxed" style={{ color: MUTED }}>
            Five tightly coupled stages — deterministic rules, vector retrieval, and Gemini AI —
            so every violation is caught, explained, and fixed before it reaches a regulator.
          </p>
          <button onClick={() => navigate("/check")}
            className="animate-fade-rise-delay-2 liquid-glass rounded-full px-14 py-5 text-base text-white mt-12 transition-transform hover:scale-[1.03] cursor-pointer">
            Check Compliance →
          </button>
          <div className="animate-fade-rise-delay-3 mt-20 flex flex-col items-center gap-2" style={{ color: "rgba(255,255,255,0.25)" }}>
            <span className="text-xs tracking-widest uppercase">How it works</span>
            <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* ══ PIPELINE — editorial timeline ════════════════════════════════ */}
      <div style={{ backgroundColor: "#f4f1ec" }}>
        <div className="max-w-3xl mx-auto px-6 py-24">

          {/* Section heading */}
          <div className="mb-20">
            <p className="text-xs font-bold uppercase tracking-[0.22em] mb-3" style={{ color: "#9ca3af" }}>
              The Pipeline
            </p>
            <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(2rem, 4vw, 3rem)", color: "#0f0f0f", lineHeight: 1.05, letterSpacing: "-1px" }}>
              Five stages. Zero guesswork.
            </h2>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Vertical connecting line */}
            <div className="absolute left-[22px] top-6 bottom-6 w-px" style={{ backgroundColor: "rgba(0,0,0,0.10)" }} />

            <div className="space-y-0">
              {STEPS.map((step, i) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ delay: i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="relative flex gap-8 pb-14 last:pb-0"
                >
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center flex-shrink-0 pt-1" style={{ width: 44 }}>
                    <div className="w-[11px] h-[11px] rounded-full z-10"
                      style={{ backgroundColor: step.tagColor, outline: `2px solid ${step.tagColor}`, outlineOffset: "2px" }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0">
                    {/* Number + tag row */}
                    <div className="flex items-center gap-3 mb-3">
                      <span style={{
                        fontFamily: "'Instrument Serif', serif",
                        fontSize: "clamp(3rem, 6vw, 4.5rem)",
                        color: "rgba(0,0,0,0.06)",
                        lineHeight: 1,
                        fontStyle: "italic",
                        userSelect: "none",
                      }}>
                        {step.number}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: step.tagColor + "14", color: step.tagColor, border: `1px solid ${step.tagColor}30` }}>
                        {step.tag}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-black mb-3 leading-tight"
                      style={{ fontSize: "clamp(1.15rem, 2vw, 1.35rem)", color: "#111827", letterSpacing: "-0.3px" }}>
                      {step.title}
                    </h3>

                    {/* Body */}
                    <p className="text-sm leading-[1.75]" style={{ color: "#4b5563", maxWidth: "52ch" }}>
                      {step.body}
                    </p>

                    {/* Aside note */}
                    <p className="mt-3 text-xs font-semibold" style={{ color: step.tagColor }}>
                      → {step.aside}
                    </p>

                    {/* Divider — not on last step */}
                    {i < STEPS.length - 1 && (
                      <div className="mt-10 h-px" style={{ backgroundColor: "rgba(0,0,0,0.07)" }} />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══ FRAMEWORKS + CTA — dark ═══════════════════════════════════════ */}
      <div style={{ backgroundColor: "#0c0f14" }}>
        <div style={{ height: 60, background: "linear-gradient(to bottom, #f4f1ec, #0c0f14)" }} />

        <div className="max-w-3xl mx-auto px-6 pb-24">

          {/* Frameworks — horizontal pill row */}
          <p className="text-xs font-bold uppercase tracking-[0.22em] mb-8 text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
            Regulatory frameworks covered
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-20">
            {[
              { name: "FDA",     sub: "21 CFR Part 202",  color: "#ef4444" },
              { name: "EMA",     sub: "GVP Module VI",    color: "#3b82f6" },
              { name: "HIPAA",   sub: "PHI · PII",        color: "#a855f7" },
              { name: "ICH E2D", sub: "Post-approval",    color: "#06b6d4" },
              { name: "CDSCO",   sub: "India AE",         color: "#f59e0b" },
            ].map((f) => (
              <div key={f.name}
                className="flex items-center gap-3 rounded-full px-5 py-3"
                style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: f.color }} />
                <span className="text-sm font-bold text-white">{f.name}</span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{f.sub}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center">
            <h3 className="text-2xl font-black text-white mb-3"
              style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>
              Ready to check your report?
            </h3>
            <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.38)" }}>
              Results in under 30 seconds.
            </p>
            <button onClick={() => navigate("/check")}
              className="liquid-glass inline-flex items-center gap-2 font-bold text-sm px-10 py-4 rounded-full text-white transition-transform hover:scale-[1.03]">
              Run Compliance Analysis
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
