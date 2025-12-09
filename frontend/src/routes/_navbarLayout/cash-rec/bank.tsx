import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'

type ParsedTtx = {
  balanceForward?: number
  nightDeposit?: number
  transferTo?: number
  miscDebits: { date: string; description: string; amount: number }[]
  endingBalance?: number
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
  const s = unquote(raw)
    .replace(/[\s$,]/g, '')
    .replace(/^\((.*)\)$/, '-$1')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function parseTtx(text: string): ParsedTtx {
  // Normalize line endings, split by newline, trim trailing spaces
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map(l => l.trimEnd())
  // Remove empty lines
  const nonEmpty = lines.filter(l => l.length > 0)

  // Find header line (assume it contains these column names)
  // Typical columns: Date<TAB>Check No.<TAB>Description<TAB>Debits<TAB>Credits<TAB>Balance
  let headerIdx = -1
  let headers: string[] = []
  for (let i = 0; i < nonEmpty.length; i++) {
    const cols = nonEmpty[i].split('\t')
    const lc = cols.map(c => c.toLowerCase())
    const hasDesc = lc.includes('description')
    const hasDebits = lc.includes('debits')
    const hasCredits = lc.includes('credits')
    const hasBalance = lc.includes('balance')
    if (hasDesc && hasDebits && hasCredits && hasBalance) {
      headerIdx = i
      headers = cols
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

  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < nonEmpty.length; i++) {
      const cols = nonEmpty[i].split('\t')
      if (cols.length < headers.length) continue

      const dateStr = dateIdx >= 0 ? parseTtxDate(unquote(cols[dateIdx])) : ''
      const description = descIdx >= 0 ? unquote(cols[descIdx]) : ''
      const debits = debitsIdx >= 0 ? toNum(cols[debitsIdx]) : 0
      const credits = creditsIdx >= 0 ? toNum(cols[creditsIdx]) : 0
      const balance = balanceIdx >= 0 ? toNum(cols[balanceIdx]) : undefined

      if (typeof balance === 'number') lastBalance = balance

      const descLower = description.toLowerCase()

      // Balance Forward (Balance column)
      if (out.balanceForward == null && descLower.includes('balance forward')) {
        out.balanceForward = balance
      }

      // NIGHT DEPOSIT (Credits column)
      if (descLower.includes('night deposit')) {
        out.nightDeposit = (out.nightDeposit ?? 0) + credits
      }

      // TRANSFER TO (Debits column)
      if (descLower.includes('transfer to')) {
        out.transferTo = (out.transferTo ?? 0) + debits
      }

      // MISC DEBIT (Debits column) - list all
      if (descLower.includes('misc debit')) {
        out.miscDebits.push({
          date: dateStr || '',
          description,
          amount: debits,
        })
      }
    }
  }

  // Ending Balance (last line Balance column)
  out.endingBalance = lastBalance

  return out
}

export default function BankTtxUploader() {
  const [parsed, setParsed] = React.useState<ParsedTtx | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isOver, setIsOver] = React.useState(false)

  const handleFiles = async (files: FileList | null) => {
    setError(null)
    setParsed(null)
    if (!files || files.length === 0) return
    const file = files[0]
    if (!file.name.toLowerCase().endsWith('.ttx') && !file.name.toLowerCase().endsWith('.txt')) {
      setError('Please upload a .ttx file')
      return
    }
    try {
      const text = await file.text()
      const res = parseTtx(text)
      setParsed(res)
    } catch (e: any) {
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

  return (
    <div className="p-4 space-y-4">
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
        <input
          id="ttx-input"
          type="file"
          accept=".ttx,.txt"
          className="hidden"
          onChange={onFileInput}
        />
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {parsed && (
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
      )}
    </div>
  )
}

export const Route = createFileRoute('/_navbarLayout/cash-rec/bank')({
  component: BankTtxUploader,
})