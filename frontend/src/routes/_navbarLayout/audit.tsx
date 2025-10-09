import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

// Define the route for the audit section using TanStack Router
export const Route = createFileRoute('/_navbarLayout/audit')({
  component: RouteComponent,
})

/**
 * RouteComponent
 * Renders the audit section with navigation buttons for Templates and Checklist.
 * Buttons are conditionally styled and rendered based on user access permissions.
 */
function RouteComponent() {
  // Hook to match the current route for button highlighting
  const matchRoute = useMatchRoute()

  // Determine if the Templates or Checklist tab is active
  const isCreateActive = matchRoute({ to: '/audit/templates', fuzzy: true })
  const isChecklistActive = matchRoute({ to: '/audit/checklist', fuzzy: true })

  const isInterfaceActive = matchRoute({ to: '/audit/interface', fuzzy: true })
  // Retrieve access permissions from localStorage
  const access = JSON.parse(localStorage.getItem('access') || '{}')

  return (
    <div className="pt-16 flex flex-col items-center">
      {/* Grouped navigation buttons for audit sections */}
      <div className="flex mb-4">
        {/* Show Templates button if user has access */}
        {access.component_station_audit_template && (
          <Link to="/audit/templates">
            <Button
              {...(isCreateActive ? {} : { variant: 'outline' } as object)}
              className="rounded-r-none"
            >
              Templates
            </Button>
          </Link>
        )}
        {/* Checklist button is always shown */}
        <Link to="/audit/checklist">
          <Button
            {...(!isChecklistActive && { variant: 'outline' } as object)}
            className="rounded-none"
          >
            Checklist
          </Button>
        </Link>
        {access.component_station_audit_interface && (
          <Link to="/audit/interface">
            <Button
              {...(!isInterfaceActive && { variant: 'outline' } as object)}
              className="rounded-l-none"
            >
              Interface
            </Button>
          </Link>
        )}
      </div>
      {/* Render the nested route content */}
      <Outlet />
    </div>
  )
}