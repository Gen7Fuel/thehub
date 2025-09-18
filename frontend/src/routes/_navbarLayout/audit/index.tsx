import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/audit/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_navbarLayout/audit/"!</div>
}
