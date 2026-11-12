import { createFileRoute, Link, Navigate, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import {
  hasAuditTrackerAccess,
  hasAuditTrackerPermission,
  type AuditTrackerPermission,
} from '@/lib/auditTrackerPermissions'

export const Route = createFileRoute('/_navbarLayout/audit-tracker')({
  component: AuditTrackerLayout,
})

const links: Array<{
  to: '/audit-tracker/my-issues' | '/audit-tracker/department-issues' | '/audit-tracker/report'
  label: string
  permission: AuditTrackerPermission
}> = [
  { to: '/audit-tracker/my-issues', label: 'My Issues', permission: 'myIssues' },
  { to: '/audit-tracker/department-issues', label: 'Department Issues', permission: 'departmentIssues' },
  { to: '/audit-tracker/report', label: 'Report', permission: 'report' },
]

function AuditTrackerLayout() {
  const { user } = useAuth()
  const matchRoute = useMatchRoute()
  if (!user) return null

  const access = user.access
  if (!hasAuditTrackerAccess(access)) return <Navigate to="/no-access" replace />
  const authorizedLinks = links.filter((link) =>
    hasAuditTrackerPermission(access, link.permission),
  )
  if (!authorizedLinks.length) return <Navigate to="/no-access" replace />

  return (
    <div className="flex w-full flex-col items-center pt-5">
      <div className="mb-4 w-full overflow-x-auto px-3 pb-1 sm:px-5">
        <div className="mx-auto flex w-max min-w-max">
          {authorizedLinks.map((link, index) => {
            const isActive = Boolean(matchRoute({ to: link.to, fuzzy: true }))
            const isOnly = authorizedLinks.length === 1
            const roundingClass = isOnly
              ? 'rounded-xl'
              : index === 0
                ? 'rounded-l-xl rounded-r-none'
                : index === authorizedLinks.length - 1
                  ? 'rounded-r-xl rounded-l-none'
                  : 'rounded-none'

            return (
              <Link key={link.to} to={link.to}>
                <Button
                  {...(!isActive && { variant: 'outline' as const })}
                  className={`${roundingClass} h-11 whitespace-nowrap px-4 text-sm sm:h-10`}
                >
                  {link.label}
                </Button>
              </Link>
            )
          })}
        </div>
      </div>
      <Outlet />
    </div>
  )
}
