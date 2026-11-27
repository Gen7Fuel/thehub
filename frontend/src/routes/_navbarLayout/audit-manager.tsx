import { createFileRoute, Link, Navigate, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { hasAuditManagerAccess, hasAuditManagerPermission, type AuditManagerPermission } from '@/lib/auditManagerPermissions'

export const Route = createFileRoute('/_navbarLayout/audit-manager')({
  component: AuditManagerLayout,
})

const links: Array<{
  to: '/audit-manager/checklist' | '/audit-manager/section' | '/audit-manager/department' | '/audit-manager/status-options'
  label: string
  permission: AuditManagerPermission
}> = [
  { to: '/audit-manager/checklist', label: 'Checklists', permission: 'checklist' },
  { to: '/audit-manager/section', label: 'Sections', permission: 'section' },
  { to: '/audit-manager/department', label: 'Departments', permission: 'department' },
  { to: '/audit-manager/status-options', label: 'Status Options', permission: 'statusOptions' },
]

function AuditManagerLayout() {
  const { user } = useAuth()
  const matchRoute = useMatchRoute()
  if (!user) return null

  const access = user.access
  if (!hasAuditManagerAccess(access)) return <Navigate to="/no-access" replace />
  const authorizedLinks = links.filter((link) => hasAuditManagerPermission(access, link.permission))

  return (
    <div className="flex w-full flex-col items-center pt-5">
      <div className="mb-4 w-full overflow-x-auto px-3 pb-1 sm:px-5">
        <div className="mx-auto flex w-max min-w-max">
          {authorizedLinks.map((link, index) => {
            const isActive = Boolean(matchRoute({ to: link.to, fuzzy: true }))
            const isFirst = index === 0
            const isLast = index === authorizedLinks.length - 1
            const isOnly = authorizedLinks.length === 1
            const roundingClass = isOnly
              ? 'rounded-xl'
              : isFirst
                ? 'rounded-l-xl rounded-r-none'
                : isLast
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
