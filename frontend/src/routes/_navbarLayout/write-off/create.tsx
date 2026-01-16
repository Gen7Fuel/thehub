import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/write-off/create')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_navbarLayout/write-off/create"!</div>
}
