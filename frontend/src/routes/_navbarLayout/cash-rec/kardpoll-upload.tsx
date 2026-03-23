import { createFileRoute, useSearch } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import axios from 'axios'
import { domain } from '@/lib/constants'
import { Button } from '@/components/ui/button'

type Search = { site?: string }

export const Route = createFileRoute('/_navbarLayout/cash-rec/kardpoll-upload')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): Search => ({
    site: typeof search.site === 'string' ? search.site : undefined,
  }),
})

interface KardpollResult {
  date: string
  totalSales: string
  totalLitres: string
  saved: boolean
  upserted?: boolean
}

function RouteComponent() {
  const { site } = useSearch({ from: '/_navbarLayout/cash-rec/kardpoll-upload' })
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<KardpollResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function uploadFile(f: File) {
    setError('')
    setResult(null)
    setFile(f)

    if (!site) {
      setError('No site selected. Please select a site first.')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', f)
      formData.append('site', site)

      const response = await axios.post(
        `${domain}/api/cash-rec/parse-kardpoll-excel`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        },
      )

      const data = response.data
      setResult({
        date: data.report?.date ?? '',
        totalSales: String(data.report?.sales ?? ''),
        totalLitres: String(data.report?.litresSold ?? ''),
        saved: data.saved,
        upserted: data.upserted,
      })
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Failed to upload file.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files[0]
    if (f) uploadFile(f)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(true)
  }

  function handleDragLeave() {
    setDragActive(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) uploadFile(f)
  }

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-6 p-4">
      <div>
        <h2 className="text-xl font-semibold">Kardpoll Excel Upload</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a Kardpoll Excel report to extract and save totals.
          {site ? (
            <span className="ml-1 font-medium text-foreground">Site: {site}</span>
          ) : (
            <span className="ml-1 text-destructive">No site selected.</span>
          )}
        </p>
      </div>

      <div
        className={[
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors text-center',
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50',
          file && !loading ? 'border-solid border-primary/40 bg-primary/5' : '',
        ].join(' ')}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.xlsm"
          className="hidden"
          onChange={handleInputChange}
        />
        {loading ? (
          <p className="text-sm text-muted-foreground">Uploading…</p>
        ) : file ? (
          <>
            <p className="font-medium">{file.name}</p>
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); setError('') }}>
              Clear
            </Button>
          </>
        ) : (
          <>
            <p className="font-medium">Drop your Excel file here</p>
            <p className="text-sm text-muted-foreground">or click to browse</p>
          </>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {result.upserted ? 'Record updated.' : 'Record saved.'}
          </p>
          <div className="flex gap-8 flex-wrap">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Date</span>
              <span className="text-2xl font-semibold">{result.date}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Total Sales</span>
              <span className="text-2xl font-semibold">{result.totalSales}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Total Litres</span>
              <span className="text-2xl font-semibold">{result.totalLitres}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
