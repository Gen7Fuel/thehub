import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_navbarLayout/cycle-count')({
  component: RouteComponent,
})

function RouteComponent() {
  const matchRoute = useMatchRoute();

  // const isUploadActive = matchRoute({ to: '/cycle-count' });
  // const isListActive = matchRoute({ to: '/cycle-count/list' });
  const isInputActive = matchRoute({ to: '/cycle-count' });
  const isCountActive = matchRoute({ to: '/cycle-count/count' });
  const isDashboardActive = matchRoute({ to: '/cycle-count/dashboard' });

  return (
    <div className="pt-16 flex flex-col items-center">
      <div className="flex mb-4">
        <Link to="/cycle-count" activeOptions={{ exact: true }}>
          <Button
            {...(!isInputActive && { variant: 'outline' } as object)}
            className="rounded-r-none"
          >
            Input
          </Button>
        </Link>
        <Link to="/cycle-count/count" activeOptions={{ exact: true }}>
          <Button
            {...(!isCountActive && { variant: 'outline' } as object)}
            className="rounded-none"
          >
            Count
          </Button>
        </Link>
        <Link to="/cycle-count/dashboard" activeOptions={{ exact: true }}>
          <Button
            {...(!isDashboardActive && { variant: 'outline' } as object)}
            className="rounded-l-none"
          >
            Dashboard
          </Button>
        </Link>
      </div>
      <Outlet />
    </div>
  )
}