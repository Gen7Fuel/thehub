import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/audit/visitor/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Please select a checklist from the top.</div>
}