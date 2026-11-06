import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useAuth } from '@/context/AuthContext'
import { hasAuditManagerAccess, hasAuditManagerPermission } from '@/lib/auditManagerPermissions'

export const Route = createFileRoute('/_navbarLayout/audit-manager/')({
  component: AuditManagerIndex,
})

function AuditManagerIndex() {
  const { user } = useAuth()
  if (!user) return null

  const access = user.access
  if (!hasAuditManagerAccess(access)) return <Navigate to="/no-access" replace />
  if (hasAuditManagerPermission(access, 'checklist')) return <Navigate to="/audit-manager/checklist" replace />
  if (hasAuditManagerPermission(access, 'section')) return <Navigate to="/audit-manager/section" replace />
  if (hasAuditManagerPermission(access, 'department')) return <Navigate to="/audit-manager/department" replace />
  if (hasAuditManagerPermission(access, 'statusOptions')) return <Navigate to="/audit-manager/status-options" replace />
  return <Navigate to="/no-access" replace />
}
