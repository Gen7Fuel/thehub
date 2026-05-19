import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/cycle-count/manage/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Select an Option form Left</div>
}
