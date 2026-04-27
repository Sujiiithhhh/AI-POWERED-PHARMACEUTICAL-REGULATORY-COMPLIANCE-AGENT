import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import * as pdfjsLib from "pdfjs-dist";
import GlobeMap from "./GlobeMap";
import StreamingProgress from "./StreamingProgress";
import { useComplianceStream } from "../hooks/useComplianceStream";
import { useAuth } from "../contexts/AuthContext";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Violation {
  type: string;
  severity: string;
  evidence: string;
  rule_id: string;
  regulatory_basis: string;
  explanation: string;
  suggested_fix: string;
}
interface Regulation { source: string; text: string; }
interface ComplianceResult {
  compliance_status: string;
  violations: Violation[];
  retrieved_regulations: Regulation[];
  score?: number;
}

// ── PDF extraction ────────────────────────────────────────────────────────────
async function extractPDFText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += (content.items as Array<{ str: string }>).map((item) => item.str).join(" ") + "\n";
  }
  return text.trim();
}

// ── Severity config ───────────────────────────────────────────────────────────
const SEV: Record<string, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.07)",  border: "rgba(239,68,68,0.25)",  label: "Critical" },
  high:     { color: "#f97316", bg: "rgba(249,115,22,0.07)", border: "rgba(249,115,22,0.25)", label: "High" },
  medium:   { color: "#f59e0b", bg: "rgba(245,158,11,0.07)", border: "rgba(245,158,11,0.25)", label: "Medium" },
  low:      { color: "#22c55e", bg: "rgba(34,197,94,0.07)",  border: "rgba(34,197,94,0.25)",  label: "Low" },
};

const STATUS_META = (status: string) => {
  const s = status?.toLowerCase() ?? "";
  if (s === "pass")         return { label: "COMPLIANT",    color: "#16a34a", bg: "#f0fdf4", border: "#86efac", icon: "✓" };
  if (s === "fail")         return { label: "NON-COMPLIANT", color: "#dc2626", bg: "#fef2f2", border: "#fca5a5", icon: "✗" };
  return                           { label: "NEEDS REVIEW", color: "#d97706", bg: "#fffbeb", border: "#fcd34d", icon: "!" };
};

const SCORE_COLOR = (s: number) =>
  s >= 80 ? "#16a34a" : s >= 60 ? "#d97706" : s >= 40 ? "#f97316" : "#dc2626";

