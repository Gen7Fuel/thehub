import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_navbarLayout/cash-rec')({
  component: RouteComponent,
})

function RouteComponent() {
  const matchRoute = useMatchRoute()
  // const { user } = useAuth()
  // const access = user?.access || {}

  const isReportActive = matchRoute({ to: '/cash-rec' })
  const isEntriesActive = matchRoute({ to: '/cash-rec/entries' })
  const isBankActive = matchRoute({ to: '/cash-rec/bank' })
  const isReceivablesActive = matchRoute({ to: '/cash-rec/receivables' })
  const isPayoutsActive = matchRoute({ to: '/cash-rec/payouts' })

  return (
    <div className="pt-16 flex flex-col items-center">
      <div className="flex mb-4">
        <Link to="/cash-rec" activeOptions={{ exact: true }} search={(prev: any) => ({ ...prev, site: prev?.site })}>
          <Button {...(!isReportActive && { variant: 'outline' } as object)} className="rounded-r-none">
            Report
          </Button>
        </Link>

        <Link to="/cash-rec/entries" activeOptions={{ exact: true }} search={(prev: any) => ({ ...prev, site: prev?.site })}>
          <Button {...(!isEntriesActive && { variant: 'outline' } as object)} className="rounded-none">
            Entries
          </Button>
        </Link>

        <Link to="/cash-rec/bank" activeOptions={{ exact: true }} search={(prev: any) => ({ ...prev, site: prev?.site })}>
          <Button {...(!isBankActive && { variant: 'outline' } as object)} className="rounded-l-none">
            Bank
          </Button>
        </Link>

        {/* <Link to="/cash-rec/receivables" activeOptions={{ exact: true }} search={(prev: any) => ({ ...prev, site: prev?.site })}>
          <Button {...(!isReceivablesActive && { variant: 'outline' } as object)} className="rounded-none">
            Receivables
          </Button>
        </Link>

        <Link to="/cash-rec/payouts" activeOptions={{ exact: true }} search={(prev: any) => ({ ...prev, site: prev?.site })}>
          <Button {...(!isPayoutsActive && { variant: 'outline' } as object)} className="rounded-l-none">
            Payouts
          </Button>
        </Link> */}
      </div>

      <Outlet />
    </div>
  )
}

export default RouteComponent