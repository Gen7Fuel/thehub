import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_navbarLayout/cycle-count')({
  component: RouteComponent,
})

function RouteComponent() {
  const matchRoute = useMatchRoute();

  const isUploadActive = matchRoute({ to: '/cycle-count' });
  const isListActive = matchRoute({ to: '/cycle-count/list' });

  return (
    <div className="pt-16 flex flex-col items-center">
      <div className="flex mb-4">
        <Link to="/cycle-count" activeOptions={{ exact: true }}>
          <Button
            {...(isUploadActive ? {} : { variant: 'outline' } as object)}
            className="rounded-r-none"
          >
            Upload
          </Button>
        </Link>
        <Link to="/cycle-count/list" activeOptions={{ exact: true }}>
          <Button
            {...(!isListActive && { variant: 'outline' } as object)}
            className="rounded-l-none"
          >
            List
          </Button>
        </Link>
      </div>
      <Outlet />
    </div>
  )
}