// ── Score ring SVG ────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 36; const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(score, 100));
  const color = SCORE_COLOR(pct);
  return (
    <div className="relative flex items-center justify-center" style={{ width: 88, height: 88 }}>
      <svg width="88" height="88" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="7" />
        <circle cx="44" cy="44" r={r} fill="none"
          stroke={color} strokeWidth="7"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-black tabular-nums leading-none" style={{ color }}>{pct}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: "#9ca3af" }}>score</span>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CheckerPage() {
  const navigate   = useNavigate();
  const fileRef    = useRef<HTMLInputElement>(null);
  const auth       = useAuth();
  const stream     = useComplianceStream();

  const [reportText, setReportText] = useState("");
  const [pdfFile,    setPdfFile]    = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing,  setIsParsing]  = useState(false);
  const [error,      setError]      = useState("");

  // ── PDF ────────────────────────────────────────────────────────────────────
  const handleFile = async (file: File) => {
    if (file.type !== "application/pdf") { setError("Only PDF files are supported."); return; }
    setPdfFile(file); setError(""); setIsParsing(true);
    try { setReportText(await extractPDFText(file)); }
    catch { setError("Could not extract text from PDF. Try pasting manually."); }
    finally { setIsParsing(false); }
  };

  // ── Run ────────────────────────────────────────────────────────────────────
  const handleRun = () => {
    const text = reportText.trim();
    if (!text) { setError("Please paste a report or drop a PDF."); return; }
    setError("");
    stream.startStream(text, auth?.accessToken);
  };

  const displayResult = stream.result as ComplianceResult | null;
  const isBusy        = stream.isStreaming || isParsing;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen font-barlow" style={{ backgroundColor: "#f4f1ec", color: "#0f0f0f" }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-8 lg:px-16 py-4"
        style={{
          backgroundColor: "rgba(244,241,236,0.85)",
          borderBottom: "1px solid rgba(0,0,0,0.07)",
          backdropFilter: "blur(12px)",
        }}
      >
        <span
          className="font-bold text-lg tracking-tight cursor-pointer select-none"
          style={{ color: "#0f0f0f" }}
          onClick={() => navigate("/")}
        >
          PHARMACHECK
        </span>
        <div className="hidden md:flex items-center gap-8">
          {[
            { label: "Home",         path: "/",             active: false },
            { label: "Check",        path: "/check",        active: true  },
            { label: "How it Works", path: "/how-it-works", active: false },
          ].map(({ label, path, active }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className="text-sm transition-colors"
              style={{ color: active ? "#111827" : "#9ca3af" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#111827")}
              onMouseLeave={(e) => (e.currentTarget.style.color = active ? "#111827" : "#9ca3af")}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="pt-14 pb-10 px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5"
          style={{ backgroundColor: "rgba(0,0,0,0.06)", color: "#555", border: "1px solid rgba(0,0,0,0.08)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" style={{ animation: "glowPulse 2s ease-in-out infinite" }} />
          Powered by Gemini · RAG · Rule Engine
        </div>
        <h1 className="text-4xl lg:text-5xl font-black tracking-tight mb-3 leading-tight" style={{ color: "#0f0f0f" }}>
          Compliance Intelligence,<br />
          <span style={{ color: "#374151" }}>Instantly.</span>
        </h1>
        <p className="text-base max-w-xl mx-auto" style={{ color: "#6b7280" }}>
          Drop a pharmaceutical report and get AI-powered regulatory analysis across FDA · EMA · HIPAA · ICH E2D · CDSCO.
        </p>
      </div>

      {/* ── Input card (dark, centered) ──────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-6 mb-8">
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: "#0c0f14",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.15)",
          }}
        >
          {/* Drop zone — drag-and-drop only; click is handled by Upload PDF button */}
          <div
            className="transition-colors px-5 pt-5"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

            {/* Textarea */}
            <textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              rows={8}
              placeholder="Paste a pharmaceutical report, promotional copy, or adverse event narrative here…"
              className="w-full resize-none text-sm leading-relaxed outline-none"
              style={{
                backgroundColor: "transparent",
                color: "#e5e7eb",
                caretColor: "#fff",
                fontFamily: "'Barlow', sans-serif",
                border: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.color = "#f9fafb")}
              onBlur={(e) => (e.currentTarget.style.color = "#e5e7eb")}
            />

            {/* PDF indicator */}
            {(pdfFile || isParsing) && (
              <div className="flex items-center gap-2 mt-1 mb-2 px-1">
                {isParsing ? (
                  <span className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>
                    <span className="animate-spin w-3 h-3 border border-white/30 border-t-white/80 rounded-full inline-block" />
                    Extracting text…
                  </span>
                ) : pdfFile && (
                  <>
                    <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "#60a5fa" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                    <span className="text-xs font-medium" style={{ color: "#60a5fa" }}>{pdfFile.name}</span>
                    <button
                      className="text-xs ml-auto transition-colors"
                      style={{ color: "rgba(255,255,255,0.30)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.60)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.30)")}
                      onClick={(e) => { e.stopPropagation(); setPdfFile(null); setReportText(""); }}
                    >
                      × remove
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {(error || stream.error) && (
            <div className="mx-5 mb-3 px-3 py-2.5 rounded-lg text-xs"
              style={{ backgroundColor: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
              {error || stream.error}
            </div>
          )}

          {/* Bottom bar */}
          <div className="flex items-center gap-3 px-4 py-3.5"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            {/* Upload chip */}
            <button
              onClick={() => fileRef.current?.click()}
              className="liquid-glass flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full text-white/60 transition-transform hover:scale-[1.03]"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              Upload PDF
            </button>

            <div className="flex-1" />

            {/* Streaming badge */}
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
              ⚡ Real-time
            </span>

            {/* Run button */}
            {stream.isStreaming ? (
              <button
                onClick={stream.stopStream}
                className="liquid-glass flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full text-red-300 transition-transform hover:scale-[1.03]"
              >
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse inline-block" />
                Stop
              </button>
            ) : (
              <button
                onClick={handleRun}
                disabled={isBusy}
                className="liquid-glass flex items-center gap-2 font-semibold text-sm px-5 py-2.5 rounded-full text-white transition-transform hover:scale-[1.03] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isParsing ? (
                  <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white/80 rounded-full animate-spin inline-block" />Parsing…</>
                ) : (
                  <>
                    Run Analysis
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Streaming progress ────────────────────────────────────────────── */}
      <AnimatePresence>
        {(stream.isStreaming || stream.stages.some((s) => s.status === "done")) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-2xl mx-auto px-6 mb-6"
          >
            <StreamingProgress
              stages={stream.stages}
              progress={stream.progress}
              currentStage={stream.currentStage}
              isStreaming={stream.isStreaming}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Results ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {displayResult && (() => {
          const res = displayResult;
          const sm  = STATUS_META(res.compliance_status);
          const vCount = res.violations?.length ?? 0;
          const score  = (res as any).score as number | undefined;
          return (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-2xl mx-auto px-6 mb-8"
            >
              {/* Status + Score banner */}
              <div
                className="rounded-2xl p-5 mb-5 flex items-center gap-5"
                style={{ backgroundColor: sm.bg, border: `1px solid ${sm.border}` }}
              >
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black flex-shrink-0"
                  style={{ backgroundColor: sm.color + "18", color: sm.color, border: `1.5px solid ${sm.color}40` }}
                >
                  {sm.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-black leading-none mb-1" style={{ color: sm.color }}>
                    {sm.label}
                  </p>
                  <p className="text-sm" style={{ color: "#6b7280" }}>
                    {vCount === 0
                      ? "No violations detected — report appears compliant."
                      : `${vCount} violation${vCount !== 1 ? "s" : ""} detected across regulatory frameworks.`}
                  </p>
                </div>
                {score !== undefined && <ScoreRing score={score} />}
              </div>

              {/* Violations */}
              {vCount > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest px-1" style={{ color: "#9ca3af" }}>
                    {vCount} Violation{vCount !== 1 ? "s" : ""} Detected
                  </p>
                  {res.violations.map((v, i) => {
                    const cfg = SEV[v.severity?.toLowerCase()] ?? SEV.low;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="rounded-2xl overflow-hidden"
                        style={{
                          backgroundColor: "#fff",
                          border: `1px solid ${cfg.border}`,
                          borderLeftWidth: "4px",
                          borderLeftColor: cfg.color,
                          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                        }}
                      >
                        {/* Card header */}
                        <div className="flex items-center gap-3 px-5 py-4">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cfg.color, boxShadow: `0 0 6px ${cfg.color}80` }}
                          />
                          <p className="text-sm font-semibold flex-1 leading-snug" style={{ color: "#111827" }}>
                            {v.type}
                          </p>
                          <span
                            className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide flex-shrink-0"
                            style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                          >
                            {cfg.label}
                          </span>
                        </div>

                        <div className="px-5 pb-5 space-y-3">
                          {/* Evidence */}
                          {v.evidence && (
                            <div
                              className="rounded-xl px-4 py-3"
                              style={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb" }}
                            >
                              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#9ca3af" }}>
                                Evidence
                              </p>
                              <p className="text-xs leading-relaxed font-mono" style={{ color: "#374151" }}>
                                "{v.evidence}"
                              </p>
                            </div>
                          )}

                          {/* Explanation */}
                          {v.explanation && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#9ca3af" }}>
                                Why This Matters
                              </p>
                              <p className="text-sm leading-relaxed" style={{ color: "#374151" }}>
                                {v.explanation}
                              </p>
                            </div>
                          )}

                          {/* Regulatory source */}
                          {v.regulatory_basis && (
                            <p className="text-xs font-mono" style={{ color: "#9ca3af" }}>
                              Source · {v.regulatory_basis}
                            </p>
                          )}

                          {/* Suggested fix */}
                          {v.suggested_fix && (
                            <div
                              className="rounded-xl px-4 py-3"
                              style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac" }}
                            >
                              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#16a34a" }}>
                                💡 Suggested Fix
                              </p>
                              <p className="text-xs leading-relaxed" style={{ color: "#166534" }}>
                                {v.suggested_fix}
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {vCount === 0 && (
                <div className="rounded-2xl px-6 py-10 text-center"
                  style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}>
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">✓</span>
                  </div>
                  <p className="font-semibold text-sm" style={{ color: "#111827" }}>No violations found</p>
                  <p className="text-xs mt-1" style={{ color: "#6b7280" }}>The report appears to be within regulatory guidelines.</p>
                </div>
              )}
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── Globe — dark section ─────────────────────────────────────────── */}
      <div style={{ backgroundColor: "#0c0f14" }}>
        {/* Gradient fade from cream to dark */}
        <div style={{ height: 60, background: "linear-gradient(to bottom, #f4f1ec, #0c0f14)" }} />
        <div className="max-w-5xl mx-auto px-6 pb-16">
          <GlobeMap
            violations={displayResult?.violations ?? []}
            analysisComplete={!!displayResult}
          />
        </div>
      </div>
    </div>
  );
}
