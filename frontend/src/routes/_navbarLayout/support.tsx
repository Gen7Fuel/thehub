import { createFileRoute, useMatchRoute, Link, Outlet } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'

export const Route = createFileRoute('/_navbarLayout/support')({
  component: RouteComponent,
})

/**
 * RouteComponent
 * Renders the Support section with navigation buttons for Create and List.
 * Buttons are conditionally styled based on the current route.
 */
function RouteComponent() {
  // Hook to match the current route for button highlighting
  const matchRoute = useMatchRoute()
  const { user } = useAuth()

  // Determine if the Create or List tab is active
  const isCreateActive = matchRoute({ to: '/support' })
  const isListActive = matchRoute({ to: '/support/list' })

  return (
    <div className="pt-5 flex flex-col items-center">
      {/* Grouped navigation buttons for Support sections */}
      <div className="flex mb-4">
        {/* Create tab button */}
        <Link to="/support" activeOptions={{ exact: true }}>
          <Button
            {...(isCreateActive ? {} : { variant: 'outline' } as object)} // Conditionally add variant
            className="rounded-r-none"
          >
            Create
          </Button>
        </Link>
        {/* List tab button */}
        <Link to="/support/list" search={{site: user?.location }}>
          <Button
            {...(!isListActive && { variant: 'outline' } as object)} // Conditionally add variant
            className="rounded-l-none"
          >
            List
          </Button>
        </Link>
      </div>
      {/* Render the nested route content */}
      <Outlet />
    </div>
  )
}