import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/cycle-count/dashboard')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_navbarLayout/cycle-count/dashboard"!</div>
}
