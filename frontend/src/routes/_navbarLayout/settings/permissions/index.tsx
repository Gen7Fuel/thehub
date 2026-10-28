import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/settings/permissions/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div className="pl-4">Select a permission from the left</div>
}
