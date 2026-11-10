import { createFileRoute, Navigate, Outlet } from '@tanstack/react-router'
import { useAuth } from '@/context/AuthContext'
import { hasStationAuditChecklist } from '@/lib/stationAuditPermissions'

export const Route = createFileRoute('/_navbarLayout/station-audits/checklist')({
  component: ChecklistLayout,
})

function ChecklistLayout() {
  const { user } = useAuth()
  if (!user) return null
  if (!hasStationAuditChecklist(user.access)) return <Navigate to="/no-access" replace />
  return <Outlet />
}
