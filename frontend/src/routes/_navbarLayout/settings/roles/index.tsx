import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_navbarLayout/settings/roles/',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <div className='pl-4'>Select a Role from the Left</div>
}