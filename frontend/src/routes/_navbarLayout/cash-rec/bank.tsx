import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SitePicker } from '@/components/custom/sitePicker'

type ParsedTtx = {
  balanceForward?: number
  nightDeposit?: number
  transferTo?: number
  miscDebits: { date: string; description: string; amount: number }[]
  endingBalance?: number
  statementDate?: string // YYYY-MM-DD
}

const pad = (n: number) => String(n).padStart(2, '0')

// YY/MM/DD -> YYYY-MM-DD (assumes 2000-2099)
function parseTtxDate(s: string): string | '' {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
  if (!m) return ''
  const yy = Number(m[1])
  const mm = Number(m[2])
  const dd = Number(m[3])
  const year = 2000 + yy
  return `${year}-${pad(mm)}-${pad(dd)}`
}

const unquote = (s: string) => s.replace(/^"(.*)"$/, '$1')

function toNum(raw: string | undefined): number {
  if (!raw) return 0
  const s = unquote(raw).replace(/[\s$,]/g, '').replace(/^\((.*)\)$/, '-$1')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function parseTtx(text: string): ParsedTtx {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map(l => l.trimEnd())
  const nonEmpty = lines.filter(l => l.length > 0)

  // Find header by required columns (tab-delimited)
  let headerIdx = -1
  let headers: string[] = []
  for (let i = 0; i < nonEmpty.length; i++) {
    const cols = nonEmpty[i].split('\t')
    const lc = cols.map(c => unquote(c).toLowerCase())
    if (lc.includes('description') && lc.includes('debits') && lc.includes('credits') && lc.includes('balance')) {
      headerIdx = i
      headers = cols.map(unquote)
      break
    }
  }

  const idx = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase())
  const dateIdx = idx('Date')
  const descIdx = idx('Description')
  const debitsIdx = idx('Debits')
  const creditsIdx = idx('Credits')
  const balanceIdx = idx('Balance')

  const out: ParsedTtx = { miscDebits: [] }
  let lastBalance: number | undefined
  let latestDate: string | undefined

  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < nonEmpty.length; i++) {
      const colsRaw = nonEmpty[i].split('\t')
      const cols = colsRaw.map(unquote)
      if (cols.length < headers.length) continue

      const dateStr = dateIdx >= 0 ? parseTtxDate(cols[dateIdx]) : ''
      const description = descIdx >= 0 ? cols[descIdx] : ''
      const debits = debitsIdx >= 0 ? toNum(cols[debitsIdx]) : 0
      const credits = creditsIdx >= 0 ? toNum(cols[creditsIdx]) : 0
      const balance = balanceIdx >= 0 ? toNum(cols[balanceIdx]) : undefined

      if (typeof balance === 'number') lastBalance = balance
      if (dateStr) {
        if (!latestDate || dateStr > latestDate) latestDate = dateStr
      }

      const descLower = description.toLowerCase()
      if (out.balanceForward == null && descLower.includes('balance forward')) out.balanceForward = balance
      if (descLower.includes('night deposit')) out.nightDeposit = (out.nightDeposit ?? 0) + credits
      if (descLower.includes('transfer to')) out.transferTo = (out.transferTo ?? 0) + debits
      if (descLower.includes('misc debit')) {
        out.miscDebits.push({ date: dateStr || '', description, amount: debits })
      }
    }
  }

  out.endingBalance = lastBalance
  out.statementDate = latestDate
  return out
}

