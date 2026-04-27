/**
 * useComplianceStream — SSE streaming hook for real-time compliance pipeline
 * ==========================================================================
 * Uses fetch + ReadableStream (POST /api/stream) instead of EventSource,
 * because EventSource only supports GET requests.
 *
 * Backend SSE event shape:
 *   { step, message, progress, detail?, result?, error? }
 */

import { useCallback, useRef, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StreamStage {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
  detail?: string;
  progress?: number;
}

export interface StreamState {
  stages: StreamStage[];
  currentStage: string;
  progress: number;
  result: Record<string, unknown> | null;
  error: string | null;
  isStreaming: boolean;
}

// ── Default pipeline stages ───────────────────────────────────────────────────

const DEFAULT_STAGES: StreamStage[] = [
  { id: "parsing",    label: "Parsing document",            status: "pending" },
  { id: "rules",      label: "Running rule checks",         status: "pending" },
  { id: "decision",   label: "Computing compliance status", status: "pending" },
  { id: "retrieving", label: "Retrieving regulations",      status: "pending" },
  { id: "explaining", label: "Generating explanations",     status: "pending" },
  { id: "scoring",    label: "Computing ML risk score",     status: "pending" },
  { id: "complete",   label: "Analysis complete",           status: "pending" },
];

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useComplianceStream() {
  const [state, setState] = useState<StreamState>({
    stages: DEFAULT_STAGES,
    currentStage: "",
    progress: 0,
    result: null,
    error: null,
    isStreaming: false,
  });

  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({
      stages: DEFAULT_STAGES.map((s) => ({ ...s, status: "pending" })),
      currentStage: "",
      progress: 0,
      result: null,
      error: null,
      isStreaming: false,
    });
  }, []);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  const startStream = useCallback(
    async (reportText: string, accessToken?: string | null) => {
      // Abort the previous stream using the OLD controller before replacing it
      abortRef.current?.abort();

      // Create a fresh controller — must happen BEFORE any state reset
      // because reset() internally calls abortRef.current?.abort(), which would
      // immediately abort the new controller and silently kill the fetch.
      const controller = new AbortController();
      abortRef.current = controller;

      // Reset UI state inline (do NOT call reset() — it aborts abortRef.current)
      setState({
        stages: DEFAULT_STAGES.map((s) => ({ ...s, status: "pending" })),
        currentStage: "",
        progress: 0,
        result: null,
        error: null,
        isStreaming: true,
      });

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

        const response = await fetch(`${API_BASE}/api/stream`, {
          method: "POST",
          headers,
          body: JSON.stringify({ report_text: reportText }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let detail = response.statusText;
          try {
            const body = await response.json();
            if (body?.detail) detail = String(body.detail);
          } catch {}
          throw new Error(`[${response.status}] ${detail}`);
        }

        // Read the SSE stream via ReadableStream
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let gotComplete = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE events are separated by double newlines
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;

            let event: Record<string, unknown>;
            try {
              event = JSON.parse(line.slice("data:".length).trim());
            } catch {
              continue;
            }

            // Map backend field names → frontend field names
            // Backend sends: { step, message, progress, detail?, result?, error? }
            const stepId  = (event.step   as string | undefined) ?? "";
            const message = (event.message as string | undefined) ?? "";
            const progress = (event.progress as number | undefined) ?? 0;
            const detail  = (event.detail  as string | undefined) ?? message;

            if (stepId === "error" || event.error) {
              const errMsg = (event.error as string) || message || "Pipeline error.";
              setState((prev) => ({ ...prev, isStreaming: false, error: errMsg }));
              return;
            }

            if (stepId === "complete" && event.result) {
              gotComplete = true;
              setState((prev) => ({
                ...prev,
                stages: prev.stages.map((s) => ({ ...s, status: "done" })),
                currentStage: "complete",
                progress: 100,
                result: event.result as Record<string, unknown>,
                isStreaming: false,
              }));
              return;
            }

            // Update stage progress
            setState((prev) => ({
              ...prev,
              currentStage: stepId || prev.currentStage,
              progress,
              stages: prev.stages.map((s) => {
                if (s.id === stepId) return { ...s, status: "active", detail };
                const stageIdx = DEFAULT_STAGES.findIndex((ds) => ds.id === stepId);
                const thisIdx  = DEFAULT_STAGES.findIndex((ds) => ds.id === s.id);
                if (thisIdx < stageIdx) return { ...s, status: "done" };
                return s;
              }),
            }));
          }
        }

        // Stream closed without a complete event
        if (!gotComplete) {
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error:
              "The analysis stream ended unexpectedly. Make sure the backend is running:\n  uvicorn backend.main:app --reload --port 8000",
          }));
        }
      } catch (err: unknown) {
        if ((err as { name?: string }).name === "AbortError") return; // user cancelled
        const msg =
          err instanceof Error ? err.message : String(err);
        const friendly =
          msg.includes("fetch") || msg.includes("NetworkError") || msg.includes("Failed")
            ? "Cannot reach the backend. Make sure FastAPI is running:\n  uvicorn backend.main:app --reload --port 8000"
            : msg;
        setState((prev) => ({ ...prev, isStreaming: false, error: friendly }));
      }
    },
    [reset]
  );

  return { ...state, startStream, stopStream, reset };
}
