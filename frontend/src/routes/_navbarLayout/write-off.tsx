import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from "@/context/AuthContext"

export const Route = createFileRoute('/_navbarLayout/write-off')({
  component: RouteComponent,
})

function RouteComponent() {
  // Hook to match the current route for button highlighting
  const matchRoute = useMatchRoute()

  // Determine if each tab is active
  const isCreateActive = matchRoute({ to: '/write-off/create' })
  const isRequestsActive = matchRoute({ to: '/write-off/requests' })
  const { user } = useAuth();
  // Retrieve access permissions from auth provider
  // const access = user?.access || '{}' //markpoint
  const access = user?.access || {}

  return (
    <div className="pt-5 flex flex-col items-center">
      {/* Grouped navigation buttons for Order Rec sections */}
      <div className="flex mb-4">
        {/* Upload tab button, shown only if user has upload access */}
        {/* {access.component_order_rec_upload && ( //markpoint */}
        {access?.writeOff?.create && (
          <Link to="/write-off/create" activeOptions={{ exact: true }}>
            <Button
              {...(isCreateActive ? {} : { variant: 'outline' } as object)}
              className="rounded-r-none"
            >
              Create
            </Button>
          </Link>
        )}


        {/* Workflow tab button, shown only if user has workflow access */}
        {/* {access.component_order_rec_workflow && ( //markpoint */}
        {access?.writeOff?.requests && (
          <Link to="/write-off/requests">
            <Button
              {...(isRequestsActive ? {} : { variant: 'outline' } as object)}
              // className={`${access.component_order_rec_upload ? 'rounded-l-none' : ''}`} //markpoint
              className={`${access?.writeOff?.create ? 'rounded-l-none' : ''}`}
            >
              Requests
            </Button>
          </Link>
        )}
      </div>
      {/* Render the nested route content */}
      <Outlet />
    </div>
  )
}