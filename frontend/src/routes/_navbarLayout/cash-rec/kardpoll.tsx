import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/cash-rec/kardpoll')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_navbarLayout/cash-rec/kardpoll"!</div>
}
