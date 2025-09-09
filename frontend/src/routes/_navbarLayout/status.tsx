import { createFileRoute, useMatchRoute, Link, Outlet } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_navbarLayout/status')({
  component: RouteComponent,
})

function RouteComponent() {
  const matchRoute = useMatchRoute()

  const isCreateActive = matchRoute({ to: '/status' })
  const isListActive = matchRoute({ to: '/status/list' })

  return (
    <div className="pt-16 flex flex-col items-center">
      {/* Grouped buttons */}
      <div className="flex mb-4">
        <Link to="/status" activeOptions={{ exact: true }}>
          <Button
            {...(isCreateActive ? {} : { variant: 'outline' } as object)} // Conditionally add variant
            className="rounded-r-none"
          >
            Create
          </Button>
        </Link>
        <Link to="/status/list">
          <Button
            {...(!isListActive && { variant: 'outline' } as object)} // Conditionally add variant
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