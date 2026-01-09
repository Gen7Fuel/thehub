import * as React from 'react'
import { createFileRoute, useLoaderData, useNavigate } from '@tanstack/react-router'
import { format, subDays } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { SitePicker } from '@/components/custom/sitePicker'
import { DatePickerWithRange } from '@/components/custom/datePickerWithRange'
import { pdf, Document, Page, Image as PdfImage, StyleSheet } from '@react-pdf/renderer'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'

type Search = { site: string; from: string; to: string }
type BOLPhoto = {
  _id: string
  site: string
  date: string // YYYY-MM-DD
  filename: string
  createdAt?: string
  updatedAt?: string
}
type ListResponse = {
  site: string
  from: string | null
  to: string | null
  count: number
  entries: BOLPhoto[]
}

const ymd = (d: Date) => format(d, 'yyyy-MM-dd')
const parseYmd = (s?: string) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const Route = createFileRoute('/_navbarLayout/fuel-rec/list')({
  validateSearch: (search: Record<string, any>) => {
    const today = new Date()
    const last7From = subDays(today, 6)
    return {
      site: typeof search.site === 'string' ? search.site : '',
      from: typeof search.from === 'string' ? search.from : ymd(last7From),
      to: typeof search.to === 'string' ? search.to : ymd(today),
    } as Search
  },
  loaderDeps: ({ search }) => ({ site: search.site, from: search.from, to: search.to }),
  loader: async ({ deps }) => {
    const { site, from, to } = deps as Search
    if (!site || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return { site, from, to, data: null as ListResponse | null }
    }
    const res = await fetch(
      `/api/fuel-rec/list?site=${encodeURIComponent(site)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } }
    )
    if (!res.ok) {
      const msg = await res.text().catch(() => '')
      throw new Error(msg || `HTTP ${res.status}`)
    }
    const data = (await res.json()) as ListResponse
    return { site, from, to, data }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuth();
  const access = user?.access || {}

  const { site, from, to, data } = useLoaderData({ from: Route.id }) as {
    site: string
    from: string
    to: string
    data: ListResponse | null
  }
  const navigate = useNavigate({ from: Route.fullPath })
  const setSearch = (next: Partial<Search>) =>
    navigate({ search: (prev: any) => ({ ...prev, ...next }) })

  const range: DateRange | undefined = React.useMemo(() => {
    const f = parseYmd(from)
    const t = parseYmd(to)
    return f && t ? { from: f, to: t } : undefined
  }, [from, to])

  const onRangeSet: React.Dispatch<React.SetStateAction<DateRange | undefined>> = (val) => {
    const next = typeof val === 'function' ? val(range) : val
    if (!next?.from || !next?.to) return
    setSearch({ from: ymd(next.from), to: ymd(next.to) })
  }

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        page: { padding: 16 },
        image: { width: '100%', height: '100%', objectFit: 'contain' },
      }),
    []
  )

  const fetchAsDataUrl = async (url: string): Promise<string> => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to load image (${res.status})`)
    const blob = await res.blob()
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // Track in-flight requests per entry
  const [pending, setPending] = React.useState<Set<string>>(() => new Set())

  const requestAgain = async (e: BOLPhoto) => {
    try {
      setPending((prev) => new Set(prev).add(e._id))
      const res = await fetch('/api/fuel-rec/request-again', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ site: e.site, date: e.date }),
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(msg || `HTTP ${res.status}`)
      }
      alert(`Retake request sent for ${e.site} on ${e.date}.`)
    } catch (err) {
      alert(`Retake request failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setPending((prev) => {
        const next = new Set(prev)
        next.delete(e._id)
        return next
      })
    }
  }

  const downloadPdfForEntry = async (e: BOLPhoto) => {
    try {
      const imgUrl = `/cdn/download/${e.filename}`
      const dataUrl = await fetchAsDataUrl(imgUrl)
      const Doc = (
        <Document>
          <Page size="A4" style={styles.page}>
            <PdfImage src={dataUrl} style={styles.image} />
          </Page>
        </Document>
      )
      const blob = await pdf(Doc).toBlob()
      const a = document.createElement('a')
      const url = URL.createObjectURL(blob)
      a.href = url
      const base = e.filename.replace(/\.[^.]+$/, '')
      a.download = `${base}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(`PDF download failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <SitePicker
          value={site}
          onValueChange={(v) => setSearch({ site: v })}
          placeholder="Pick a site"
          label="Site"
          className="w-[240px]"
        />
        <DatePickerWithRange date={range} setDate={onRangeSet} />
      </div>

      {!site && <div className="text-xs text-muted-foreground">Pick a site to view BOL entries.</div>}

      {data && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Showing {data.count} entr{data.count === 1 ? 'y' : 'ies'} for {data.site} from {data.from} to {data.to}
          </div>
          {data.entries.length === 0 ? (
            <div className="text-sm text-muted-foreground">No entries found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Filename</th>
                    <th className="px-2 py-2">Preview</th>
                    {/* <th className="px-2 py-2">Created</th> */}
                    <th className="px-2 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((e) => (
                    <tr key={e._id} className="border-b">
                      <td className="px-2 py-2 font-mono">{e.date}</td>
                      <td className="px-2 py-2">{e.filename}</td>
                      <td className="px-2 py-2">
                        <img 
                          src={`/cdn/download/${e.filename}`} 
                          alt={`${e.date} preview`}
                          className="w-16 h-16 object-cover rounded border"
                          loading="lazy"
                        />
                      </td>
                      {/* <td className="px-2 py-2">{e.createdAt ? format(new Date(e.createdAt), 'yyyy-MM-dd HH:mm') : '—'}</td> */}
                      <td className="px-2 py-2 space-x-3">
                        {/* <a download={true} href={`/cdn/download/${e.filename}`}>Image</a> */}
                        {/* <button
                          type="button"
                          className="underline text-blue-600 hover:text-blue-800"
                          onClick={() => downloadPdfForEntry(e)}
                        >
                          PDF
                        </button> */}
                        <Button
                          onClick={() => downloadPdfForEntry(e)}
                        >
                          PDF
                        </Button>

                        {access?.accounting?.fuelRec?.requestAgain && (
                          <Button
                            variant="outline"
                            onClick={() => requestAgain(e)}
                            disabled={pending.has(e._id)}
                          >
                            {pending.has(e._id) ? 'Sending…' : 'Request Again'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}