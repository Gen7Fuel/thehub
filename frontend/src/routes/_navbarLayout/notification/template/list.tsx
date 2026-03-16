import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_navbarLayout/notification/template/list',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_navbarLayout/notification/template/list"!</div>
}
