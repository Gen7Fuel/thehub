import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Building2, Loader2, RefreshCw, ShieldAlert, UsersRound } from 'lucide-react'
import { toast } from 'sonner'
import { auditTrackerService } from '@/api/audit-tracker/audit-tracker.service'
import type { AuditTrackerIssue, AuditTrackerIssueStatus } from '@/api/audit-tracker/audit-tracker.types'
import { isApiError } from '@/api/core/errors'
import { useAuth } from '@/context/AuthContext'
import { hasAuditTrackerMyIssuesAction } from '@/lib/auditTrackerPermissions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const transitions: Record<Exclude<AuditTrackerIssueStatus, 'resolved'>, Array<Exclude<AuditTrackerIssueStatus, 'created'>>> = {
  created: ['in_progress', 'on_hold'],
  in_progress: ['on_hold', 'resolved'],
  on_hold: ['in_progress'],
}

const statusLabels: Record<AuditTrackerIssueStatus, string> = {
  created: 'Created',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  resolved: 'Resolved',
}

export function IssueActionDialogs({ issue }: { issue: AuditTrackerIssue }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [statusOpen, setStatusOpen] = useState(false)
  const [escalationOpen, setEscalationOpen] = useState(false)
  const [nextStatus, setNextStatus] = useState('')
  const [statusComment, setStatusComment] = useState('')
  const [escalationReason, setEscalationReason] = useState('')

  const availableStatuses = transitions[issue.status as Exclude<AuditTrackerIssueStatus, 'resolved'>] || []
  const mayUpdateStatus = hasAuditTrackerMyIssuesAction(user?.access, 'updateStatus')
  const mayEscalateIssue = hasAuditTrackerMyIssuesAction(user?.access, 'escalateIssue')
  const escalationQuery = useQuery({
    queryKey: ['audit-tracker', 'escalation-target', issue._id],
    queryFn: () => auditTrackerService.escalationTarget(issue._id),
    enabled: escalationOpen && mayEscalateIssue,
    retry: false,
  })

  useEffect(() => {
    if (!statusOpen) {
      setNextStatus('')
      setStatusComment('')
    }
  }, [statusOpen])

  useEffect(() => {
    if (!escalationOpen) setEscalationReason('')
  }, [escalationOpen])

  async function refreshIssue() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['audit-tracker', 'my-issues'] }),
      queryClient.invalidateQueries({ queryKey: ['audit-tracker', 'issue-activity', issue._id] }),
      queryClient.invalidateQueries({ queryKey: ['audit-tracker', 'escalation-target', issue._id] }),
    ])
  }

  const statusMutation = useMutation({
    mutationFn: () => auditTrackerService.updateIssueStatus(issue._id, { status: nextStatus, comment: statusComment.trim() }),
    onSuccess: async () => {
      setStatusOpen(false)
      await refreshIssue()
      toast.success(`Issue moved to ${statusLabels[nextStatus as AuditTrackerIssueStatus]}`)
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Unable to update the issue status.'),
  })

  const escalationMutation = useMutation({
    mutationFn: () => auditTrackerService.escalateIssue(issue._id, { reason: escalationReason.trim() }),
    onSuccess: async (_, __, ___) => {
      const destination = escalationQuery.data?.department.name
      setEscalationOpen(false)
      await refreshIssue()
      toast.success(destination ? `Issue escalated to ${destination}` : 'Issue escalated')
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Unable to escalate the issue.'),
  })

  const resolutionCommentRequired = nextStatus === 'resolved'
  const canUpdateStatus = Boolean(nextStatus) && (!resolutionCommentRequired || Boolean(statusComment.trim())) && !statusMutation.isPending
  const canEscalate = Boolean(escalationQuery.data && escalationReason.trim()) && !escalationMutation.isPending

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        {mayUpdateStatus && <Button variant="outline" size="sm" onClick={() => setStatusOpen(true)}>
          <RefreshCw className="mr-1.5 h-4 w-4" />Update status
        </Button>}
        {mayEscalateIssue && <Button variant="outline" size="sm" className="border-amber-200 text-amber-800 hover:bg-amber-50" onClick={() => setEscalationOpen(true)}>
          <ArrowUpRight className="mr-1.5 h-4 w-4" />Escalate
        </Button>}
      </div>

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Update issue status</DialogTitle>
            <DialogDescription>The current status is {statusLabels[issue.status]}. Only valid next steps are available.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>New status</Label>
              <Select value={nextStatus} onValueChange={setNextStatus}>
                <SelectTrigger><SelectValue placeholder="Select the next status" /></SelectTrigger>
                <SelectContent>
                  {availableStatuses.map((status) => <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{resolutionCommentRequired ? 'Resolution comment' : 'Comment (optional)'}</Label>
              <Textarea
                value={statusComment}
                onChange={(event) => setStatusComment(event.target.value)}
                placeholder={resolutionCommentRequired ? 'Explain how this issue was resolved…' : 'Add context for this status change…'}
                maxLength={5000}
                className="min-h-24"
              />
              {resolutionCommentRequired && <p className="text-xs text-amber-700">A resolution comment is required and will be preserved in the activity log.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>Cancel</Button>
            <Button disabled={!canUpdateStatus} onClick={() => statusMutation.mutate()}>
              {statusMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={escalationOpen} onOpenChange={setEscalationOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm issue escalation</DialogTitle>
            <DialogDescription>Escalating changes both the responsible department and the assigned users.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {escalationQuery.isLoading ? (
              <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Finding the escalation department…</div>
            ) : escalationQuery.isError ? (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Escalation unavailable</AlertTitle>
                <AlertDescription>{isApiError(escalationQuery.error) ? escalationQuery.error.message : 'There is no escalation department available for this issue. Contact an administrator for more details.'}</AlertDescription>
              </Alert>
            ) : escalationQuery.data ? (
              <>
                <Alert>
                  <Building2 className="h-4 w-4" />
                  <AlertTitle>{escalationQuery.data.department.name}</AlertTitle>
                  <AlertDescription>{escalationQuery.data.department.isAdminDepartment ? 'Active Head Office admin department' : 'Configured escalation department'}</AlertDescription>
                </Alert>
                <div className="rounded-xl border bg-slate-50 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><UsersRound className="h-4 w-4" />New assignees</p>
                  <div className="mt-2 space-y-1">
                    {escalationQuery.data.assignees.map((assignee) => <p key={assignee._id} className="text-sm font-medium text-slate-800">{personName(assignee)} <span className="font-normal text-slate-500">· {assignee.email}</span></p>)}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Escalation reason</Label>
                  <Textarea value={escalationReason} onChange={(event) => setEscalationReason(event.target.value)} placeholder="Add context for the receiving department…" maxLength={5000} />
                  <p className="text-xs text-amber-700">Required so the receiving department understands why this issue was escalated.</p>
                </div>
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalationOpen(false)}>Cancel</Button>
            <Button className="bg-amber-600 hover:bg-amber-700" disabled={!canEscalate} onClick={() => escalationMutation.mutate()}>
              {escalationMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm escalation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function personName(person: { firstName?: string; lastName?: string; email?: string }) {
  return `${person.firstName || ''} ${person.lastName || ''}`.trim() || person.email || 'Unknown user'
}
