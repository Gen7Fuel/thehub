import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/upload-invoice/list')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_navbarLayout/upload-invoice/list"!</div>
}
