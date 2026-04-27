import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface LoadingScreenProps {
  onComplete: () => void;
}

// Pharma-domain rotating words
const WORDS = ["Analyze", "Detect", "Comply"];
const DURATION_MS = 2700;
const WORD_INTERVAL_MS = 900;

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);

  // Keep ref in sync so the RAF closure never captures a stale onComplete
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Counter: 000 → 100 over DURATION_MS using requestAnimationFrame
  useEffect(() => {
    let rafId: number;
    let startTime: number | null = null;

    const tick = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const pct = Math.min((elapsed / DURATION_MS) * 100, 100);
      setProgress(pct);

      if (pct < 100) {
        rafId = requestAnimationFrame(tick);
      } else {
        // Counter hit 100 — wait 400ms then fire onComplete
        if (!completedRef.current) {
          completedRef.current = true;
          setTimeout(() => onCompleteRef.current(), 400);
        }
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Rotating words: cycle every WORD_INTERVAL_MS, stop at last word
  useEffect(() => {
    if (wordIndex >= WORDS.length - 1) return;
    const id = setInterval(() => {
      setWordIndex((prev) => {
        const next = prev + 1;
        if (next >= WORDS.length - 1) clearInterval(id);
        return next;
      });
    }, WORD_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      key="loading-screen"
      className="fixed inset-0 z-[9999] overflow-hidden"
      style={{ backgroundColor: "var(--bg)" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* ── Top-left label ── */}
      <motion.div
        className="absolute top-8 left-8 md:top-12 md:left-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <span
          className="text-xs md:text-sm uppercase tracking-[0.3em]"
          style={{ color: "var(--muted-loader)" }}
        >
          PharmaCheck
        </span>
      </motion.div>

      {/* ── Center rotating word ── */}
      <div className="absolute inset-0 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={wordIndex}
            className="font-display italic"
            style={{
              fontSize: "clamp(2.5rem, 8vw, 5rem)",
              color: "rgba(245,245,245,0.80)",
              fontFamily: "'Instrument Serif', serif",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            {WORDS[wordIndex]}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* ── Bottom-right counter ── */}
      <motion.div
        className="absolute bottom-8 right-8 md:bottom-12 md:right-12 tabular-nums"
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: "clamp(4rem, 12vw, 8rem)",
          color: "var(--text)",
          lineHeight: 1,
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        {Math.round(progress).toString().padStart(3, "0")}
      </motion.div>

      {/* ── Bottom progress bar ── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[3px]"
        style={{ backgroundColor: "rgba(31,31,31,0.5)" }}
      >
        <motion.div
          className="h-full origin-left"
          style={{
            background: "linear-gradient(90deg, #89AACC 0%, #4E85BF 100%)",
            boxShadow: "0 0 8px rgba(137, 170, 204, 0.35)",
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: progress / 100 }}
          transition={{ duration: 0.1, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}
