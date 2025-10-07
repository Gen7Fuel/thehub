import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

// Define the route for the fleet section using TanStack Router
export const Route = createFileRoute('/_navbarLayout/fleet')({
  component: RouteComponent,
})

/**
 * RouteComponent
 * Renders the fleet section with navigation buttons for Create and List.
 * Buttons are conditionally styled based on the current route.
 */
function RouteComponent() {
  // Hook to match the current route for button highlighting
  const matchRoute = useMatchRoute()

  // Determine if the Create or List tab is active
  const isCreateActive = matchRoute({ to: '/fleet' })
  const isListActive = matchRoute({ to: '/fleet/list' })

  return (
    <div className="pt-16 flex flex-col items-center">
      {/* Grouped navigation buttons for fleet sections */}
      <div className="flex mb-4">
        {/* Create tab button */}
        <Link to="/fleet" activeOptions={{ exact: true }}>
          <Button
            {...(isCreateActive ? {} : { variant: 'outline' } as object)} // Conditionally add variant
            className="rounded-r-none"
          >
            Create
          </Button>
        </Link>
        {/* List tab button */}
        <Link to="/fleet/list">
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