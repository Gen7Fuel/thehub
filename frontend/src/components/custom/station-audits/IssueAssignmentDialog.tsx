import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Search, ShieldAlert, Trash2, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { auditTrackerService } from '@/api/audit-tracker/audit-tracker.service'
import type { AuditTrackerAssignmentCandidate, AuditTrackerIssue } from '@/api/audit-tracker/audit-tracker.types'
import { isApiError } from '@/api/core/errors'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type Assignment = { user: string; role: 'owner' | 'collaborator'; person: AuditTrackerAssignmentCandidate }
type Stage = 'edit' | 'add' | 'preview'

export function IssueAssignmentDialog({ issue }: { issue: AuditTrackerIssue }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<Stage>('edit')
  const [group, setGroup] = useState<'current' | 'other'>('current')
  const [search, setSearch] = useState('')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const optionsQuery = useQuery({
    queryKey: ['audit-tracker', 'department-assignment-options', issue._id],
    queryFn: () => auditTrackerService.assignmentOptions(issue._id),
    enabled: open,
  })

  useEffect(() => {
    if (!open || !optionsQuery.data) return
    const byId = new Map(optionsQuery.data.users.map((user) => [user._id, user]))
    setAssignments(issue.assignees.map((assignment) => ({
      user: assignment.user._id,
      role: assignment.role,
      person: byId.get(assignment.user._id) || { ...assignment.user, departments: [] },
    })))
  }, [issue.assignees, open, optionsQuery.data])

  const mutation = useMutation({
    mutationFn: () => auditTrackerService.changeDepartmentIssueAssignments(issue._id, assignments.map(({ user, role }) => ({ user, role }))),
    onSuccess: async () => {
      setOpen(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['audit-tracker', 'department-issues'] }),
        queryClient.invalidateQueries({ queryKey: ['audit-tracker', 'department-issue', issue._id] }),
        queryClient.invalidateQueries({ queryKey: ['audit-tracker', 'departmentIssues', 'issue-activity', issue._id] }),
      ])
      toast.success('Issue assignment updated')
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Unable to update the issue assignment.'),
  })

  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (optionsQuery.data?.users || []).filter((user) => {
      const inCurrent = user.departments.some((department) => department.current)
      if ((group === 'current') !== inCurrent) return false
      return `${user.firstName} ${user.lastName} ${user.email} ${user.departments.map((department) => department.name).join(' ')}`.toLowerCase().includes(term)
    })
  }, [group, optionsQuery.data?.users, search])
  const ownerCount = assignments.filter((assignment) => assignment.role === 'owner').length
  const hasOutsideCollaborators = assignments.some((assignment) => !assignment.person.departments.some((department) => department.current))

  function openDialog() {
    setStage('edit'); setGroup('current'); setSearch(''); setOpen(true)
  }
  function makeOwner(userId: string) {
    setAssignments((current) => current.map((assignment) => ({ ...assignment, role: assignment.user === userId ? 'owner' : 'collaborator' })))
  }
  function addUser(user: AuditTrackerAssignmentCandidate) {
    setAssignments((current) => current.some((assignment) => assignment.user === user._id)
      ? current
      : [...current, { user: user._id, role: 'collaborator', person: user }])
  }

  return <>
    <Button type="button" size="sm" variant="outline" onClick={openDialog}><UserCog className="mr-1.5 h-4 w-4" />Change assignment</Button>
    <Dialog open={open} onOpenChange={(value) => { if (!mutation.isPending) setOpen(value) }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {stage === 'edit' && <>
          <DialogHeader><DialogTitle>Assigned team</DialogTitle><DialogDescription>Choose one owner and any number of collaborators.</DialogDescription></DialogHeader>
          <div className="space-y-2">
            {assignments.map((assignment) => <div key={assignment.user} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{personName(assignment.person)}</p><p className="text-xs text-slate-500">{assignment.person.email}</p></div><div className="flex items-center gap-2"><Button type="button" size="sm" variant={assignment.role === 'owner' ? 'default' : 'outline'} onClick={() => makeOwner(assignment.user)}>{assignment.role === 'owner' ? 'Owner' : 'Make owner'}</Button>{assignment.role === 'collaborator' && <Badge variant="secondary">Collaborator</Badge>}<Button type="button" size="icon" variant="ghost" aria-label={`Remove ${personName(assignment.person)}`} onClick={() => setAssignments((current) => current.filter((entry) => entry.user !== assignment.user))}><Trash2 className="h-4 w-4 text-rose-600" /></Button></div></div>)}
            {!assignments.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">No users selected.</p>}
          </div>
          {ownerCount !== 1 && <p className="text-sm font-medium text-rose-600">Exactly one owner is required before previewing the change.</p>}
          <DialogFooter className="gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="button" variant="outline" onClick={() => { setStage('add'); setSearch('') }}><Plus className="mr-1.5 h-4 w-4" />Add user</Button><Button type="button" disabled={!assignments.length || ownerCount !== 1} onClick={() => setStage('preview')}>Preview changes</Button></DialogFooter>
        </>}

        {stage === 'add' && <>
          <DialogHeader><DialogTitle>Add an assignee</DialogTitle><DialogDescription>Only active department users with access to this issue’s site are available.</DialogDescription></DialogHeader>
          <div className="flex overflow-hidden rounded-xl border bg-white p-1"><button type="button" onClick={() => setGroup('current')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${group === 'current' ? 'bg-violet-600 text-white' : 'text-slate-600'}`}>Current department</button><button type="button" onClick={() => setGroup('other')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${group === 'other' ? 'bg-violet-600 text-white' : 'text-slate-600'}`}>Other department</button></div>
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users or departments…" className="pl-9" /></div>
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border p-2">{optionsQuery.isLoading ? <div className="flex justify-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading eligible users…</div> : candidates.map((user) => { const selected = assignments.some((assignment) => assignment.user === user._id); return <button type="button" key={user._id} disabled={selected} onClick={() => addUser(user)} className="flex w-full items-center justify-between rounded-lg p-3 text-left hover:bg-slate-50 disabled:opacity-50"><span><strong className="block text-sm">{personName(user)}</strong><span className="block text-xs text-slate-500">{user.email} · {user.departments.map((department) => department.name).join(', ')}</span></span><span className="text-xs font-semibold text-violet-700">{selected ? 'Added' : 'Add'}</span></button>})}{!optionsQuery.isLoading && !candidates.length && <p className="p-8 text-center text-sm text-slate-500">No eligible users found.</p>}</div>
          <DialogFooter><Button type="button" onClick={() => setStage('edit')}>Done adding</Button></DialogFooter>
        </>}

        {stage === 'preview' && <>
          <DialogHeader><DialogTitle>Preview assignment change</DialogTitle><DialogDescription>Confirm the new owner and collaborators before notifying them.</DialogDescription></DialogHeader>
          {hasOutsideCollaborators && <Alert><ShieldAlert className="h-4 w-4" /><AlertTitle>Cross-department collaboration</AlertTitle><AlertDescription>One or more selected users belong outside the current department. They will gain access to this issue through assignment and will be notified.</AlertDescription></Alert>}
          <div className="space-y-2">{assignments.map((assignment) => <div key={assignment.user} className="flex items-center justify-between rounded-xl border p-3"><div><p className="font-semibold">{personName(assignment.person)}</p><p className="text-xs text-slate-500">{assignment.person.email}</p></div><Badge variant={assignment.role === 'owner' ? 'default' : 'secondary'} className="capitalize">{assignment.role}</Badge></div>)}</div>
          <Alert><ShieldAlert className="h-4 w-4" /><AlertTitle>New users will be notified</AlertTitle><AlertDescription>Users newly added to this issue will receive an assignment notification. Removed users will stop receiving assignee notifications.</AlertDescription></Alert>
          <DialogFooter><Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setStage('edit')}>Go back</Button><Button type="button" disabled={mutation.isPending || ownerCount !== 1} onClick={() => mutation.mutate()}>{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm assignment</Button></DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
  </>
}

function personName(person: { firstName?: string; lastName?: string; email?: string }) {
  return `${person.firstName || ''} ${person.lastName || ''}`.trim() || person.email || 'Unknown user'
}
