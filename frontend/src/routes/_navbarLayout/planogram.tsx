import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import { FileText, Upload, X, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { LocationPicker } from '@/components/custom/locationPicker'
import { Toaster, toast } from 'sonner'

type UploadResult = {
  message: string
  site: string
  gtinCount: number
  previousCount: number
  sheetNames: Array<string>
  perSheet: Array<{ sheet: string; accepted: number }>
  rejectedCells: number
  headerDetected: boolean
}

type ExistingPlanogram = {
  exists: boolean
  gtinCount?: number
  sourceFilename?: string
  uploadedBy?: string
  uploadedAt?: string
}

type ParseFailure = {
  message: string
  sheetNames?: Array<string>
  perSheet?: Array<{ sheet: string; accepted: number }>
  rejectedCells?: number
  headerDetected?: boolean
}

type PendingConfirm = { previousCount: number; newCount: number }

export const Route = createFileRoute('/_navbarLayout/planogram')({
  component: RouteComponent,
})

function RouteComponent() {
  const [site, setSite] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [existing, setExisting] = useState<ExistingPlanogram | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [parseFailure, setParseFailure] = useState<ParseFailure | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null)

  const token = () => localStorage.getItem('token') || ''

  // Show what's already on file so it's clear what an upload would replace.
  useEffect(() => {
    if (!site) {
      setExisting(null)
      return
    }
    let alive = true
    axios
      .get(`/api/planogram?site=${encodeURIComponent(site)}`, {
        headers: {
          Authorization: `Bearer ${token()}`,
          'X-Required-Permission': 'planogram.view',
        },
      })
      .then((r) => alive && setExisting(r.data))
      .catch(() => alive && setExisting({ exists: false }))
    return () => {
      alive = false
    }
  }, [site])

  const onDrop = useCallback((accepted: Array<File>) => {
    setResult(null)
    setParseFailure(null)
    setPendingConfirm(null)
    setFile(accepted[0] ?? null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: false,
  })

  async function submit(confirm = false) {
    if (!site) {
      toast.error('Select a site first.')
      return
    }
    if (!file) {
      toast.error('Choose a planogram file first.')
      return
    }

    setBusy(true)
    setParseFailure(null)
    setPendingConfirm(null)

    try {
      const form = new FormData()
      form.append('file', file)

      // site travels in the query string: multer only fills req.body from
      // multipart fields that arrive before the file part.
      const res = await axios.post<UploadResult>(
        `/api/planogram?site=${encodeURIComponent(site)}${confirm ? '&confirm=true' : ''}`,
        form,
        {
          headers: {
            Authorization: `Bearer ${token()}`,
            'X-Required-Permission': 'planogram.upload',
          },
        },
      )

      setResult(res.data)
      setFile(null)
      setExisting({ exists: true, gtinCount: res.data.gtinCount })
      toast.success(`Planogram saved — ${res.data.gtinCount} GTINs for ${site}.`)
    } catch (err: any) {
      const status = err?.response?.status
      const data = err?.response?.data

      if (status === 409 && data?.needsConfirmation) {
        setPendingConfirm({
          previousCount: data.previousCount,
          newCount: data.newCount,
        })
      } else if (status === 422) {
        setParseFailure(data)
        toast.error('No valid GTINs found — nothing was changed.')
      } else {
        toast.error(data?.message || 'Upload failed.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pt-16 container mx-auto p-6 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Planogram</h1>
        <p className="text-muted-foreground mt-2">
          Upload a site's planogram so order rec items that aren't on it get flagged
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Planogram</CardTitle>
          <CardDescription>
            Excel file with product GTINs in column B. Uploading replaces the
            site's current planogram.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Site</label>
            <LocationPicker value="stationName" setStationName={setSite} />
          </div>

          {site && existing && (
            <div className="mb-4 text-sm text-muted-foreground">
              {existing.exists ? (
                <>
                  Currently on file: <strong>{existing.gtinCount} GTINs</strong>
                  {existing.sourceFilename ? ` from ${existing.sourceFilename}` : ''}
                  {existing.uploadedAt
                    ? ` (${new Date(existing.uploadedAt).toLocaleDateString()})`
                    : ''}
                </>
              ) : (
                <>No planogram on file for {site} yet — order recs are not being checked.</>
              )}
            </div>
          )}

          {!file ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              {isDragActive ? (
                <p className="text-lg">Drop the planogram file here...</p>
              ) : (
                <div>
                  <p className="text-lg mb-2">
                    Drag and drop your planogram here, or{' '}
                    <span className="text-primary font-medium">click to browse</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Only Excel files are accepted
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFile(null)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {busy ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2" />
                  <p className="text-sm text-muted-foreground">Processing file...</p>
                </div>
              ) : (
                <Button onClick={() => submit(false)} className="w-full">
                  Upload
                </Button>
              )}
            </div>
          )}

          {pendingConfirm && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-800 text-sm font-medium mb-2">
                This file has {pendingConfirm.newCount} GTINs, replacing{' '}
                {pendingConfirm.previousCount}.
              </p>
              <p className="text-amber-700 text-sm mb-3">
                That's a large drop — check it isn't a partial or wrong file.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => submit(true)} disabled={busy}>
                  Replace anyway
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPendingConfirm(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {parseFailure && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm">
              <p className="text-red-800 font-medium mb-2">{parseFailure.message}</p>
              <ul className="text-red-700 space-y-1">
                <li>Sheets found: {parseFailure.sheetNames?.join(', ') || 'none'}</li>
                <li>
                  GTIN column header detected:{' '}
                  {parseFailure.headerDetected ? 'yes' : 'no'}
                </li>
                <li>Unusable values skipped: {parseFailure.rejectedCells ?? 0}</li>
              </ul>
            </div>
          )}

          {result && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm">
              <p className="text-green-800 font-medium flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4" />
                {result.gtinCount} GTINs saved for {result.site}
                {result.previousCount > 0 && ` (was ${result.previousCount})`}
              </p>
              <ul className="text-green-700 space-y-1">
                {result.perSheet.map((s) => (
                  <li key={s.sheet}>
                    {s.sheet}: {s.accepted} products
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Toaster richColors position="top-center" />
    </div>
  )
}
