import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_navbarLayout/station-audits')({
  component: StationAuditsLayout,
})

function StationAuditsLayout() {
  const matchRoute = useMatchRoute()
  const isChecklistActive = matchRoute({
    to: '/station-audits/checklist',
    fuzzy: true,
  })

  return (
    <div className="flex flex-col items-center pt-5">
      <div className="mb-4 flex">
        <Link to="/station-audits/checklist">
          <Button
            {...(!isChecklistActive && { variant: 'outline' as const })}
            className="rounded-xl"
          >
            Checklist
          </Button>
        </Link>
      </div>

      <Outlet />
    </div>
  )
}
