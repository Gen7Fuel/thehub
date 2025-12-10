import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_navbarLayout/fuel-rec')({
  component: RouteComponent,
})

function RouteComponent() {
  const matchRoute = useMatchRoute()
  const isBolActive = matchRoute({ to: '/fuel-rec' })
  const isListActive = matchRoute({ to: '/fuel-rec/list' })

  return (
    <div className="pt-16 flex flex-col items-center">
      <div className="flex mb-4">
        <Link
          to="/fuel-rec"
          activeOptions={{ exact: true }}
          search={(prev: any) => ({ ...prev, site: prev?.site })}
        >
          <Button
            {...(!isBolActive && ({ variant: 'outline' } as object))}
            className="rounded-r-none"
          >
            BOL
          </Button>
        </Link>

        <Link
          to="/fuel-rec/list"
          activeOptions={{ exact: true }}
          search={(prev: any) => ({ ...prev, site: prev?.site })}
        >
          <Button
            {...(!isListActive && ({ variant: 'outline' } as object))}
            className="rounded-l-none"
          >
            List
          </Button>
        </Link>
      </div>

      <Outlet />
    </div>
  )
}

export default RouteComponent