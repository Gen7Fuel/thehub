import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/dashboard')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_navbarLayout/dashboard"!</div>
}
