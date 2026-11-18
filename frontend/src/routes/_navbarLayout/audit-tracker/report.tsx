import { createFileRoute, Navigate, Outlet } from '@tanstack/react-router'
import { useAuth } from '@/context/AuthContext'
import { hasAuditTrackerAccess, hasAuditTrackerPermission } from '@/lib/auditTrackerPermissions'

export const Route = createFileRoute('/_navbarLayout/audit-tracker/report')({
  component: AuditTrackerReportLayout,
})

function AuditTrackerReportLayout() {
  const { user } = useAuth()
  if (!user) return null
  if (!hasAuditTrackerAccess(user.access) || !hasAuditTrackerPermission(user.access, 'report')) {
    return <Navigate to="/no-access" replace />
  }
  return <Outlet />
}
