import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/cash-rec/report')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_navbarLayout/cash-rec/report"!</div>
}
