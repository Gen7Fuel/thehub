import { createFileRoute, Navigate, Outlet } from '@tanstack/react-router'
import { useAuth } from '@/context/AuthContext'
import { hasStationAuditVisitor } from '@/lib/stationAuditPermissions'

export const Route = createFileRoute('/_navbarLayout/station-audits/visitor')({
  component: VisitorLayout,
})

function VisitorLayout() {
  const { user } = useAuth()
  if (!user) return null
  if (!hasStationAuditVisitor(user.access)) return <Navigate to="/no-access" replace />
  return <Outlet />
}
