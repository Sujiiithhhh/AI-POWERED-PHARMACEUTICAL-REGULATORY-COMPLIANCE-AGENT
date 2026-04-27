/**
 * useComplianceStream
 * -------------------
 * Reads POST /api/stream as a server-sent events (SSE) stream via the
 * Fetch API ReadableStream. Works with any modern browser — no EventSource
 * (which only supports GET requests).
 *
 * Returns:
 *   startStream(reportText)  — kick off the streaming check
 *   steps                    — array of { step, message, progress, detail? }
 *   currentStep              — latest step object
 *   isStreaming              — true while pipeline is running
 *   result                   — final compliance result (set on 'complete' event)
 *   error                    — string error message or null
 *   reset                    — clear all state
 */

import { useState, useRef, useCallback } from 'react'

export default function useComplianceStream() {
  const [steps,       setSteps]       = useState([])
  const [currentStep, setCurrentStep] = useState(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [result,      setResult]      = useState(null)
  const [error,       setError]       = useState(null)
  const abortRef = useRef(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setSteps([])
    setCurrentStep(null)
    setIsStreaming(false)
    setResult(null)
    setError(null)
  }, [])

  const startStream = useCallback(async (reportText) => {
    // Cancel any previous stream
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSteps([])
    setCurrentStep(null)
    setResult(null)
    setError(null)
    setIsStreaming(true)

    try {
      const response = await fetch('/api/stream', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ report_text: reportText }),
        signal:  controller.signal,
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({ detail: response.statusText }))
        throw new Error(body.detail || `HTTP ${response.status}`)
      }

      // Parse the SSE stream via ReadableStream
      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      let gotComplete = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE events are separated by double newlines
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''   // last chunk may be incomplete

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue

          let event
          try {
            event = JSON.parse(line.slice('data:'.length).trim())
          } catch {
            continue
          }

          const stepObj = {
            step:     event.step,
            message:  event.message,
            progress: event.progress ?? 0,
            detail:   event.detail ?? null,
          }

          if (event.step === 'error') {
            setError(event.message || 'Pipeline error — check the backend logs.')
            setIsStreaming(false)
            return
          }

          setCurrentStep(stepObj)
          setSteps((prev) => {
            // Merge updates to the same step (e.g. explaining 1/3, 2/3, 3/3)
            const last = prev[prev.length - 1]
            if (last?.step === stepObj.step) {
              return [...prev.slice(0, -1), stepObj]
            }
            return [...prev, stepObj]
          })

          if (event.step === 'complete') {
            gotComplete = true
            setResult(event.result)
            setIsStreaming(false)
            return
          }
        }
      }

      // Stream closed by server without a 'complete' event
      if (!gotComplete) {
        setError('The analysis stream ended unexpectedly. Make sure the backend is running and try again.')
        setIsStreaming(false)
      }
    } catch (err) {
      if (err.name === 'AbortError') return   // user cancelled — silent
      const msg = err.message && !err.message.includes('fetch')
        ? err.message
        : 'Cannot reach the backend. Start the server with: uvicorn backend.main:app --reload --port 8000'
      setError(msg)
      setIsStreaming(false)
    }
  }, [])

  return { startStream, steps, currentStep, isStreaming, result, error, reset }
}
