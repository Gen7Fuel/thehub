import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'

export const Route = createFileRoute('/_navbarLayout/sftp-shift-summary')({
  component: ShiftSummaryRoute,
})

function ShiftSummaryRoute() {
  const { user } = useAuth()
  const canViewJsonApiResponse = Boolean(user?.access?.viewJsonApiResponse)
  const [data, setData] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSummary = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/sftp/shift-summary', {
        signal,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      })

      if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}`)
      setData(await response.json())
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Failed to load shift summary')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!canViewJsonApiResponse) return
    const controller = new AbortController()
    loadSummary(controller.signal)
    return () => controller.abort()
  }, [canViewJsonApiResponse, loadSummary])

  if (!canViewJsonApiResponse) {
    return (
      <div className="container mx-auto max-w-7xl p-6 pt-5">
        <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6 pt-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">SFTP Shift Summary JSON</h1>
          <p className="text-sm text-muted-foreground">
            Response from <code>/api/sftp/shift-summary</code>
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/sftp" className="rounded border px-3 py-2 text-sm hover:bg-muted">
            Back to SFTP
          </Link>
          <button
            type="button"
            onClick={() => loadSummary()}
            className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-md border bg-card p-4">
        {loading && <p className="text-sm text-muted-foreground">Loading shift summary...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && (
          <pre className="max-h-[700px] overflow-auto whitespace-pre-wrap text-xs leading-relaxed">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}
