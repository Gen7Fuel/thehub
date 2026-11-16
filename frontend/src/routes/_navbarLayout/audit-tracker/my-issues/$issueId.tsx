import { useEffect, useState } from 'react'
import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { auditTrackerService } from '@/api/audit-tracker/audit-tracker.service'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { hasAuditTrackerAccess, hasAuditTrackerPermission } from '@/lib/auditTrackerPermissions'
import { IssueDetail } from './index'

export const Route = createFileRoute('/_navbarLayout/audit-tracker/my-issues/$issueId')({
  component: MyIssueDetailPage,
})

function MyIssueDetailPage() {
  const { issueId } = Route.useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'details' | 'history'>('details')
  const allowed = Boolean(
    user
    && hasAuditTrackerAccess(user.access)
    && hasAuditTrackerPermission(user.access, 'myIssues'),
  )
  const query = useQuery({
    queryKey: ['audit-tracker', 'my-issue', issueId],
    queryFn: () => auditTrackerService.myIssue(issueId),
    enabled: allowed,
  })

  useEffect(() => {
    if (query.data?.issue) {
      queryClient.invalidateQueries({ queryKey: ['audit-tracker', 'my-issues'] })
      queryClient.invalidateQueries({ queryKey: ['audit-tracker', 'issue-activity', issueId] })
    }
  }, [issueId, query.data?.issue, queryClient])

  if (!user) return null
  if (!allowed) return <Navigate to="/no-access" replace />

  if (query.isLoading) {
    return <div className="mx-auto flex min-h-[60vh] max-w-[1500px] items-center justify-center gap-2 px-4 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-violet-600" />Opening issue…</div>
  }
  if (query.isError || !query.data?.issue) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Card className="p-8 text-center">
          <AlertTriangle className="mx-auto h-9 w-9 text-amber-500" />
          <h1 className="mt-3 text-lg font-bold text-slate-900">Issue unavailable</h1>
          <p className="mt-1 text-sm text-slate-500">This issue may be resolved, reassigned, or outside your accessible sites.</p>
          <Button className="mt-5" onClick={() => navigate({ to: '/audit-tracker/my-issues' })}>Back to My Issues</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-3 pb-10 sm:px-5 lg:px-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 shadow-sm">
        <IssueDetail
          issue={query.data.issue}
          tab={tab}
          onTabChange={setTab}
          onBack={() => navigate({ to: '/audit-tracker/my-issues' })}
        />
      </section>
    </div>
  )
}
