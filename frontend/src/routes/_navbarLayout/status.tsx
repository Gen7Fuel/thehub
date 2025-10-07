import { createFileRoute, useMatchRoute, Link, Outlet } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

// Define the route for the Status section using TanStack Router
export const Route = createFileRoute('/_navbarLayout/status')({
  component: RouteComponent,
})

/**
 * RouteComponent
 * Renders the Status section with navigation buttons for Create and List.
 * Buttons are conditionally styled based on the current route.
 */
function RouteComponent() {
  // Hook to match the current route for button highlighting
  const matchRoute = useMatchRoute()

  // Determine if the Create or List tab is active
  const isCreateActive = matchRoute({ to: '/status' })
  const isListActive = matchRoute({ to: '/status/list' })

  return (
    <div className="pt-16 flex flex-col items-center">
      {/* Grouped navigation buttons for Status sections */}
      <div className="flex mb-4">
        {/* Create tab button */}
        <Link to="/status" activeOptions={{ exact: true }}>
          <Button
            {...(isCreateActive ? {} : { variant: 'outline' } as object)} // Conditionally add variant
            className="rounded-r-none"
          >
            Create
          </Button>
        </Link>
        {/* List tab button */}
        <Link to="/status/list">
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