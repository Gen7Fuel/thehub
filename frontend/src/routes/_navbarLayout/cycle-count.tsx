import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

// Define the route for the cycle count section using TanStack Router
export const Route = createFileRoute('/_navbarLayout/cycle-count')({
  component: RouteComponent,
})

/**
 * RouteComponent
 * Renders the cycle count section with navigation buttons for Input, Count, and Console.
 * Buttons are conditionally styled and rendered based on user access permissions.
 */
function RouteComponent() {
  // Hook to match the current route for button highlighting
  const matchRoute = useMatchRoute();

  // Determine if each tab is active
  const isInputActive = matchRoute({ to: '/cycle-count' });
  const isCountActive = matchRoute({ to: '/cycle-count/count' });
  const isInventoryActive = matchRoute({ to: '/cycle-count/inventory' });
  const isConsoleActive = matchRoute({ to: '/cycle-count/console' });

  // Retrieve access permissions from localStorage
  const access = JSON.parse(localStorage.getItem("access") || "{}");

  return (
    <div className="pt-16 flex flex-col items-center">
      {/* Navigation buttons for cycle count sections */}
      <div className="flex mb-4">
        {/* Input tab button */}
        <Link to="/cycle-count" activeOptions={{ exact: true }}>
          <Button
            {...(!isInputActive && { variant: 'outline' } as object)}
            className="rounded-r-none"
          >
            Input
          </Button>
        </Link>
        {/* Count tab button */}
        <Link to="/cycle-count/count" activeOptions={{ exact: true }}>
          <Button
            {...(!isCountActive && { variant: 'outline' } as object)}
            className="rounded-none"
          >
            Count
          </Button>
        </Link>

        <Link 
          to="/cycle-count/inventory" 
          activeOptions={{ exact: true }}
          search={{ site: localStorage.getItem('location') || '', category: '' }}
        >
          <Button
            {...(!isInventoryActive && { variant: 'outline' } as object)}
            className={access.component_cycle_count_console ? 'rounded-none' : 'rounded-l-none'}
          >
            Inventory
          </Button>
        </Link>

        {/* Console tab button, shown only if user has access */}
        {access.component_cycle_count_console && (
          <Link to="/cycle-count/console" activeOptions={{ exact: true }}>
            <Button
              {...(!isConsoleActive && { variant: 'outline' } as object)}
              className="rounded-l-none"
            >
              Console
            </Button>
          </Link>
        )}
      </div>
      {/* Render the nested route content */}
      <Outlet />
    </div>
  )
}