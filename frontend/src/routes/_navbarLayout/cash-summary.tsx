import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'

// Define the base route
export const Route = createFileRoute('/_navbarLayout/cash-summary')({
  component: RouteComponent,
})

function RouteComponent() {
  const matchRoute = useMatchRoute()
  const { user } = useAuth()

  const isSummaryActive = matchRoute({ to: '/cash-summary/report' })
  const isListActive = matchRoute({ to: '/cash-summary/list' })
  const isFormActive = matchRoute({ to: '/cash-summary' })

  const fallbackSite = user?.location

  return (
    <div className="pt-16 flex flex-col items-center">
      <div className="flex mb-4">
        {/* Keep existing site if present; else use user?.location */}
        <Link
          to="/cash-summary"
          search={(prev: any) => ({ ...prev, site: prev?.site ?? fallbackSite })}
          activeOptions={{ exact: true }}
        >
          <Button
            {...(!isFormActive && { variant: 'outline' } as object)}
            className="rounded-r-none"
          >
            Form
          </Button>
        </Link>

        <Link
          to="/cash-summary/list"
          search={(prev: any) => ({ ...prev, site: prev?.site ?? fallbackSite })}
          activeOptions={{ exact: true }}
        >
          <Button
            {...(!isListActive && { variant: 'outline' } as object)}
            className="rounded-none"
          >
            List
          </Button>
        </Link>

        <Link
          to="/cash-summary/report"
          search={(prev: any) => ({ ...prev, site: prev?.site ?? fallbackSite })}
          activeOptions={{ exact: true }}
        >
          <Button
            {...(!isSummaryActive && { variant: 'outline' } as object)}
            className="rounded-l-none"
          >
            Cash Summary
          </Button>
        </Link>
      </div>
      <Outlet />
    </div>
  )
}