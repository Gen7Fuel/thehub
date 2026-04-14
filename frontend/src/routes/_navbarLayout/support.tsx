import { createFileRoute, useMatchRoute, Link, Outlet } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_navbarLayout/support')({
  component: RouteComponent,
})

function RouteComponent() {
  const matchRoute = useMatchRoute()

  const isListActive = matchRoute({ to: '/support/list' })
  const isChatActive = matchRoute({ to: '/support/chat' })

  return (
    <div className="pt-5 flex flex-col items-center">
      <div className="flex mb-4">
        <Link to="/support/list">
          <Button
            {...(!isListActive && { variant: 'outline' } as object)}
            className="rounded-r-none"
          >
            List
          </Button>
        </Link>
        <Link to="/support/chat">
          <Button
            {...(!isChatActive && { variant: 'outline' } as object)}
            className="rounded-l-none"
          >
            Chat
          </Button>
        </Link>
      </div>
      <Outlet />
    </div>
  )
}