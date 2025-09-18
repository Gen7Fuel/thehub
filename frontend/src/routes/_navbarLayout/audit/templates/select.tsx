import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_navbarLayout/audit/templates/select')({
  component: RouteComponent,
})

function RouteComponent() {
  const matchRoute = useMatchRoute()

  const isCreateActive = matchRoute({ to: '/audit/templates/select' })
  const isListActive = matchRoute({ to: '/audit/templates/select/list', fuzzy: true })

  return (
    <div className="flex flex-col items-center">
      <div className="flex mb-4">
        <Link to="/audit/templates/select">
          <Button
            {...(isCreateActive ? {} : { variant: 'outline' } as object)}
            className="rounded-r-none"
          >
            Create
          </Button>
        </Link>
        <Link to="/audit/templates/select/list">
          <Button
            {...(isListActive ? {} : { variant: 'outline' } as object)}
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