import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/settings/permissions/$id')(
  {
    component: RouteComponent,
  },
)

function RouteComponent() {
  return <div>Hello "/_navbarLayout/settings/permissions/$id"!</div>
}
