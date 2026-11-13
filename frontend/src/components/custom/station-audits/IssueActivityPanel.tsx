import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  Camera,
  CheckCircle2,
  Clock3,
  History,
  ImagePlus,
  Images,
  Loader2,
  MessageSquareText,
  Send,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { auditTrackerService } from '@/api/audit-tracker/audit-tracker.service'
import type { AuditTrackerActivity } from '@/api/audit-tracker/audit-tracker.types'
import { cdnService } from '@/api/cdn/cdn.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { stationAuditPhotoUrl } from '@/lib/stationAuditPhotos'
import { hasAuditTrackerMyIssuesAction } from '@/lib/auditTrackerPermissions'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'

interface PendingImage {
  id: number
  file: File
  preview: string
}

export function IssueActivityPanel({ issueId }: { issueId: string }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [inputKey, setInputKey] = useState(0)
  const nextImageId = useRef(0)
  const pendingImagesRef = useRef<PendingImage[]>([])

  const activityQuery = useQuery({
    queryKey: ['audit-tracker', 'issue-activity', issueId],
    queryFn: () => auditTrackerService.issueActivities(issueId),
    enabled: Boolean(issueId),
  })

  const recentActivities = [...(activityQuery.data?.activities || [])].slice(-2).reverse()
  const mayPostComments = hasAuditTrackerMyIssuesAction(user?.access, 'postComments')

  const postMutation = useMutation({
    mutationFn: async () => {
      const photos = await Promise.all(pendingImages.map(async ({ file }) => {
        const form = new FormData()
        form.append('file', file)
        return (await cdnService.uploadAuditPhoto(form)).filename
      }))
      return auditTrackerService.addIssueActivity(issueId, { body: body.trim(), photos })
    },
    onSuccess: async () => {
      pendingImages.forEach((image) => URL.revokeObjectURL(image.preview))
      setPendingImages([])
      setBody('')
      setInputKey((value) => value + 1)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['audit-tracker', 'issue-activity', issueId] }),
        queryClient.invalidateQueries({ queryKey: ['audit-tracker', 'my-issues'] }),
      ])
      toast.success('Activity added to the issue')
    },
    onError: () => toast.error('Unable to add the activity. Please try again.'),
  })

  useEffect(() => {
    pendingImagesRef.current = pendingImages
  }, [pendingImages])

  useEffect(() => () => {
    pendingImagesRef.current.forEach((image) => URL.revokeObjectURL(image.preview))
  }, [])

  function addImages(files: FileList | null) {
    const selected = Array.from(files || []).filter((file) => file.type.startsWith('image/'))
    if (!selected.length) return
    setPendingImages((current) => [
      ...current,
      ...selected.slice(0, Math.max(0, 10 - current.length)).map((file) => ({
        id: ++nextImageId.current,
        file,
        preview: URL.createObjectURL(file),
      })),
    ])
  }

  function removeImage(id: number) {
    setPendingImages((current) => {
      const removed = current.find((image) => image.id === id)
      if (removed) URL.revokeObjectURL(removed.preview)
      return current.filter((image) => image.id !== id)
    })
  }

  const canPost = Boolean(body.trim() || pendingImages.length) && !postMutation.isPending

  return (
    <>
      <Card className="h-full overflow-y-auto p-4 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-violet-600" />
            <h3 className="text-sm font-bold text-slate-800">Tracker activity ({activityQuery.data?.total || 0})</h3>
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-violet-700" onClick={() => setOpen(true)}>
            View activity
          </Button>
        </div>
        <div className="mt-3">
          {activityQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading recent activity…</div>
          ) : recentActivities.length ? (
            <div className="space-y-3">
              {recentActivities.map((activity) => <ActivityEntry key={activity._id} activity={activity} compact />)}
            </div>
          ) : (
            <button type="button" onClick={() => setOpen(true)} className="w-full rounded-xl border border-dashed p-3 text-left text-sm text-slate-500 hover:border-violet-300 hover:bg-violet-50/40">
              {mayPostComments ? 'No tracker updates yet. Add the first comment or image.' : 'No tracker updates yet.'}
            </button>
          )}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[88vh] w-[calc(100vw-1rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
          <DialogHeader className="border-b px-4 py-4 pr-12 sm:px-6">
            <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5 text-violet-600" />Issue activity</DialogTitle>
            <DialogDescription>Comments, evidence, and issue changes are preserved in one timeline.</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-3 py-4 sm:px-6">
            {activityQuery.isLoading ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading activity…</div>
            ) : activityQuery.isError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Unable to load the issue activity.</div>
            ) : !activityQuery.data?.activities.length ? (
              <div className="flex h-full min-h-56 items-center justify-center text-center"><div><MessageSquareText className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">No tracker activity yet</p><p className="mt-1 text-xs text-slate-500">Start the conversation below.</p></div></div>
            ) : (
              <div className="space-y-3">
                {activityQuery.data.hasMore && <p className="text-center text-xs text-slate-500">Showing the latest 100 events.</p>}
                {activityQuery.data.activities.map((activity) => <ActivityEntry key={activity._id} activity={activity} />)}
              </div>
            )}
          </div>

          {mayPostComments && <div className="border-t bg-white p-3 sm:p-4">
            {pendingImages.length > 0 && (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {pendingImages.map((image) => (
                  <div key={image.id} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-slate-100">
                    <img src={image.preview} alt="Pending evidence" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => removeImage(image.id)} className="absolute right-1 top-1 rounded-full bg-slate-950/75 p-0.5 text-white"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Add a comment or describe the attached evidence…"
              maxLength={5000}
              className="min-h-16 resize-none"
              disabled={postMutation.isPending}
            />
            <div className="mt-2 flex items-center gap-2">
              <label>
                <Button type="button" variant="outline" size="sm" asChild disabled={postMutation.isPending}>
                  <span><Camera className="mr-1.5 h-4 w-4" />Camera</span>
                </Button>
                <input key={`camera-${inputKey}`} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => addImages(event.target.files)} />
              </label>
              <label>
                <Button type="button" variant="outline" size="sm" asChild disabled={postMutation.isPending}>
                  <span><ImagePlus className="mr-1.5 h-4 w-4" />Gallery</span>
                </Button>
                <input key={`gallery-${inputKey}`} type="file" accept="image/*" multiple className="hidden" onChange={(event) => addImages(event.target.files)} />
              </label>
              <Button size="sm" className="ml-auto" disabled={!canPost} onClick={() => postMutation.mutate()}>
                {postMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                Post
              </Button>
            </div>
          </div>}
        </DialogContent>
      </Dialog>
    </>
  )
}

export function ActivityEntry({ activity, compact = false }: { activity: AuditTrackerActivity; compact?: boolean }) {
  const metadata = activityMetadata(activity)
  const photos = activity.photos || []
  const changeLabels = activityChangeLabels(activity)
  return (
    <div className={cn('rounded-xl border bg-white', compact ? 'p-3' : 'p-4 shadow-sm')}>
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 rounded-full p-2', metadata.iconClass)}>{metadata.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold text-slate-800">{actorName(activity)} {metadata.label}</p>
            <span className="text-[11px] text-slate-400">{formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}</span>
          </div>
          {activity.body && <p className={cn('mt-1 whitespace-pre-wrap text-sm leading-5 text-slate-600', compact && 'line-clamp-2')}>{activity.body}</p>}
          {changeLabels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {changeLabels.map((label, index) => (
                <Badge key={`${activity.eventType}-${index}`} variant="secondary" className="h-auto whitespace-normal py-1 text-left font-normal">
                  {label}
                </Badge>
              ))}
            </div>
          )}
          {photos.length > 0 && (
            <div className={cn('mt-3 grid gap-2', compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4')}>
              {photos.slice(0, compact ? 3 : photos.length).map((photo, index) => {
                const source = stationAuditPhotoUrl(photo)
                return <a key={`${photo}-${index}`} href={source} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border bg-slate-100"><img src={source} alt={`Activity attachment ${index + 1}`} className="aspect-square h-full w-full object-cover" /></a>
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function activityMetadata(activity: AuditTrackerActivity) {
  switch (activity.eventType) {
    case 'issue_raised':
      return { label: 'raised this issue', icon: <History className="h-4 w-4" />, iconClass: 'bg-rose-100 text-rose-700' }
    case 'comment_added':
      return { label: 'added a comment', icon: <MessageSquareText className="h-4 w-4" />, iconClass: 'bg-violet-100 text-violet-700' }
    case 'photos_added':
      return { label: `added ${activity.photos?.length === 1 ? 'an image' : `${activity.photos?.length || 0} images`}`, icon: <Images className="h-4 w-4" />, iconClass: 'bg-blue-100 text-blue-700' }
    case 'status_changed':
      return { label: 'changed the issue status', icon: <History className="h-4 w-4" />, iconClass: 'bg-blue-100 text-blue-700' }
    case 'priority_changed':
      return { label: 'changed the issue priority', icon: <History className="h-4 w-4" />, iconClass: 'bg-orange-100 text-orange-700' }
    case 'assignment_changed':
      return { label: 'changed the assignment', icon: <History className="h-4 w-4" />, iconClass: 'bg-cyan-100 text-cyan-700' }
    case 'department_changed':
      return { label: 'transferred the issue', icon: <History className="h-4 w-4" />, iconClass: 'bg-indigo-100 text-indigo-700' }
    case 'escalated':
      return { label: 'escalated the issue', icon: <History className="h-4 w-4" />, iconClass: 'bg-amber-100 text-amber-700' }
    case 'resolved':
      return { label: 'resolved the issue', icon: <CheckCircle2 className="h-4 w-4" />, iconClass: 'bg-emerald-100 text-emerald-700' }
    case 'reopened':
      return { label: 'reopened the issue', icon: <History className="h-4 w-4" />, iconClass: 'bg-fuchsia-100 text-fuchsia-700' }
  }
}

function actorName(activity: AuditTrackerActivity) {
  if (!activity.actor) return 'System'
  return `${activity.actor.firstName || ''} ${activity.actor.lastName || ''}`.trim() || activity.actor.email || 'Unknown user'
}

function activityChangeLabels(activity: AuditTrackerActivity) {
  return (activity.changes || []).map((change) => {
    const from = change.from?.label || change.from?.value || ''
    const to = change.to?.label || change.to?.value || ''

    if (activity.eventType === 'issue_raised') {
      if (change.field === 'department') return `Department: ${to || 'Not assigned'}`
      if (change.field === 'assignees') return `Initially assigned to: ${to || 'No one'}`
      if (change.field === 'status') return `Status: ${to || 'Created'}`
    }

    if (change.field === 'assignees') {
      if (from && to) return `Reassigned from ${from} to ${to}`
      if (to) return `Assigned to ${to}`
      return `Removed ${from || 'the previous assignee'}`
    }
    if (change.field === 'department') {
      if (from && to) return `Department: ${from} → ${to}`
      return `Department: ${to || from || 'Not assigned'}`
    }
    if (change.field === 'status') return `Status: ${from ? `${from} → ` : ''}${to || 'Not set'}`
    if (change.field === 'priority') return `Priority: ${from ? `${from} → ` : ''}${to || 'Not set'}`
    if (change.field === 'escalation' || change.field === 'escalationLevel') {
      return `Escalation: ${from ? `${from} → ` : ''}${to || 'Not set'}`
    }

    const field = change.field.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ')
    return `${field.charAt(0).toUpperCase() + field.slice(1)}: ${from ? `${from} → ` : ''}${to || 'Not set'}`
  })
}
