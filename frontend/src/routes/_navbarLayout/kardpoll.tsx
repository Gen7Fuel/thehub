import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_navbarLayout/kardpoll')({
  component: RouteComponent,
})

function RouteComponent() {
  const matchRoute = useMatchRoute()

  const isUploadActive = matchRoute({ to: '/kardpoll' })
  const isListActive = matchRoute({ to: '/kardpoll/list' })

  return (
    <div className="pt-16 flex flex-col items-center">
      {/* Grouped buttons */}
      <div className="flex mb-4">
        <Link to="/kardpoll" activeOptions={{ exact: true }}>
          <Button
            {...(isUploadActive ? {} : { variant: 'outline' } as object)} // Conditionally add variant
            className="rounded-r-none"
          >
            Create
          </Button>
        </Link>
        <Link to="/kardpoll/list">
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