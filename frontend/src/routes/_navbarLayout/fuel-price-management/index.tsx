import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/fuel-price-management/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_navbarLayout/fuel-price-management/"!</div>
}
