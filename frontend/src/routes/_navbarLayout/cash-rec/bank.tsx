import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

type ParsedTtx = {
  balanceForward?: number
  nightDeposit?: number
  transferTo?: number
  miscDebits: { date: string; description: string; amount: number }[]
  // NEW: capture miscellaneous credits
  miscCredits?: { date: string; description: string; amount: number }[]
  // NEW: capture GBL debits/credits
  gblDebits?: { date: string; description: string; amount: number }[]
  gblCredits?: { date: string; description: string; amount: number }[]
  endingBalance?: number
  statementDate?: string // YYYY-MM-DD
  accountName?: string // raw Account Name (legalName)
  derivedSite?: string // first token fallback
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
  const acctNameIdx = idx('Account Name')

  const out: ParsedTtx = { miscDebits: [], miscCredits: [], gblDebits: [], gblCredits: [] }
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

      // Capture legalName from Balance Forward row
      if (!out.accountName && acctNameIdx >= 0 && description.toLowerCase().includes('balance forward')) {
        out.accountName = cols[acctNameIdx].trim()
      }

      const descLower = description.toLowerCase()
      if (out.balanceForward == null && descLower.includes('balance forward')) out.balanceForward = balance
      if (descLower.includes('night deposit')) out.nightDeposit = (out.nightDeposit ?? 0) + credits
      if (descLower.includes('transfer to')) out.transferTo = (out.transferTo ?? 0) + debits
      // Column-driven classification with GBL split (strictly > 0)
      const hasGBL = /gbl/i.test(description)
      if (debits > 0) {
        if (hasGBL) out.gblDebits!.push({ date: dateStr || '', description, amount: debits })
        else out.miscDebits.push({ date: dateStr || '', description, amount: debits })
      }
      if (credits > 0) {
        if (hasGBL) out.gblCredits!.push({ date: dateStr || '', description, amount: credits })
        else out.miscCredits!.push({ date: dateStr || '', description, amount: credits })
      }
    }
  }
  else {
    // Fallback for fixed-width .txt: try to extract Account Name from the Balance Forward line
    const bfLine = nonEmpty.find(l => /balance forward/i.test(l))
    if (bfLine) {
      // Example pattern: "... CAD BKEJWANONG Balance Forward ..."
      const m = bfLine.match(/\bCAD\s+(.+?)\s+Balance Forward/i)
      if (m) {
        if (!out.accountName) out.accountName = m[1].trim()
      }
      const d = bfLine.match(/^(\d{2}\/\d{2}\/\d{2})/)
      if (d) {
        const parsedDate = parseTtxDate(d[1])
        if (parsedDate) latestDate = parsedDate
      }
    }
  }

  out.endingBalance = lastBalance
  out.statementDate = latestDate
  if (out.accountName) {
    const first = out.accountName.trim().split(/\s+/)[0]
    if (first) out.derivedSite = first
  }
  return out
}

