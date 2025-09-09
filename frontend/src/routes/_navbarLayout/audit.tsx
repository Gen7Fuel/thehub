import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_navbarLayout/audit')({
  component: RouteComponent,
})

function RouteComponent() {
  const matchRoute = useMatchRoute()

  const isCreateActive = matchRoute({ to: '/audit' })
  const isListActive = matchRoute({ to: '/audit/list' })
  const isChecklistActive = matchRoute({ to: '/audit/checklist' })

  return (
    <div className="pt-16 flex flex-col items-center">
      {/* Grouped buttons */}
      <div className="flex mb-4">
        <Link to="/audit" activeOptions={{ exact: true }}>
          <Button
            {...(isCreateActive ? {} : { variant: 'outline' } as object)}
            className="rounded-r-none"
          >
            Create
          </Button>
        </Link>
        <Link to="/audit/list">
          <Button
            {...(!isListActive && { variant: 'outline' } as object)}
            className="rounded-none"
          >
            List
          </Button>
        </Link>
        <Link to="/audit/checklist">
          <Button
            {...(!isChecklistActive && { variant: 'outline' } as object)}
            className="rounded-l-none"
          >
            Checklist
          </Button>
        </Link>
      </div>
      <Outlet />
    </div>
  )
}