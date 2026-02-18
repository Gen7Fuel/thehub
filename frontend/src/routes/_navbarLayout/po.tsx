import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

// Define the route for the Purchase Order (PO) section using TanStack Router
export const Route = createFileRoute('/_navbarLayout/po')({
  component: RouteComponent,
})

/**
 * RouteComponent
 * Renders the PO section with navigation buttons for Create and List.
 * The Create button is active for /po, /po/receipt, and /po/signature routes.
 * Buttons are conditionally styled based on the current route.
 */
function RouteComponent() {
  // Hook to match the current route for button highlighting
  const matchRoute = useMatchRoute()

  // Determine if the Create or List tab is active
  const isCreateActive =
    matchRoute({ to: '/po' }) ||
    matchRoute({ to: '/po/receipt' }) ||
    matchRoute({ to: '/po/signature' })
  const isListActive = matchRoute({ to: '/po/list' })

  return (
    <div className="pt-5 flex flex-col items-center">
      {/* Grouped navigation buttons for PO sections */}
      <div className="flex mb-4">
        {/* Create tab button (active for /po, /po/receipt, /po/signature) */}
        <Link to="/po" activeOptions={{ exact: true }}>
          <Button
            {...(isCreateActive ? {} : { variant: 'outline' } as object)} // Conditionally add variant
            className="rounded-r-none"
          >
            Create
          </Button>
        </Link>
        {/* List tab button */}
        <Link to="/po/list">
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