import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useAuth } from '@/context/AuthContext'
import {
  hasAuditTrackerAccess,
  hasAuditTrackerPermission,
} from '@/lib/auditTrackerPermissions'

export const Route = createFileRoute('/_navbarLayout/audit-tracker/')({
  component: AuditTrackerIndex,
})

function AuditTrackerIndex() {
  const { user } = useAuth()
  if (!user) return null

  const access = user.access
  if (!hasAuditTrackerAccess(access)) return <Navigate to="/no-access" replace />
  if (hasAuditTrackerPermission(access, 'myIssues')) {
    return <Navigate to="/audit-tracker/my-issues" replace />
  }
  if (hasAuditTrackerPermission(access, 'departmentIssues')) {
    return <Navigate to="/audit-tracker/department-issues" replace />
  }
  if (hasAuditTrackerPermission(access, 'report')) {
    return <Navigate to="/audit-tracker/report" replace />
  }
  return <Navigate to="/no-access" replace />
}
