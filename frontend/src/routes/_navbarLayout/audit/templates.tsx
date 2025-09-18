import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_navbarLayout/audit/templates')({
  component: RouteComponent,
})

function RouteComponent() {
  const matchRoute = useMatchRoute()

  const isChecklistActive = matchRoute({ to: '/audit/templates/checklist', fuzzy: true })
  const isSelectActive = matchRoute({ to: '/audit/templates/select', fuzzy: true })
  // const isFeedbackActive = matchRoute({ to: '/audit/templates/follow-up', fuzzy: true })
  // const isAssignedToActive = matchRoute({ to: '/audit/templates/assigned-to' })

  return (
    <div className="flex flex-col items-center">
      <div className="flex mb-4">
        <Link to="/audit/templates/checklist">
          <Button
            {...(isChecklistActive ? {} : { variant: 'outline' } as object)}
            className="rounded-r-none"
          >
            Checklist
          </Button>
        </Link>
        <Link to="/audit/templates/select">
          <Button
            {...(isSelectActive ? {} : { variant: 'outline' } as object)}
            className="rounded-l-none"
          >
            Select
          </Button>
        </Link>
        {/* <Link to="/audit/templates/follow-up">
          <Button
            {...(isFeedbackActive ? {} : { variant: 'outline' } as object)}
            className="rounded-none"
          >
            Follow Up
          </Button>
        </Link>
        <Link to="/audit/templates/assigned-to">
          <Button
            {...(isAssignedToActive ? {} : { variant: 'outline' } as object)}
            className="rounded-l-none"
          >
            Assigned To
          </Button>
        </Link> */}
      </div>
      <Outlet />
    </div>
  )
}