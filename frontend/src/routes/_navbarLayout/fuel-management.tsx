import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute('/_navbarLayout/fuel-management')({
  component: RouteComponent,
})

function RouteComponent() {
  // Hook to match the current route for button highlighting
  const matchRoute = useMatchRoute();

  // Determine if each tab is active
  const isCreateOrderActive = matchRoute({ to: '/fuel-management/create-order' });
  const isWorkspaceActive = matchRoute({ to: '/fuel-management/workspace' });
  const isVolumeActive = matchRoute({ to: '/fuel-management/volume' });
  const isManageActive = matchRoute({ to: '/fuel-management/manage' });

  const { user } = useAuth();

  // Retrieve access permissions from Auth provider
  // const access = user?.access || "{}" //markpoint
  const access = user?.access || {}

  return (
    <div className="pt-5 flex flex-col items-center">
      {/* Navigation buttons for cycle count sections */}
      <div className="flex mb-4">
        {/* Create Order tab button */}
        {access?.fuelManagement?.createOrder && (
          <Link to="/fuel-management/create-order" activeOptions={{ exact: true }}>
            <Button
              {...(!isCreateOrderActive && { variant: 'outline' } as object)}
              className="rounded-r-none"
            >
              Create Order
            </Button>
          </Link>
        )}

        {access?.fuelManagement?.value && (
          <Link
            to="/fuel-management/workspace"
            activeOptions={{ exact: true }}
            search={{ site: user?.location || ''}}
          >
            <Button
              {...(!isWorkspaceActive && { variant: 'outline' } as object)}
              // className={access.component_cycle_count_console ? 'rounded-none' : 'rounded-l-none'} //markpoint
              className={access?.fuelManagement?.volume ? 'rounded-none' : 'rounded-l-none'}
            >
              Workspace
            </Button>
          </Link>
        )}

        {access?.fuelManagement?.volume && (
          <Link
            to="/fuel-management/volume"
            activeOptions={{ exact: true }}
            search={{ site: user?.location || ''}}
          >
            <Button
              {...(!isVolumeActive && { variant: 'outline' } as object)}
              // className={access.component_cycle_count_console ? 'rounded-none' : 'rounded-l-none'} //markpoint
              className={access?.fuelManagement?.manage ? 'rounded-none' : 'rounded-l-none'}
            >
              Tank Volume
            </Button>
          </Link>
        )}

        {access?.fuelManagement?.manage && (
          <Link to="/fuel-management/manage" activeOptions={{ exact: true }}>
            <Button
              {...(!isManageActive && { variant: 'outline' } as object)}
              className="rounded-l-none"
            >
              Manage Configuration
            </Button>
          </Link>
        )}
      </div>
      {/* Render the nested route content */}
      <Outlet />
    </div>
  )
}