import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

// Define the route for the Payables section using TanStack Router
export const Route = createFileRoute('/_navbarLayout/payables')({
  component: RouteComponent,
})

/**
 * RouteComponent
 * Renders the Payables section with navigation buttons for Create and List.
 * Buttons are conditionally styled based on the current route.
 */
function RouteComponent() {
  // Hook to match the current route for button highlighting
  const matchRoute = useMatchRoute()

  // Determine if the Create or List tab is active
  const isCreateActive = matchRoute({ to: '/payables' })
  const isListActive = matchRoute({ to: '/payables/list' })

  return (
    <div className="pt-5 flex flex-col items-center">
      {/* Grouped navigation buttons for Payables sections */}
      <div className="flex mb-4">
        {/* Create tab button */}
        <Link to="/payables" activeOptions={{ exact: true }}>
          <Button
            {...(isCreateActive ? {} : { variant: 'outline' } as object)} // Conditionally add variant
            className="rounded-r-none"
          >
            Create
          </Button>
        </Link>
        {/* List tab button */}
        <Link to="/payables/list">
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