function RouteComponent() {
  const { site } = Route.useSearch() as { site: string }
  const navigate = useNavigate({ from: Route.fullPath })
  // Note: SitePicker removed; URL search param is updated automatically by detection

  const [parsed, setParsed] = React.useState<ParsedTtx | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isOver, setIsOver] = React.useState(false)
  const [detectedStation, setDetectedStation] = React.useState<string | null>(null)
  const [merchantFees, setMerchantFees] = React.useState<string>('')
  const merchantFeesNumber = React.useMemo(() => {
    const n = Number(merchantFees)
    return Number.isFinite(n) ? n : NaN
  }, [merchantFees])
  const merchantFeesValid = React.useMemo(() => {
    // allow up to 2 decimals, strictly > 0
    if (!merchantFees) return false
    if (!/^\d+(\.\d{1,2})?$/.test(merchantFees.trim())) return false
    const n = Number(merchantFees)
    return Number.isFinite(n) && n > 0
  }, [merchantFees])

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

  // Auto-select site by matching Account Name (legalName) against /api/locations
  React.useEffect(() => {
    const autoPickSite = async () => {
      if (!parsed?.accountName) return
      try {
        let locations: { stationName: string; legalName: string }[] | null = null
        // Try local proxy first
        const localResp = await fetch('/api/locations', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        })
        if (localResp.ok) {
          locations = await localResp.json()
        } else {
          // Fallback to remote API
          const remoteResp = await fetch('https://app.gen7fuel.com/api/locations')
          if (remoteResp.ok) locations = await remoteResp.json()
        }
        if (!locations) return

        const normalize = (s: string) => s.trim().toLowerCase()
        const stripGen7 = (s: string) =>
          s
            .replace(/\bgen7\b/gi, '')
            .replace(/\blp\b/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim()

        const candidates = [
          parsed.accountName,
          stripGen7(parsed.accountName),
          parsed.derivedSite || '',
        ]
          .map(normalize)
          .filter(Boolean)

        const match = locations.find((loc) => {
          const ln = normalize(loc.legalName)
          const sn = normalize(loc.stationName)
          return candidates.some((c) => c === ln || c === sn)
        })

        if (match) {
          setDetectedStation(match.stationName)
          if (!site) {
            navigate({ to: Route.fullPath, search: (prev: any) => ({ ...prev, site: match.stationName }) })
          }
        } else {
          setDetectedStation(null)
        }
      } catch {
        // silent failure; user can select manually
      }
    }
    autoPickSite()
  }, [parsed, site])

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
  // Prefer detected station over SitePicker value for the `site` used in capture
  const selectedSite = detectedStation || site
  const canCapture = Boolean(parsed && parsed.statementDate && selectedSite && merchantFeesValid)

  const capture = async () => {
    if (!canCapture || !parsed) return
    const payload = {
      site: selectedSite,
      date: parsed.statementDate,
      balanceForward: parsed.balanceForward ?? 0,
      nightDeposit: parsed.nightDeposit ?? 0,
      transferTo: parsed.transferTo ?? 0,
      endingBalance: parsed.endingBalance ?? 0,
      miscDebits: parsed.miscDebits ?? [],
      // NEW: include miscCredits when uploading
      miscCredits: parsed.miscCredits ?? [],
      // NEW: include gbl buckets when uploading
      gblDebits: parsed.gblDebits ?? [],
      gblCredits: parsed.gblCredits ?? [],
      // NEW: include merchantFees
      merchantFees: merchantFeesNumber,
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
      {/* SitePicker removed: site is derived from detected station */}

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
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Merchant Fees (required)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 12.34"
                value={merchantFees}
                onChange={(e) => setMerchantFees(e.target.value.trim())}
                className={`w-full border rounded px-3 py-2 text-sm ${merchantFees && !merchantFeesValid ? 'border-red-500' : 'border-input'}`}
              />
              {!merchantFeesValid && merchantFees && (
                <div className="text-xs text-red-600 mt-1">Enter a number > 0 with up to 2 decimals.</div>
              )}
            </div>
            <div className="text-xs text-muted-foreground pb-2">Capture requires Merchant Fees.</div>
          </div>
          <div className="border rounded p-3 bg-muted/20">
            <div className="font-semibold">Detected Account</div>
            <div className="text-sm">
              <span className="mr-2">{parsed.accountName || '-'}</span>
              {parsed.derivedSite ? (
                <span className="text-muted-foreground">(derived: {parsed.derivedSite})</span>
              ) : null}
            </div>
            <div className="mt-1 text-sm">
              <span className="font-semibold">Selected Site:</span>
              <span className="ml-1">{selectedSite || '-'}</span>
            </div>
            <div className="mt-1 text-sm">
              <span className="font-semibold">Detected Station:</span>
              <span className="ml-1">{detectedStation || '-'}</span>
            </div>
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
            <div className="border rounded p-3">
              <div className="font-semibold">Merchant Fees</div>
              <div>{merchantFeesValid ? merchantFees : '-'}</div>
            </div>
              {/* GBL Debits */}
              <div className="sm:col-span-2 border rounded p-3">
                <div className="font-semibold mb-2">GBL Debits</div>
                {((parsed.gblDebits?.length ?? 0) === 0) ? (
                  <div className="text-sm text-muted-foreground">None found</div>
                ) : (
                  <>
                    <ul className="space-y-1">
                      {parsed.gblDebits!.map((m, i) => (
                        <li key={i} className="text-sm">
                          <span className="mr-2">{m.date || '-'}</span>
                          <span className="mr-2">{m.description}</span>
                          <span className="font-mono">{m.amount}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 text-sm font-semibold">
                      Total: {parsed.gblDebits!.reduce((s, x) => s + (x.amount || 0), 0)}
                    </div>
                  </>
                )}
              </div>
            <div className="sm:col-span-2 border rounded p-3">
              <div className="font-semibold mb-2">Misc Debits (Debits column)</div>
              {parsed.miscDebits.length === 0 ? (
                <div className="text-sm text-muted-foreground">None found</div>
              ) : (
                  <>
                    <ul className="space-y-1">
                      {parsed.miscDebits.map((m, i) => (
                        <li key={i} className="text-sm">
                          <span className="mr-2">{m.date || '-'}</span>
                          <span className="mr-2">{m.description}</span>
                          <span className="font-mono">{m.amount}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 text-sm font-semibold">
                    Total: {parsed.miscDebits.reduce((s, x) => s + (x.amount || 0), 0) + (merchantFeesValid ? merchantFeesNumber : 0)}
                    </div>
                  </>
              )}
            </div>
              {/* GBL Credits */}
              <div className="sm:col-span-2 border rounded p-3">
                <div className="font-semibold mb-2">GBL Credits</div>
                {((parsed.gblCredits?.length ?? 0) === 0) ? (
                  <div className="text-sm text-muted-foreground">None found</div>
                ) : (
                  <>
                    <ul className="space-y-1">
                      {parsed.gblCredits!.map((m, i) => (
                        <li key={i} className="text-sm">
                          <span className="mr-2">{m.date || '-'}</span>
                          <span className="mr-2">{m.description}</span>
                          <span className="font-mono">{m.amount}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 text-sm font-semibold">
                      Total: {parsed.gblCredits!.reduce((s, x) => s + (x.amount || 0), 0)}
                    </div>
                  </>
                )}
              </div>
              {/* Misc Credits list */}
            <div className="sm:col-span-2 border rounded p-3">
              <div className="font-semibold mb-2">Misc Credits (Credits column)</div>
              {(parsed.miscCredits?.length ?? 0) === 0 ? (
                <div className="text-sm text-muted-foreground">None found</div>
              ) : (
                  <>
                    <ul className="space-y-1">
                      {parsed.miscCredits!.map((m, i) => (
                        <li key={i} className="text-sm">
                          <span className="mr-2">{m.date || '-'}</span>
                          <span className="mr-2">{m.description}</span>
                          <span className="font-mono">{m.amount}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 text-sm font-semibold">
                      Total: {parsed.miscCredits!.reduce((s, x) => s + (x.amount || 0), 0)}
                    </div>
                  </>
              )}
            </div>
          </div>

          {canCapture && (
            <div className="mt-4 flex justify-end">

              <Button
                className="px-4 py-2 text-sm border rounded"
                onClick={capture}
                disabled={!canCapture}
                title={!selectedSite ? 'No station detected' : undefined}
              >
                Capture
              </Button>
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