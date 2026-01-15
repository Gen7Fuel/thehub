import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from "@/context/AuthContext"


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
  const isVisitorActive = matchRoute({ to: '/audit/visitor', fuzzy: true })

  const { user } = useAuth();
  // Retrieve access permissions from decoded token
  // const access = user?.access || '{}' //markpoint
  const access = user?.access || {}

  return (
    <div className="pt-16 flex flex-col items-center">
      {/* Grouped navigation buttons for audit sections */}
      <div className="flex mb-4">
        {[
          { key: 'template', label: 'Templates', to: '/audit/templates', isActive: isCreateActive },
          { key: 'checklist', label: 'Checklist', to: '/audit/checklist', isActive: isChecklistActive },
          { key: 'visitor', label: 'Visitor\'s Audit', to: '/audit/visitor', isActive: isVisitorActive },
          { key: 'interface', label: 'Interface', to: '/audit/interface', isActive: isInterfaceActive },
        ]
          .filter(btn => access?.stationAudit?.[btn.key]) // Only keep buttons with permission
          .map((btn, idx, arr) => {
            const isFirst = idx === 0;
            const isLast = idx === arr.length - 1;
            const isOnly = arr.length === 1;

            let roundingClass = 'rounded-none';

            if (isOnly) roundingClass = 'rounded-xl'; // Only one button → round all corners
            else if (isFirst) roundingClass = 'rounded-l-xl rounded-r-none';
            else if (isLast) roundingClass = 'rounded-r-xl rounded-l-none';

            return (
              <Link key={btn.key} to={btn.to}>
                <Button
                  {...(!btn.isActive && { variant: 'outline' } as object)}
                  className={roundingClass}
                >
                  {btn.label}
                </Button>
              </Link>
            );
          })}
      </div>


      {/* Render the nested route content */}
      <Outlet />
    </div>
  )
}