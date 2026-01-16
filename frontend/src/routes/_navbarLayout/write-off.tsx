import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from "@/context/AuthContext"

export const Route = createFileRoute('/_navbarLayout/write-off')({
  component: RouteComponent,
})

function RouteComponent() {
  // Hook to match the current route for button highlighting
  // const matchRoute = useMatchRoute()

  // Determine if the Templates or Checklist tab is active
  // const isCreateActive = matchRoute({ to: '/write-off/create', exact: true })
  // const isRequestsActive = matchRoute({ to: '/write-off/requests', exact: true })

  const { user } = useAuth();
  // Retrieve access permissions from decoded token
  // const access = user?.access || '{}' //markpoint
  const access = user?.access || {}

  return (
    <div className="pt-16 flex flex-col items-center">
      {/* Grouped navigation buttons for audit sections */}
      <div className="flex mb-4">
        {[
          { key: 'create', label: 'Create', to: '/write-off/create' },
          { key: 'requests', label: 'Requests', to: '/write-off/requests' },
        ]
          .filter(btn => access?.writeOff?.[btn.key])
          .map((btn, idx, arr) => {
            const isFirst = idx === 0;
            const isLast = idx === arr.length - 1;
            const isOnly = arr.length === 1;

            let roundingClass = 'rounded-none';
            if (isOnly) roundingClass = 'rounded-xl';
            else if (isFirst) roundingClass = 'rounded-l-xl';
            else if (isLast) roundingClass = 'rounded-r-xl';

            return (
              <Link
                key={btn.key}
                to={btn.to}
                // This automatically handles the active state for you
                activeOptions={{ exact: true }}
              >
                {({ isActive }) => (
                  <Button
                    variant={isActive ? 'default' : 'outline'}
                    className={roundingClass}
                  >
                    {btn.label}
                  </Button>
                )}
              </Link>
            );
          })}
      </div>
      {/* Render the nested route content */}
      <Outlet />
    </div>
  )
}