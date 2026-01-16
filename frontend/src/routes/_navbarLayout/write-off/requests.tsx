import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/write-off/requests')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_navbarLayout/write-off/requests"!</div>
}
