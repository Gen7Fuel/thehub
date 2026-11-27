import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Building2, Loader2, RefreshCw, Search, ShieldAlert, UsersRound } from 'lucide-react'
import { toast } from 'sonner'
import { auditTrackerService } from '@/api/audit-tracker/audit-tracker.service'
import type { AuditTrackerIssue, AuditTrackerIssueStatus } from '@/api/audit-tracker/audit-tracker.types'
import { isApiError } from '@/api/core/errors'
import { useAuth } from '@/context/AuthContext'
import { hasAuditTrackerDepartmentIssuesAction, hasAuditTrackerMyIssuesAction } from '@/lib/auditTrackerPermissions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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

export function IssueActionDialogs({ issue, scope = 'myIssues' }: { issue: AuditTrackerIssue; scope?: 'myIssues' | 'departmentIssues' }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [statusOpen, setStatusOpen] = useState(false)
  const [escalationOpen, setEscalationOpen] = useState(false)
  const [nextStatus, setNextStatus] = useState('')
  const [statusComment, setStatusComment] = useState('')
  const [escalationReason, setEscalationReason] = useState('')
  const [priorityOpen, setPriorityOpen] = useState(false)
  const [nextPriority, setNextPriority] = useState('')
  const [departmentOpen, setDepartmentOpen] = useState(false)
  const [departmentConfirmOpen, setDepartmentConfirmOpen] = useState(false)
  const [departmentSearch, setDepartmentSearch] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [departmentComment, setDepartmentComment] = useState('')
  const [escalatedInSession, setEscalatedInSession] = useState(false)

  const availableStatuses = transitions[issue.status as Exclude<AuditTrackerIssueStatus, 'resolved'>] || []
  const mayUpdateStatus = scope === 'departmentIssues'
    ? hasAuditTrackerDepartmentIssuesAction(user?.access, 'updateStatus')
    : hasAuditTrackerMyIssuesAction(user?.access, 'updateStatus')
  const mayEscalateIssue = scope === 'myIssues' && hasAuditTrackerMyIssuesAction(user?.access, 'escalateIssue')
  const mayChangePriority = scope === 'departmentIssues' && hasAuditTrackerDepartmentIssuesAction(user?.access, 'changePriority')
  const mayChangeDepartment = scope === 'departmentIssues' && hasAuditTrackerDepartmentIssuesAction(user?.access, 'changeDepartment')
  const alreadyEscalated = escalatedInSession || Boolean(issue.escalation?.level && issue.escalation.level !== 'none')
  const escalationQuery = useQuery({
    queryKey: ['audit-tracker', 'escalation-target', issue._id],
    queryFn: () => auditTrackerService.escalationTarget(issue._id),
    enabled: escalationOpen && mayEscalateIssue && !alreadyEscalated,
    retry: false,
  })
  const departmentQuery = useQuery({
    queryKey: ['audit-tracker', 'department-issue-options', issue._id],
    queryFn: () => auditTrackerService.departmentOptions(issue._id),
    enabled: departmentOpen && mayChangeDepartment,
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
      queryClient.invalidateQueries({ queryKey: ['audit-tracker', scope === 'departmentIssues' ? 'department-issues' : 'my-issues'] }),
      queryClient.invalidateQueries({ queryKey: ['audit-tracker', scope === 'departmentIssues' ? 'department-issue' : 'my-issue', issue._id] }),
      queryClient.invalidateQueries({ queryKey: ['audit-tracker', scope, 'issue-activity', issue._id] }),
      queryClient.invalidateQueries({ queryKey: ['audit-tracker', 'escalation-target', issue._id] }),
    ])
  }

  const statusMutation = useMutation({
    mutationFn: () => scope === 'departmentIssues'
      ? auditTrackerService.updateDepartmentIssueStatus(issue._id, { status: nextStatus, comment: statusComment.trim() })
      : auditTrackerService.updateIssueStatus(issue._id, { status: nextStatus, comment: statusComment.trim() }),
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
      setEscalatedInSession(true)
      setEscalationOpen(false)
      await refreshIssue()
      toast.success(destination ? `Issue escalated to ${destination}` : 'Issue escalated')
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Unable to escalate the issue.'),
  })
  const priorityMutation = useMutation({
    mutationFn: () => auditTrackerService.updateDepartmentIssuePriority(issue._id, nextPriority),
    onSuccess: async () => {
      setPriorityOpen(false)
      await refreshIssue()
      toast.success('Issue priority updated')
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Unable to update the issue priority.'),
  })
  const departmentMutation = useMutation({
    mutationFn: () => auditTrackerService.changeDepartmentIssueDepartment(issue._id, { department: selectedDepartment, comment: departmentComment.trim() }),
    onSuccess: async () => {
      setDepartmentConfirmOpen(false)
      setDepartmentOpen(false)
      await refreshIssue()
      toast.success('Issue transferred to the new department')
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Unable to change the issue department.'),
  })

  const resolutionCommentRequired = nextStatus === 'resolved'
  const canUpdateStatus = Boolean(nextStatus) && (!resolutionCommentRequired || Boolean(statusComment.trim())) && !statusMutation.isPending
  const canEscalate = Boolean(escalationQuery.data && escalationReason.trim()) && !escalationMutation.isPending
  const selectedDepartmentOption = departmentQuery.data?.departments.find((department) => department._id === selectedDepartment)
  const filteredDepartments = (departmentQuery.data?.departments || []).filter((department) => !department.current && department.name.toLowerCase().includes(departmentSearch.trim().toLowerCase()))

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        {mayUpdateStatus && <Button variant="outline" size="sm" onClick={() => setStatusOpen(true)}>
          <RefreshCw className="mr-1.5 h-4 w-4" />Update status
        </Button>}
        {mayChangeDepartment && <Button variant="outline" size="sm" onClick={() => { setSelectedDepartment(''); setDepartmentSearch(''); setDepartmentComment(''); setDepartmentOpen(true) }}>
          <Building2 className="mr-1.5 h-4 w-4" />Change department
        </Button>}
        {mayChangePriority && <Button variant="outline" size="sm" onClick={() => { setNextPriority(issue.priority); setPriorityOpen(true) }}>
          <ShieldAlert className="mr-1.5 h-4 w-4" />Change priority
        </Button>}
        {mayEscalateIssue && <Button variant="outline" size="sm" disabled={alreadyEscalated} title={alreadyEscalated ? 'This issue has already been escalated' : undefined} className="border-amber-200 text-amber-800 hover:bg-amber-50" onClick={() => setEscalationOpen(true)}>
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

      <Dialog open={priorityOpen} onOpenChange={setPriorityOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Change issue priority</DialogTitle><DialogDescription>Choose how urgently this issue should be handled.</DialogDescription></DialogHeader>
          <div className="space-y-2 py-2"><Label>Priority</Label><Select value={nextPriority} onValueChange={setNextPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent></Select></div>
          <DialogFooter><Button variant="outline" onClick={() => setPriorityOpen(false)}>Cancel</Button><Button disabled={!nextPriority || nextPriority === issue.priority || priorityMutation.isPending} onClick={() => priorityMutation.mutate()}>{priorityMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update priority</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={departmentOpen} onOpenChange={(open) => { if (!departmentMutation.isPending) setDepartmentOpen(open) }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Change responsible department</DialogTitle><DialogDescription>Select the department that should take ownership of this issue.</DialogDescription></DialogHeader>
          <Alert><ShieldAlert className="h-4 w-4" /><AlertTitle>Ownership will be replaced</AlertTitle><AlertDescription>Changing department removes every current assignee. The selected department’s active default assignees will become the new assigned team.</AlertDescription></Alert>
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={departmentSearch} onChange={(event) => setDepartmentSearch(event.target.value)} placeholder="Search departments…" className="pl-9" /></div>
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border p-2">
            {departmentQuery.isLoading ? <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading departments…</div> : filteredDepartments.map((department) => <button type="button" key={department._id} onClick={() => setSelectedDepartment(department._id)} className={`w-full rounded-lg border p-3 text-left transition ${selectedDepartment === department._id ? 'border-violet-500 bg-violet-50' : 'hover:bg-slate-50'}`}><p className="font-semibold text-slate-900">{department.name}</p><p className="mt-1 text-xs text-slate-500">Assignee: {department.assignees.length ? department.assignees.map(personName).join(', ') : 'No active assignee available'}</p></button>)}
            {!departmentQuery.isLoading && filteredDepartments.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No departments match your search.</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDepartmentOpen(false)}>Cancel</Button><Button disabled={!selectedDepartment || !selectedDepartmentOption?.assignees.length} onClick={() => setDepartmentConfirmOpen(true)}>Continue</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={departmentConfirmOpen} onOpenChange={(open) => { if (!departmentMutation.isPending) setDepartmentConfirmOpen(open) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Confirm department change</DialogTitle><DialogDescription>Transfer this issue to {selectedDepartmentOption?.name || 'the selected department'}.</DialogDescription></DialogHeader>
          <Alert><ShieldAlert className="h-4 w-4" /><AlertTitle>Notifications and assignment will move</AlertTitle><AlertDescription>The current department head and assignees will stop receiving future notifications. The new department head and assigned users will receive future issue updates.</AlertDescription></Alert>
          <div className="rounded-xl border bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">New assignee</p><p className="mt-1 text-sm font-semibold">{selectedDepartmentOption?.assignees.map(personName).join(', ') || 'No assignee'}</p></div>
          <div className="space-y-2"><Label>Reason for department change</Label><Textarea value={departmentComment} onChange={(event) => setDepartmentComment(event.target.value)} maxLength={5000} placeholder="Explain why this department is receiving the issue…" /><p className="text-xs text-amber-700">A comment is required and will be recorded in the activity timeline.</p></div>
          <DialogFooter><Button variant="outline" disabled={departmentMutation.isPending} onClick={() => setDepartmentConfirmOpen(false)}>Go back</Button><Button disabled={!departmentComment.trim() || departmentMutation.isPending} onClick={() => departmentMutation.mutate()}>{departmentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm transfer</Button></DialogFooter>
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
