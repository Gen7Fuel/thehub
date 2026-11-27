import { createFileRoute, Link, Navigate, Outlet, useChildMatches } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { cycleCountPages, hasCycleCountPageAccess } from '@/lib/cycleCountPermissions'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_navbarLayout/cycle-count')({
  component: CycleCountLayout,
})

function CycleCountLayout() {
  const { user } = useAuth()
  const childPath = useChildMatches({ select: (matches): string | undefined => matches[0]?.fullPath })
  if (!user) return null

  const currentPage = cycleCountPages.find(({ to }) => to === childPath)
  const allowedPages = cycleCountPages.filter(({ permission }) => hasCycleCountPageAccess(user.access, permission))

  if (!allowedPages.length || (currentPage && !allowedPages.includes(currentPage))) {
    return <Navigate to="/no-access" replace />
  }

  return (
    <div className="pt-5 flex flex-col items-center">
      <div className="flex mb-4">
        {allowedPages.map(({ to, label }, index) => (
          <Button
            key={to}
            asChild
            variant={to === childPath ? 'default' : 'outline'}
            className={cn(index > 0 && 'rounded-l-none', index < allowedPages.length - 1 && 'rounded-r-none')}
          >
            <Link
              to={to}
              search={to === '/cycle-count/inventory' ? { site: user.location || '', category: '' } : undefined}
            >
              {label}
            </Link>
          </Button>
        ))}
      </div>
      <Outlet />
    </div>
  )
}