function RouteComponent() {
  const { site } = Route.useSearch() as { site: string }
  const navigate = useNavigate({ from: Route.fullPath })
  const setSearch = (next: Partial<{ site: string }>) =>
    navigate({ search: (prev: any) => ({ ...prev, ...next }) })

  const [parsed, setParsed] = React.useState<ParsedTtx | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isOver, setIsOver] = React.useState(false)

  const handleFiles = async (files: FileList | null) => {
    setError(null)
    setParsed(null)
    if (!files || files.length === 0) return
    const file = files[0]
    const name = file.name.toLowerCase()
    if (!name.endsWith('.ttx') && !name.endsWith('.txt')) {
      setError('Please upload a .ttx file')
      return
    }
    try {
      const text = await file.text()
      const res = parseTtx(text)
      if (!res.statementDate) setError('Could not determine statement date from file')
      setParsed(res)
    } catch {
      setError('Failed to parse file')
    }
  }

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsOver(false)
    handleFiles(e.dataTransfer.files)
  }
  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsOver(true)
  }
  const onDragLeave: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsOver(false)
  }
  const onFileInput: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    handleFiles(e.target.files)
  }

  const canCapture = Boolean(parsed && parsed.statementDate && site)

  const capture = async () => {
    if (!canCapture || !parsed) return
    const payload = {
      site,
      date: parsed.statementDate,
      balanceForward: parsed.balanceForward ?? 0,
      nightDeposit: parsed.nightDeposit ?? 0,
      transferTo: parsed.transferTo ?? 0,
      endingBalance: parsed.endingBalance ?? 0,
      miscDebits: parsed.miscDebits ?? [],
    }
    try {
      const res = await fetch('/api/cash-rec/bank-statement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      // Prevent duplicate clicks by disabling and showing message
      alert(data.upserted ? 'Captured successfully.' : 'Already captured. Updated existing record.')
    } catch (e: any) {
      alert(`Capture failed: ${e?.message || e}`)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-4">
        <SitePicker
          value={site}
          onValueChange={(v) => setSearch({ site: v })}
          placeholder="Pick a site"
          label="Site"
          className="w-[240px]"
        />
      </div>

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`border-2 border-dashed rounded p-8 text-center cursor-pointer ${
          isOver ? 'border-blue-500 bg-blue-50' : 'border-muted'
        }`}
        onClick={() => document.getElementById('ttx-input')?.click()}
      >
        <div className="text-lg font-medium">Drag and drop your .ttx file here</div>
        <div className="text-sm text-muted-foreground">or click to select</div>
        <input id="ttx-input" type="file" accept=".ttx,.txt" className="hidden" onChange={onFileInput} />
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {parsed && (
        <>
          <div className="text-sm text-muted-foreground">
            Statement Date: <span className="font-mono">{parsed.statementDate || '-'}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border rounded p-3">
              <div className="font-semibold">Balance Forward</div>
              <div>{parsed.balanceForward ?? 0}</div>
            </div>
            <div className="border rounded p-3">
              <div className="font-semibold">Night Deposit (Credits)</div>
              <div>{parsed.nightDeposit ?? 0}</div>
            </div>
            <div className="border rounded p-3">
              <div className="font-semibold">Transfer To (Debits)</div>
              <div>{parsed.transferTo ?? 0}</div>
            </div>
            <div className="border rounded p-3">
              <div className="font-semibold">Ending Balance</div>
              <div>{parsed.endingBalance ?? 0}</div>
            </div>
            <div className="sm:col-span-2 border rounded p-3">
              <div className="font-semibold mb-2">Misc Debits (Debits column)</div>
              {parsed.miscDebits.length === 0 ? (
                <div className="text-sm text-muted-foreground">None found</div>
              ) : (
                <ul className="space-y-1">
                  {parsed.miscDebits.map((m, i) => (
                    <li key={i} className="text-sm">
                      <span className="mr-2">{m.date || '-'}</span>
                      <span className="mr-2">{m.description}</span>
                      <span className="font-mono">{m.amount}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {canCapture && (
            <div className="mt-4 flex justify-end">
              <button
                className="px-4 py-2 text-sm border rounded hover:bg-muted"
                onClick={capture}
                disabled={!canCapture}
                title={!site ? 'Pick a site' : undefined}
              >
                Capture
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export const Route = createFileRoute('/_navbarLayout/cash-rec/bank')({
  validateSearch: (s) => ({ site: (s as any).site ?? '' }) as { site: string },
  component: RouteComponent,
})