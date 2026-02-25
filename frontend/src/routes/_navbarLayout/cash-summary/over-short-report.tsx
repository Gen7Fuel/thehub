import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_navbarLayout/cash-summary/over-short-report',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_navbarLayout/cash-summary/over-short-report"!</div>
}
