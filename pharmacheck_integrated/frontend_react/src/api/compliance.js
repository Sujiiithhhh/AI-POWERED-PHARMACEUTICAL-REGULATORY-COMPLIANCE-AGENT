/**
 * Calls POST /check_compliance on the FastAPI backend.
 * Returns the full compliance result or throws on error.
 */
export async function checkCompliance(reportText) {
  const res = await fetch('/check_compliance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report_text: reportText }),
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch (_) {}
    throw new Error(detail)
  }

  return res.json()
}
