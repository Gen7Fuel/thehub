import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useAuth } from '@/context/AuthContext'
import { hasStationAuditChecklist, hasStationAuditVisitor } from '@/lib/stationAuditPermissions'

export const Route = createFileRoute('/_navbarLayout/station-audits/')({
  component: StationAuditsIndex,
})

function StationAuditsIndex() {
  const { user } = useAuth()
  if (!user) return null
  if (hasStationAuditChecklist(user.access)) return <Navigate to="/station-audits/checklist" replace />
  if (hasStationAuditVisitor(user.access)) return <Navigate to="/station-audits/visitor" replace />
  return <Navigate to="/no-access" replace />
}
