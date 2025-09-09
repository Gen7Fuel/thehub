import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/settings/users/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div className='pl-4'>Select a user from the left</div>
}
