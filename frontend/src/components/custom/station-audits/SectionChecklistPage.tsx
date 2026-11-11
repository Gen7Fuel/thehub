import { useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, CircleDashed, ImagePlus, Images, Info, Loader2, ShoppingCart, X } from 'lucide-react'
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
const categoryColors = ['#93c5fd', '#c4b5fd', '#f9a8d4', '#fdba74', '#67e8f9', '#bef264', '#a5b4fc', '#99f6e4']

function photoUrl(filename: string) {
  return `/cdn/download/${encodeURIComponent(filename)}`
}

function checkedTimeLabel(checkedAt: string | null | undefined, now: number) {
  if (!checkedAt) return 'Completed'
  const elapsedMinutes = Math.max(0, Math.floor((now - new Date(checkedAt).getTime()) / 60_000))
  if (elapsedMinutes < 5) return 'Completed recently'
  if (elapsedMinutes < 60) return `Completed ${Math.floor(elapsedMinutes / 5) * 5}m ago`
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `Completed ${elapsedHours}h ago`
  const elapsedDays = Math.floor(elapsedHours / 24)
  return `Completed ${elapsedDays}d ago`
}

function ChecklistResponseCard({
  checklist,
  sectionId,
  site,
  auditType,
  categoryColor,
  now,
  onSaved,
}: {
  checklist: StationAuditChecklistItem
  sectionId: string
  site: string
  auditType: 'store' | 'visitor'
  categoryColor?: string
  now: number
  onSaved: (result: SaveStationAuditResponseResult, wasCompleted: boolean) => void
}) {
  const [statusOptionId, setStatusOptionId] = useState(checklist.response?.selectedStatus?.optionId || '')
  const [comment, setComment] = useState(checklist.response?.comment || '')
  const [photos, setPhotos] = useState(checklist.response?.photos || [])
  const [issueRaised, setIssueRaised] = useState(checklist.response?.issueRaised === true)
  const [requestOrder, setRequestOrder] = useState(checklist.response?.requestOrder === true)
  const [issueId, setIssueId] = useState(checklist.response?.issue || '')
  const [checked, setChecked] = useState(checklist.completed)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const [imagesOpen, setImagesOpen] = useState(false)
  const [resolutionQuestionOpen, setResolutionQuestionOpen] = useState(false)
  const [resolutionCommentOpen, setResolutionCommentOpen] = useState(false)
  const [resolutionComment, setResolutionComment] = useState('')

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

  async function saveChecked(nextChecked: boolean, issueAlreadyResolved = false, submittedResolutionComment = '') {
    if (checked || uploading || saving || !nextChecked) return
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
          requestOrder,
          issueAlreadyResolved,
          resolutionComment: submittedResolutionComment,
        },
      )
      setChecked(result.completed)
      setIssueRaised(result.response.issueRaised === true)
      setRequestOrder(result.response.requestOrder === true)
      setIssueId(result.issue?._id || result.response.issue || '')
      onSaved(result, wasCompleted)
      toast.success(result.orderQueued
        ? 'Order pushed to Order Rec for the store to complete.'
        : 'Checklist response saved.')
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'Unable to save this checklist response.')
    } finally {
      setSaving(false)
    }
  }

  function beginCompletion() {
    if (checked || uploading || saving) return
    if (checklist.followUp && !checklist.requestOrderEnabled && issueRaised) {
      setResolutionQuestionOpen(true)
      return
    }
    void saveChecked(true)
  }

  function submitResolvedIssue() {
    const comment = resolutionComment.trim()
    if (!comment) {
      toast.error('Add a brief comment explaining how the issue was resolved.')
      return
    }
    setResolutionCommentOpen(false)
    void saveChecked(true, true, comment)
  }

  return (
    <Card style={categoryColor ? { borderTopColor: categoryColor } : undefined} className={`flex h-full flex-col gap-0 border-0 border-t-4 py-0 transition-all hover:-translate-y-0.5 hover:shadow-md ${issueRaised ? 'bg-red-100/80' : requestOrder ? 'bg-blue-100/80' : checked ? 'bg-emerald-100/80' : 'border-t-slate-200'}`}>
      <CardHeader className="px-3 pb-1 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <CardTitle className="text-base sm:text-lg">{checklist.item}</CardTitle>
              {checklist.description && (
                <Button type="button" variant="ghost" size="icon" onClick={() => setDescriptionOpen(true)} aria-label="View checklist description" className="h-7 w-7 shrink-0 text-slate-500">
                  <Info className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {checked ? <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" /> : <CircleDashed className="h-6 w-6 shrink-0 text-slate-300" />}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-2.5 px-3 pb-3 pt-0">
        <div className="space-y-1.5">
          <Label htmlFor={`status-${checklist._id}`}>Status</Label>
          <Select value={statusOptionId} onValueChange={setStatusOptionId} disabled={saving || checked}>
            <SelectTrigger id={`status-${checklist._id}`} className="h-11 w-full bg-white"><SelectValue placeholder="Select a status" /></SelectTrigger>
            <SelectContent>
              {checklist.statusOptionSet.options.map((option) => <SelectItem key={option._id} value={option._id}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`comment-${checklist._id}`}>Comment {checklist.commentRequired && <span className="text-red-600">*</span>}</Label>
          <Textarea id={`comment-${checklist._id}`} value={comment} onChange={(event) => setComment(event.target.value)} disabled={saving || checked} maxLength={5000} rows={1} placeholder={checklist.commentRequired ? 'Comment required' : 'Add a comment (optional)'} className="h-10 min-h-10 resize-y bg-white py-2" />
        </div>

        <div className="flex flex-wrap gap-2">
          <label>
            <input type="file" accept="image/*" multiple className="hidden" onChange={uploadPhotos} disabled={checked || uploading || saving || photos.length >= 10} />
            <Button type="button" variant="outline" size="sm" asChild disabled={checked || uploading || saving || photos.length >= 10}>
              <span>{uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-1.5 h-4 w-4" />}{uploading ? 'Uploading' : 'Add images'}</span>
            </Button>
          </label>
          <Button type="button" variant="outline" size="sm" onClick={() => setImagesOpen(true)} disabled={photos.length === 0}>
            <Images className="mr-1.5 h-4 w-4" /> View images{photos.length > 0 ? ` (${photos.length})` : ''}
          </Button>
        </div>

        <div className="mt-auto flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          {checklist.requestOrderEnabled ? (
            <Button type="button" variant="outline" onClick={() => setRequestOrder((current) => !current)} disabled={checked || saving} aria-pressed={requestOrder} className={requestOrder ? 'border-blue-700 bg-blue-600 text-white hover:bg-blue-700 hover:text-white disabled:opacity-100' : ''}>
              <ShoppingCart className="mr-2 h-4 w-4" /> {requestOrder ? checked ? 'Order pushed' : 'Order will be created' : 'Create order'}
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => setIssueRaised((current) => !current)} disabled={checked || saving || Boolean(issueId)} aria-pressed={issueRaised} className={issueRaised ? 'border-red-700 bg-red-600 text-white hover:bg-red-700 hover:text-white disabled:opacity-100' : ''}>
              <AlertTriangle className="mr-2 h-4 w-4" /> {auditType === 'visitor'
                ? issueRaised && checked ? 'Issue recorded' : issueRaised ? 'Issue will be recorded' : 'Record issue'
                : issueId ? 'Issue created' : issueRaised ? 'Issue will be raised' : 'Raise issue'}
            </Button>
          )}
          <div className="flex min-h-11 items-center gap-3 rounded-lg border bg-white px-3">
            {saving ? <Loader2 className="h-5 w-5 animate-spin text-emerald-600" /> : <Checkbox id={`checked-${checklist._id}`} checked={checked} onCheckedChange={(value) => { if (value === true) beginCompletion() }} disabled={checked || uploading || saving} className="h-5 w-5" />}
            <Label htmlFor={`checked-${checklist._id}`} className={checked ? 'text-emerald-700' : 'cursor-pointer'}>{saving ? 'Saving…' : checked ? checkedTimeLabel(checklist.response?.checkedAt, now) : 'Mark complete'}</Label>
          </div>
        </div>

        {checklist.requestOrderEnabled && <div className="flex items-center gap-1 text-xs text-slate-500"><ShoppingCart className="h-3.5 w-3.5" /> {checklist.suppliesVendor}</div>}
      </CardContent>

      <Dialog open={descriptionOpen} onOpenChange={setDescriptionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{checklist.item}</DialogTitle></DialogHeader>
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{checklist.description}</p>
        </DialogContent>
      </Dialog>

      <Dialog open={imagesOpen} onOpenChange={setImagesOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Checklist images</DialogTitle></DialogHeader>
          <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
            {photos.map((photo) => (
              <div key={photo} className="group relative overflow-hidden rounded-lg border bg-slate-100">
                <img src={photoUrl(photo)} alt="Checklist attachment" className="max-h-[55vh] w-full object-contain" />
                {!checked && <button type="button" aria-label="Remove image" onClick={() => setPhotos((current) => current.filter((entry) => entry !== photo))} disabled={saving} className="absolute right-2 top-2 rounded-full bg-black/65 p-1.5 text-white hover:bg-black"><X className="h-4 w-4" /></button>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resolutionQuestionOpen} onOpenChange={setResolutionQuestionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Is this issue already resolved?</DialogTitle></DialogHeader>
          <p className="text-sm leading-6 text-slate-600">Is this issue already resolved and being raised only for record keeping?</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setResolutionQuestionOpen(false)
                void saveChecked(true)
              }}
            >
              No, keep it open
            </Button>
            <Button
              type="button"
              onClick={() => {
                setResolutionQuestionOpen(false)
                setResolutionCommentOpen(true)
              }}
            >
              Yes, already resolved
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resolutionCommentOpen} onOpenChange={setResolutionCommentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>How was this issue resolved?</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`resolution-${checklist._id}`}>Resolution comment</Label>
            <Textarea
              id={`resolution-${checklist._id}`}
              value={resolutionComment}
              onChange={(event) => setResolutionComment(event.target.value)}
              maxLength={5000}
              placeholder="Briefly explain what was done to resolve the issue"
              className="min-h-24 resize-y"
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setResolutionCommentOpen(false)}>Cancel</Button>
            <Button type="button" onClick={submitResolvedIssue} disabled={!resolutionComment.trim()}>Submit and complete</Button>
          </div>
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
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

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
  const progressState = !section || section.summary.completed === 0
    ? 'not-started'
    : section.summary.completed >= section.summary.total
      ? 'complete'
      : 'in-progress'
  const progressTheme = progressState === 'complete'
    ? {
        container: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white',
        bar: 'bg-emerald-500',
        text: 'text-emerald-700',
      }
    : progressState === 'in-progress'
      ? {
          container: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white',
          bar: 'bg-amber-500',
          text: 'text-amber-700',
        }
      : {
          container: 'border-red-200 bg-gradient-to-br from-red-50 to-white',
          bar: 'bg-red-500',
          text: 'text-red-700',
        }
  const sortedItems = useMemo(
    () => [...(section?.checklists || [])].sort((left, right) => {
      const completionDifference = Number(left.completed) - Number(right.completed)
      const frequencyDifference = frequency === 'all'
        ? frequencyOrder[left.frequency] - frequencyOrder[right.frequency]
        : 0

      return completionDifference
        || frequencyDifference
        || (left.sortOrder ?? 0) - (right.sortOrder ?? 0)
        || left.item.localeCompare(right.item, undefined, { sensitivity: 'base' })
    }),
    [frequency, section?.checklists],
  )
  const categoryColorMap = useMemo(() => {
    const categories = [...new Set((section?.checklists || [])
      .map((checklist) => checklist.category?.trim())
      .filter((category): category is string => Boolean(category)))]
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))

    return new Map(categories.map((category, index) => [category, categoryColors[index % categoryColors.length]]))
  }, [section?.checklists])
  const frequencyIndex = availableFrequencies.indexOf(frequency)

  function applySavedResponse(checklistId: string, result: SaveStationAuditResponseResult, wasCompleted: boolean) {
    const updateResponse = () => setData((current) => {
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
    const transitionDocument = document as Document & {
      startViewTransition?: (callback: () => void) => void
    }

    if (transitionDocument.startViewTransition) {
      transitionDocument.startViewTransition(() => flushSync(updateResponse))
    } else {
      updateResponse()
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-3 pb-10 sm:px-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" /> Sections</Button>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {categoryColorMap.size > 0 && (
            <div className="flex max-w-full flex-wrap justify-end gap-x-2.5 gap-y-1" aria-label="Checklist category legend">
              {[...categoryColorMap].map(([category, color]) => (
                <span key={category} className="inline-flex items-center gap-1 whitespace-nowrap text-[10px] text-slate-500">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  {category}
                </span>
              ))}
            </div>
          )}
          <SitePicker value={site} onValueChange={onSiteChange} className="h-10 w-52 sm:w-60" />
          <div className="flex h-10 items-center overflow-hidden rounded-md border bg-white" aria-label="Audit frequency">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-none"
              onClick={() => onFrequencyChange(availableFrequencies[(frequencyIndex - 1 + availableFrequencies.length) % availableFrequencies.length])}
              aria-label="Previous frequency"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-16 border-x px-2 text-center text-sm font-medium text-slate-700">{frequencyButtonLabels[frequency]}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-none"
              onClick={() => onFrequencyChange(availableFrequencies[(frequencyIndex + 1) % availableFrequencies.length])}
              aria-label="Next frequency"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {loading && <div className="flex min-h-60 items-center justify-center rounded-2xl border border-dashed bg-white"><Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-600" /> Loading checklist…</div>}
      {!loading && error && <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-red-700">{error}</div>}

      {!loading && !error && section && (
        <>
          <div className={`mb-4 rounded-2xl border px-4 py-3 shadow-sm transition-colors duration-500 ${progressTheme.container}`}>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{section.name}</h1>
              <div className="flex min-w-32 flex-1 items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/80"><div className={`h-full transition-[width,background-color] duration-500 ${progressTheme.bar}`} style={{ width: `${progress}%` }} /></div>
                <strong className={`text-sm ${progressTheme.text}`}>{progress}%</strong>
              </div>
              <Badge variant="outline" className="bg-white">{section.summary.pending} remaining</Badge>
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span><strong>Complete carefully:</strong> Once an item is marked complete, it cannot be updated. Add the status, comment, images, and issue information first.</span>
            </div>
          </div>

          {sortedItems.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">No {labels[frequency].toLowerCase()} items are assigned.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sortedItems.map((checklist) => (
                <div key={checklist._id} className="h-full" style={{ viewTransitionName: `audit-checklist-${checklist._id}` }}>
                  <ChecklistResponseCard
                    checklist={checklist}
                    sectionId={sectionId}
                    site={site!}
                    auditType={auditType}
                    categoryColor={categoryColorMap.get(checklist.category?.trim())}
                    now={now}
                    onSaved={(result, wasCompleted) => applySavedResponse(checklist._id, result, wasCompleted)}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
