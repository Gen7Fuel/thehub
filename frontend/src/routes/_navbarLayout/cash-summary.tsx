import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'

// Define the base route
export const Route = createFileRoute('/_navbarLayout/cash-summary')({
  component: RouteComponent,
})

function RouteComponent() {
  const matchRoute = useMatchRoute()
  const { user } = useAuth()

  const isSummaryActive = matchRoute({ to: '/cash-summary/report' })
  const isListActive = matchRoute({ to: '/cash-summary/list' })
  const isLotteryActive = matchRoute({ to: '/cash-summary/lottery' })
  const isLotteryListActive = matchRoute({ to: '/cash-summary/lottery-list' })
  const isFormActive = matchRoute({ to: '/cash-summary' })

  const fallbackSite = user?.location
  const access = user?.access || {}

  return (
    <div className="pt-16 flex flex-col items-center">
      <div className="flex mb-4">
        {/* Keep existing site if present; else use user?.location */}
        <Link
          to="/cash-summary"
          search={(prev: any) => {
            const { id, date, ...rest } = prev || {}
            return { ...rest, site: rest?.site ?? fallbackSite }
          }}
          activeOptions={{ exact: true }}
        >
          <Button
            {...(!isFormActive && { variant: 'outline' } as object)}
            className="rounded-r-none"
          >
            Form
          </Button>
        </Link>

        <Link
          to="/cash-summary/list"
          // search={(prev: any) => {
          //   const { id, date, ...rest } = prev || {}
          //   return { ...rest, site: rest?.site ?? fallbackSite }
          // }}
          search={(prev: any) => ({ ...prev})}
          activeOptions={{ exact: true }}
        >
          <Button
            {...(!isListActive && { variant: 'outline' } as object)}
            className="rounded-none"
          >
            List
          </Button>
        </Link>

        {access?.accounting?.lottery && (
          <Link
            to="/cash-summary/lottery"
            // search={(prev: any) => {
            //   const { id, ...rest } = prev || {}
            //   return { ...rest, site: rest?.site, date: rest?.date }
            // }}
            search={(prev: any) => ({ ...prev})}
            activeOptions={{ exact: true }}
          >
            <Button
              {...(!isLotteryActive && { variant: 'outline' } as object)}
              className="rounded-none"
            >
              Lottery
            </Button>
          </Link>
        )}
        {access?.accounting?.lotteryList && (
          <Link
            to="/cash-summary/lottery-list"
            // search={(prev: any) => {
            //   const { id, ...rest } = prev || {}
            //   return { ...rest, site: rest?.site, date: rest?.date }
            // }}
            search={(prev: any) => ({ ...prev})}
            activeOptions={{ exact: true }}
          >
            <Button
              {...(!isLotteryListActive && { variant: 'outline' } as object)}
              className="rounded-none"
            >
              Lottery List
            </Button>
          </Link>
        )}
        <Link
          to="/cash-summary/report"
          search={(prev: any) => ({ ...prev})}
          activeOptions={{ exact: true }}
        >
          <Button
            {...(!isSummaryActive && { variant: 'outline' } as object)}
            className="rounded-l-none"
          >
            Report
          </Button>
        </Link>
      </div>
      <Outlet />
    </div>
  )
}