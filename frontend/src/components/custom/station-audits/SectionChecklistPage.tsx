import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleDashed, ImagePlus, Images, Loader2, ShoppingCart, X } from 'lucide-react'
import { toast } from 'sonner'
import { cdnService } from '@/api/cdn/cdn.service'
import { SitePicker } from '@/components/custom/sitePicker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/context/AuthContext'
import { isApiError } from '@/api/core/errors'
import { stationAuditsService } from '@/api/station-audits/station-audits.service'
import type { SaveStationAuditResponseResult, StationAuditChecklistItem, StationAuditChecklistReadModel, StationAuditFrequency } from '@/api/station-audits/station-audits.types'

const labels: Record<StationAuditFrequency, string> = { all: 'All frequencies', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }
const frequencyButtonLabels: Record<StationAuditFrequency, string> = { all: 'All', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }
const frequencyOrder = { daily: 0, weekly: 1, monthly: 2 } as const

function photoUrl(filename: string) {
  return `/cdn/download/${encodeURIComponent(filename)}`
}

function ChecklistResponseCard({
  checklist,
  sectionId,
  site,
  auditType,
  onSaved,
}: {
  checklist: StationAuditChecklistItem
  sectionId: string
  site: string
  auditType: 'store' | 'visitor'
  onSaved: (result: SaveStationAuditResponseResult, wasCompleted: boolean) => void
}) {
  const [statusOptionId, setStatusOptionId] = useState(checklist.response?.selectedStatus?.optionId || '')
  const [comment, setComment] = useState(checklist.response?.comment || '')
  const [photos, setPhotos] = useState(checklist.response?.photos || [])
  const [issueRaised, setIssueRaised] = useState(checklist.response?.issueRaised === true)
  const [issueId, setIssueId] = useState(checklist.response?.issue || '')
  const [checked, setChecked] = useState(checklist.completed)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [viewerPhoto, setViewerPhoto] = useState<string | null>(null)

  async function uploadPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    if (photos.length + files.length > 10) {
      toast.error('A checklist can contain at most 10 images.')
      return
    }

    setUploading(true)
    try {
      const uploaded = await Promise.all(files.map(async (file) => {
        const form = new FormData()
        form.append('file', file)
        return (await cdnService.uploadAuditPhoto(form)).filename
      }))
      setPhotos((current) => [...current, ...uploaded])
      toast.success(uploaded.length === 1 ? 'Image uploaded.' : `${uploaded.length} images uploaded.`)
    } catch (error) {
      console.error(error)
      toast.error('One or more images could not be uploaded. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  async function saveChecked(nextChecked: boolean) {
    if (uploading || saving) return
    if (nextChecked && !statusOptionId) {
      toast.error('Select a status before completing this checklist.')
      return
    }
    if (nextChecked && checklist.commentRequired && !comment.trim()) {
      toast.error('A comment is required for this checklist.')
      return
    }

    const wasCompleted = checked
    setSaving(true)
    try {
      const result = await stationAuditsService.saveResponse(
        sectionId,
        checklist._id,
        { site, type: auditType },
        {
          checked: nextChecked,
          statusOptionId,
          comment,
          photos,
          issueRaised,
        },
      )
      setChecked(result.completed)
      setIssueRaised(result.response.issueRaised === true)
      setIssueId(result.issue?._id || result.response.issue || '')
      onSaved(result, wasCompleted)
      toast.success(result.completed ? 'Checklist response saved.' : 'Checklist marked incomplete.')
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'Unable to save this checklist response.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className={`flex h-full flex-col transition-all hover:-translate-y-0.5 hover:shadow-md ${checked ? 'border-emerald-200 bg-emerald-50/30' : issueRaised ? 'border-red-200 bg-red-50/20' : 'border-slate-200'}`}>
      <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="capitalize">{checklist.frequency}</Badge>
              {checklist.category && <Badge variant="outline">{checklist.category}</Badge>}
              <Badge variant="outline">{checklist.department?.name || 'Unassigned'}</Badge>
            </div>
            <CardTitle className="text-base sm:text-lg">{checklist.item}</CardTitle>
            {checklist.description && <p className="mt-1 text-sm font-normal text-slate-500">{checklist.description}</p>}
          </div>
          {checked ? <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" /> : <CircleDashed className="h-6 w-6 shrink-0 text-slate-300" />}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 p-4 pt-0 sm:p-5 sm:pt-0">
        <div className="space-y-2">
          <Label htmlFor={`status-${checklist._id}`}>Status</Label>
          <Select value={statusOptionId} onValueChange={setStatusOptionId} disabled={saving}>
            <SelectTrigger id={`status-${checklist._id}`} className="h-11 w-full bg-white"><SelectValue placeholder="Select a status" /></SelectTrigger>
            <SelectContent>
              {checklist.statusOptionSet.options.map((option) => <SelectItem key={option._id} value={option._id}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`comment-${checklist._id}`}>Comment {checklist.commentRequired && <span className="text-red-600">*</span>}</Label>
          <Textarea id={`comment-${checklist._id}`} value={comment} onChange={(event) => setComment(event.target.value)} disabled={saving} maxLength={5000} placeholder={checklist.commentRequired ? 'Comment required' : 'Add a comment (optional)'} className="min-h-24 resize-y bg-white" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Images</Label>
            <label>
              <input type="file" accept="image/*" multiple className="hidden" onChange={uploadPhotos} disabled={uploading || saving || photos.length >= 10} />
              <Button type="button" variant="outline" size="sm" asChild disabled={uploading || saving || photos.length >= 10}>
                <span>{uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-1.5 h-4 w-4" />}{uploading ? 'Uploading' : 'Add images'}</span>
              </Button>
            </label>
          </div>
          {photos.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {photos.map((photo) => (
                <div key={photo} className="group relative aspect-square overflow-hidden rounded-lg border bg-slate-100">
                  <button type="button" className="h-full w-full" onClick={() => setViewerPhoto(photo)}><img src={photoUrl(photo)} alt="Checklist attachment" className="h-full w-full object-cover" /></button>
                  <button type="button" aria-label="Remove image" onClick={() => setPhotos((current) => current.filter((entry) => entry !== photo))} disabled={saving} className="absolute right-1 top-1 rounded-full bg-black/65 p-1 text-white opacity-90 hover:bg-black"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          ) : <div className="flex h-16 items-center justify-center rounded-lg border border-dashed text-xs text-slate-400"><Images className="mr-2 h-4 w-4" /> No images added</div>}
        </div>

        <div className="mt-auto flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" onClick={() => setIssueRaised((current) => !current)} disabled={saving || Boolean(issueId)} aria-pressed={issueRaised} className={issueRaised ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100' : ''}>
            <AlertTriangle className="mr-2 h-4 w-4" /> {auditType === 'visitor'
              ? issueRaised && checked ? 'Issue recorded' : issueRaised ? 'Issue will be recorded' : 'Record issue'
              : issueId ? 'Issue created' : issueRaised ? 'Issue will be raised' : 'Raise issue'}
          </Button>
          <div className="flex min-h-11 items-center gap-3 rounded-lg border bg-white px-3">
            {saving ? <Loader2 className="h-5 w-5 animate-spin text-emerald-600" /> : <Checkbox id={`checked-${checklist._id}`} checked={checked} onCheckedChange={(value) => void saveChecked(value === true)} disabled={uploading || saving} className="h-5 w-5" />}
            <Label htmlFor={`checked-${checklist._id}`} className="cursor-pointer">{saving ? 'Saving…' : checked ? 'Completed' : 'Mark complete'}</Label>
          </div>
        </div>

        {checklist.requestOrderEnabled && <div className="flex items-center gap-1 text-xs text-slate-500"><ShoppingCart className="h-3.5 w-3.5" /> Ordering available</div>}
      </CardContent>

      <Dialog open={Boolean(viewerPhoto)} onOpenChange={(open) => { if (!open) setViewerPhoto(null) }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Checklist image</DialogTitle></DialogHeader>
          {viewerPhoto && <img src={photoUrl(viewerPhoto)} alt="Checklist attachment preview" className="max-h-[75vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export function StationAuditSectionChecklistPage({
  sectionId,
  site,
  frequency,
  availableFrequencies,
  auditType,
  onBack,
  onInitializeSite,
  onSiteChange,
  onFrequencyChange,
  onNoAccess,
  onNotFound,
}: {
  sectionId: string
  site?: string
  frequency: StationAuditFrequency
  availableFrequencies: StationAuditFrequency[]
  auditType: 'store' | 'visitor'
  onBack: () => void
  onInitializeSite: (site: string) => void
  onSiteChange: (site: string) => void
  onFrequencyChange: (frequency: StationAuditFrequency) => void
  onNoAccess: () => void
  onNotFound: () => void
}) {
  const { user } = useAuth()
  const [data, setData] = useState<StationAuditChecklistReadModel | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!site && user?.location) onInitializeSite(user.location)
  }, [onInitializeSite, site, user?.location])

  useEffect(() => {
    if (!site) return
    let cancelled = false
    setLoading(true)
    setError('')
    stationAuditsService.getSectionChecklists(sectionId, { site, frequency, type: auditType })
      .then((result) => { if (!cancelled) setData(result) })
      .catch((requestError) => {
        if (cancelled) return
        if (isApiError(requestError) && requestError.status === 403) return void onNoAccess()
        if (isApiError(requestError) && requestError.status === 404) return void onNotFound()
        setError('Unable to load this audit section. Please try again.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [auditType, frequency, onNoAccess, onNotFound, sectionId, site])

  const section = data?.sections[0]
  const progress = section?.summary.total ? Math.round((section.summary.completed / section.summary.total) * 100) : 0
  const sortedItems = useMemo(
    () => [...(section?.checklists || [])].sort((left, right) => {
      const frequencyDifference = frequency === 'all'
        ? frequencyOrder[left.frequency] - frequencyOrder[right.frequency]
        : 0

      return frequencyDifference
        || (left.sortOrder ?? 0) - (right.sortOrder ?? 0)
        || left.item.localeCompare(right.item, undefined, { sensitivity: 'base' })
    }),
    [frequency, section?.checklists],
  )

  function applySavedResponse(checklistId: string, result: SaveStationAuditResponseResult, wasCompleted: boolean) {
    setData((current) => {
      if (!current) return current
      const completionDelta = Number(result.completed) - Number(wasCompleted)
      return {
        ...current,
        summary: {
          ...current.summary,
          completed: current.summary.completed + completionDelta,
          pending: current.summary.pending - completionDelta,
        },
        sections: current.sections.map((currentSection) => ({
          ...currentSection,
          summary: {
            ...currentSection.summary,
            completed: currentSection.summary.completed + completionDelta,
            pending: currentSection.summary.pending - completionDelta,
          },
          checklists: currentSection.checklists.map((item) => item._id === checklistId
            ? { ...item, completed: result.completed, run: result.run, response: result.response }
            : item),
        })),
      }
    })
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-3 pb-10 sm:px-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" /> Sections</Button>
        <div className="flex flex-col gap-2 sm:items-end">
          <SitePicker value={site} onValueChange={onSiteChange} className="h-11 w-full sm:w-52" />
          <div className="flex flex-wrap gap-2" aria-label="Audit frequency">
            {availableFrequencies.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={frequency === value ? 'default' : 'outline'}
                onClick={() => onFrequencyChange(value)}
                aria-pressed={frequency === value}
              >
                {frequencyButtonLabels[value]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {loading && <div className="flex min-h-60 items-center justify-center rounded-2xl border border-dashed bg-white"><Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-600" /> Loading checklist…</div>}
      {!loading && error && <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-red-700">{error}</div>}

      {!loading && !error && section && (
        <>
          <div className="mb-5 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div><h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{section.name}</h1>{section.description && <p className="mt-1 text-sm text-slate-600">{section.description}</p>}</div>
              <Badge variant="outline" className="bg-white">{section.summary.pending} remaining</Badge>
            </div>
            <div className="mt-4 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} /></div><strong className="text-sm text-emerald-700">{progress}%</strong></div>
          </div>

          {sortedItems.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">No {labels[frequency].toLowerCase()} items are assigned.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {sortedItems.map((checklist) => (
                <ChecklistResponseCard
                  key={checklist._id}
                  checklist={checklist}
                  sectionId={sectionId}
                  site={site!}
                  auditType={auditType}
                  onSaved={(result, wasCompleted) => applySavedResponse(checklist._id, result, wasCompleted)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
