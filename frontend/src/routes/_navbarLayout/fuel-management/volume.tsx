import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/fuel-management/volume')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_navbarLayout/fuel-management/volume"!</div>
}
