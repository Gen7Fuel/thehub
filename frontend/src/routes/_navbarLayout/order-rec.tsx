import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_navbarLayout/order-rec')({
  component: RouteComponent,
})

function RouteComponent() {
  const matchRoute = useMatchRoute()

  const isUploadActive = matchRoute({ to: '/order-rec' })
  const isListActive = matchRoute({ to: '/order-rec/list' })
  const isDashboardActive = matchRoute({ to: '/order-rec/dashboard' })

  const access = JSON.parse(localStorage.getItem('access') || '{}')

  return (
    <div className="pt-16 flex flex-col items-center">
      {/* Grouped buttons */}
      <div className="flex mb-4">
        {access.component_order_rec_upload && (
        <Link to="/order-rec" activeOptions={{ exact: true }}>
          <Button
            {...(isUploadActive ? {} : { variant: 'outline' } as object)}
            className="rounded-r-none"
          >
            Upload
          </Button>
        </Link>
        )} 

        <Link to="/order-rec/list">
          <Button
            {...(isListActive ? {} : { variant: 'outline' } as object)}
            className={`${access.component_order_rec_upload ? 'rounded-l-none rounded-r-none' : ''}`}
          >
            List
          </Button>
        </Link>

        <Link to="/order-rec/dashboard">
          <Button
            {...(isDashboardActive ? {} : { variant: 'outline' } as object)}
            className={`${access.component_order_rec_upload ? 'rounded-l-none' : ''}`}
          >
            Dashboard
          </Button>
        </Link>
      </div>
      <Outlet />
    </div>
  )
}