import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/cycle-count/manage/group')(
  {
    component: RouteComponent,
  },
)

function RouteComponent() {
  return <div>Hello "/_navbarLayout/cycle-count/manage/group"!</div>
}
