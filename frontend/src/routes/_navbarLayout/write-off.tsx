import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/write-off')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_navbarLayout/write-off"!</div>
}
