import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute('/_navbarLayout/fuel-rec')({
  component: RouteComponent,
})

function RouteComponent() {
  const matchRoute = useMatchRoute()
  const isBolActive = matchRoute({ to: '/fuel-rec' })
  const isListActive = matchRoute({ to: '/fuel-rec/list' })

  const { user } = useAuth();
  const access = user?.access || {}

  return (
    <div className="pt-16 flex flex-col items-center">
      <div className="flex mb-4">
        {access?.accounting?.fuelRec?.bol && (
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
        )}

        {access?.accounting?.fuelRec?.list && (
          <Link
            to="/fuel-rec/list"
            activeOptions={{ exact: true }}
            search={(prev: any) => ({ ...prev, site: prev?.site })}
          >
            <Button
              {...(!isListActive && ({ variant: 'outline' } as object))}
              className={`${access?.accounting?.fuelRec?.bol ? 'rounded-l-none' : 'rounded'}`}
            >
              List
            </Button>
          </Link>
        )}
      </div>

      <Outlet />
    </div>
  )
}

export default RouteComponent