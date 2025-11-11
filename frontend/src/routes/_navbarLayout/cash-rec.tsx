import { SitePicker } from '@/components/custom/sitePicker'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

type CashRecSearch = {
  site: string
  shift?: string
}

type CashRecFile = {
  name: string
  size: number
  modifyTime: number
  accessTime: number
  type: string
  path: string
}

type CashRecMetrics = {
  fuelSales: number | null
  dealGroupCplDiscounts: number | null
  fuelPriceOverrides: number | null
  itemSales: number | null
  depositTotal: number | null
  pennyRounding: number | null
  totalSales: number | null
  afdCredit: number | null
  afdDebit: number | null
  kioskCredit: number | null
  kioskDebit: number | null
  kioskGiftCard: number | null
  totalPos: number | null
  arIncurred: number | null
  grandTotal: number | null
  couponsAccepted: number | null
  canadianCash: number | null
  cashOnHand: number | null
  cashBack: number | null
  safedrops: { count: number | null; amount: number | null }
}

export const Route = createFileRoute('/_navbarLayout/cash-rec')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): CashRecSearch => ({
    site: (search.site as string) || '',
    shift: typeof search.shift === 'string' ? search.shift.replace(/^"(.*)"$/, '$1') : undefined,
  }),
  loaderDeps: ({ search: { site } }) => ({ site }),
  loader: async ({ deps: { site } }) => {
    if (!site) return { files: [] as CashRecFile[] } // no site yet
    const res = await fetch(`/api/cash-rec/receive?site=${encodeURIComponent(site)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    })
    if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to load files'))
    const { files } = await res.json()
    return { files }
  },
})

function RouteComponent() {
  const { files } = Route.useLoaderData() as { files: CashRecFile[] }
  const [content, setContent] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<CashRecMetrics | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const [_, setContentError] = useState<string | null>(null)
  const { site, shift } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  useEffect(() => {
    let alive = true
    const controller = new AbortController()

    async function run() {
      if (!shift) {
        setContent(null)
        setMetrics(null)
        setContentError(null)
        return
      }
      setLoadingContent(true)
      setContentError(null)
      const attempts = 3
      for (let i = 0; i < attempts; i++) {
        try {
          const r = await fetch(
            `/api/cash-rec/receive/${shift}?site=${encodeURIComponent(site)}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
              signal: controller.signal,
            }
          )
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          const d = await r.json()
          if (!alive) return
          setContent(d.content ?? '')
          setMetrics(d.metrics ?? null)
          setLoadingContent(false)
          return
        } catch (e) {
          if (!alive || (e as any).name === 'AbortError') return
          if (i < attempts - 1) await new Promise(res => setTimeout(res, 200 * Math.pow(2, i)))
          else {
            setContentError('Failed to load file content')
            setLoadingContent(false)
          }
        }
      }
    }

    run()
    return () => {
      alive = false
      controller.abort()
    }
  }, [shift])

  const updateSite = (newSite: string) => {
    navigate({ search: (prev: CashRecSearch) => ({ ...prev, site: newSite }) })
  }

  const extractShift = (filename: string): string | null => {
    const match = filename.match(/(\d+)\.sft$/i)
    return match?.[1] ?? null
  }

  const extractDateFromName = (filename: string): Date | null => {
    const m = filename.match(/\s(\d{12})\s/)
    if (!m) return null
    const ts = m[1] // YYYYMMDDHHmm
    const y = Number(ts.slice(0, 4))
    const mo = Number(ts.slice(4, 6)) - 1
    const d = Number(ts.slice(6, 8))
    const h = Number(ts.slice(8, 10))
    const mi = Number(ts.slice(10, 12))
    return new Date(y, mo, d, h, mi)
  }

  const formatDateTime = (d: Date | null) =>
    d ? d.toLocaleString() : '—'

  // Sort by full file name (desc = newest first since timestamp is in the name)
  const sortedFiles = [...files].sort((a, b) =>
    b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' })
  )

  const items = sortedFiles
    .map(f => ({ file: f, shift: extractShift(f.name) }))
    .filter(x => x.shift) as { file: CashRecFile; shift: string }[]

  return (
    <div className="container mx-auto pt-16 p-6 max-w-7xl space-y-6">
      <SitePicker
        value={site}
        onValueChange={updateSite}
        placeholder="Pick a site"
        label="Site"
        className="w-[220px]"
      />

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="w-60 shrink-0 border rounded-md bg-card">
          <div className="p-3 border-b">
            <h2 className="text-sm font-semibold">Received Shifts</h2>
          </div>
          <ul className="p-2 space-y-1 max-h-[600px] overflow-y-auto">
            {items.length === 0 && (
              <li className="text-xs text-muted-foreground px-2 py-1">No .sft files</li>
            )}
            {items.map(({ file, shift: s }) => {
              const dt = extractDateFromName(file.name) ?? new Date(file.modifyTime)
              return (
                <li key={file.path}>
                  <Link
                    to={Route.fullPath}
                    search={(prev: CashRecSearch) => ({ ...prev, shift: s })}
                    preload={false}
                    className={`block px-3 py-2 rounded text-sm transition ${
                      shift === s ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span>{s}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDateTime(dt)}
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* Main viewer */}
        <main className="flex-1 border rounded-md bg-card flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              {shift ? `Shift ${shift}` : 'Select a shift'}
            </h3>
          </div>
          <div className="p-4 overflow-auto space-y-6">
            {!shift && <div className="text-muted-foreground">Choose a shift from the sidebar.</div>}
            {shift && loadingContent && (
              <div className="text-muted-foreground">
                Loading...
              </div>
            )}

            {metrics && !loadingContent && (
              <div>
                <h4 className="font-medium mb-2 text-sm">Parsed Metrics</h4>
                {(() => {
                  const { safedrops, ...numeric } = metrics
                  return (
                    <div className="grid gap-2 text-xs sm:grid-cols-2 md:grid-cols-3">
                      <div className="border rounded p-2 bg-muted/40">
                        <div className="font-semibold">Safedrops</div>
                        <div>Count: {safedrops.count ?? '—'}</div>
                        <div>Amount: {safedrops.amount ?? '—'}</div>
                      </div>
                      {Object.entries(numeric).map(([key, val]) => (
                        <div key={key} className="border rounded p-2 bg-muted/40">
                          <div className="font-semibold">
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}
                          </div>
                          <div>{val ?? '—'}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}

            {content && !loadingContent && (
              <div>
                <h4 className="font-medium mb-2 text-sm">Raw Report</h4>
                <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-mono">
                  {content}
                </pre>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}