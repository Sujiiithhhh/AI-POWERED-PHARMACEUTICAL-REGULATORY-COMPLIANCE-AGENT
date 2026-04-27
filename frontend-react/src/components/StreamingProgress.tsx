/**
 * StreamingProgress — Real-time SSE pipeline progress display
 * Shows 7 stages with animated dots, progress bar, and current detail text.
 */

import { motion, AnimatePresence } from "framer-motion";
import type { StreamStage } from "../hooks/useComplianceStream";

interface Props {
  stages: StreamStage[];
  progress: number;
  currentStage: string;
  isStreaming: boolean;
}

export default function StreamingProgress({ stages, progress, currentStage, isStreaming }: Props) {
  if (!isStreaming && !stages.some((s) => s.status === "done" || s.status === "active")) {
    return null;
  }

  const activeStage = stages.find((s) => s.id === currentStage);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="w-full rounded-2xl p-5 space-y-4"
      style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isStreaming && (
            <span className="w-2 h-2 rounded-full bg-teal-500 inline-block animate-pulse" />
          )}
          <span className="text-sm font-semibold" style={{ color: "#111827" }}>
            {isStreaming ? "Running compliance analysis…" : "Analysis complete"}
          </span>
        </div>
        <span className="text-xs font-mono font-bold tabular-nums" style={{ color: "#6b7280" }}>{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: "#f3f4f6" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(to right, #10b981, #14b8a6)" }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {/* Stages */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-7">
        {stages.map((stage) => (
          <StageChip key={stage.id} stage={stage} />
        ))}
      </div>

      {/* Detail text */}
      <AnimatePresence mode="wait">
        {activeStage?.detail && isStreaming && (
          <motion.p
            key={activeStage.detail}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs text-center"
            style={{ color: "#9ca3af" }}
          >
            {activeStage.detail}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StageChip({ stage }: { stage: StreamStage }) {
  const cfg =
    stage.status === "done"   ? { color: "#16a34a", bg: "#f0fdf4", border: "#86efac", icon: "✓" } :
    stage.status === "active" ? { color: "#0d9488", bg: "#f0fdfa", border: "#5eead4", icon: "·" } :
    stage.status === "error"  ? { color: "#dc2626", bg: "#fef2f2", border: "#fca5a5", icon: "✗" } :
                                { color: "#9ca3af", bg: "#f9fafb", border: "#e5e7eb", icon: "○" };

  return (
    <div
      className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs ${stage.status === "active" ? "animate-pulse" : ""}`}
      style={{ color: cfg.color, backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <span className="shrink-0 font-bold">{cfg.icon}</span>
      <span className="truncate font-medium">{stage.label}</span>
    </div>
  );
}
