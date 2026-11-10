import { createFileRoute, Link, Navigate, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { hasStationAuditChecklist, hasStationAuditVisitor } from '@/lib/stationAuditPermissions'

export const Route = createFileRoute('/_navbarLayout/station-audits')({
  component: StationAuditsLayout,
})

function StationAuditsLayout() {
  const { user } = useAuth()
  const matchRoute = useMatchRoute()
  if (!user) return null
  const canChecklist = hasStationAuditChecklist(user.access)
  const canVisitor = hasStationAuditVisitor(user.access)
  if (!canChecklist && !canVisitor) return <Navigate to="/no-access" replace />
  const isChecklistActive = matchRoute({
    to: '/station-audits/checklist',
    fuzzy: true,
  })
  const isVisitorActive = matchRoute({
    to: '/station-audits/visitor',
    fuzzy: true,
  })

  return (
    <div className="flex flex-col items-center pt-5">
      <div className="mb-4 flex gap-2">
        {canChecklist && <Link to="/station-audits/checklist">
          <Button
            {...(!isChecklistActive && { variant: 'outline' as const })}
            className="rounded-xl"
          >
            Checklist
          </Button>
        </Link>}
        {canVisitor && <Link to="/station-audits/visitor">
          <Button
            {...(!isVisitorActive && { variant: 'outline' as const })}
            className="rounded-xl"
          >
            Visitor
          </Button>
        </Link>}
      </div>

      <Outlet />
    </div>
  )
}
