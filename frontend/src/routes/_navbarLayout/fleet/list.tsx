import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/fleet/list')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_navbarLayout/fleet/list"!</div>
}
