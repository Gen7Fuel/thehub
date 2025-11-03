import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from "@/context/AuthContext";

// Define the route for the Order Rec section using TanStack Router
export const Route = createFileRoute('/_navbarLayout/order-rec')({
  component: RouteComponent,
})

/**
 * RouteComponent
 * Renders the Order Rec section with navigation buttons for Upload, List, and Workflow.
 * Buttons are conditionally rendered and styled based on user access permissions and the current route.
 */
function RouteComponent() {
  // Hook to match the current route for button highlighting
  const matchRoute = useMatchRoute()

  // Determine if each tab is active
  const isUploadActive = matchRoute({ to: '/order-rec' })
  const isListActive = matchRoute({ to: '/order-rec/list' })
  const isDashboardActive = matchRoute({ to: '/order-rec/workflow' })
  const { user } = useAuth();
  // Retrieve access permissions from auth provider
  const access = user?.access || '{}' //markpoint
  // const access = user?.access || {}

  return (
    <div className="pt-16 flex flex-col items-center">
      {/* Grouped navigation buttons for Order Rec sections */}
      <div className="flex mb-4">
        {/* Upload tab button, shown only if user has upload access */}
        {access.component_order_rec_upload && ( //markpoint
        // {access.orderRec.upload && (
          <Link to="/order-rec" activeOptions={{ exact: true }}>
            <Button
              {...(isUploadActive ? {} : { variant: 'outline' } as object)}
              className="rounded-r-none"
            >
              Upload
            </Button>
          </Link>
        )}

        {/* List tab button, always shown */}
        <Link to="/order-rec/list" search={{ site: user?.location || '' }}>
          <Button
            {...(isListActive ? {} : { variant: 'outline' } as object)}
            className={`${access.component_order_rec_upload ? 'rounded-l-none rounded-r-none' : ''}`} //markpoint
            // className={`${access.orderRec.upload ? 'rounded-l-none rounded-r-none' : ''}`}
          >
            List
          </Button>
        </Link>

        {/* Workflow tab button, shown only if user has workflow access */}
        {access.component_order_rec_workflow && ( //markpoint
        // {access.orderRec.workflow && (
          <Link to="/order-rec/workflow">
            <Button
              {...(isDashboardActive ? {} : { variant: 'outline' } as object)}
              className={`${access.component_order_rec_upload ? 'rounded-l-none' : ''}`} //markpoint
              // className={`${access.orderRec.upload ? 'rounded-l-none' : ''}`}
            >
              Workflow
            </Button>
          </Link>
        )}
      </div>
      {/* Render the nested route content */}
      <Outlet />
    </div>
  )
}