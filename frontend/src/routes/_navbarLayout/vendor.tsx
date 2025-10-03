import { createFileRoute, useMatchRoute, Link, Outlet } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

// Define the route for the Vendor section using TanStack Router
export const Route = createFileRoute('/_navbarLayout/vendor')({
  component: RouteComponent,
})

/**
 * RouteComponent
 * Renders the Vendor section with navigation buttons for Create and List.
 * Buttons are conditionally styled based on the current route.
 */
function RouteComponent() {
  // Hook to match the current route for button highlighting
  const matchRoute = useMatchRoute()

  // Determine if the Create or List tab is active
  const isCreateActive = matchRoute({ to: '/vendor' })
  const isListActive = matchRoute({ to: '/vendor/list' })

  return (
    <div className="pt-16 flex flex-col items-center">
      {/* Grouped navigation buttons for Vendor sections */}
      <div className="flex mb-4">
        {/* Create tab button */}
        <Link to="/vendor" activeOptions={{ exact: true }}>
          <Button
            {...(isCreateActive ? {} : { variant: 'outline' } as object)} // Conditionally add variant
            className="rounded-r-none"
          >
            Create
          </Button>
        </Link>
        {/* List tab button */}
        <Link to="/vendor/list">
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