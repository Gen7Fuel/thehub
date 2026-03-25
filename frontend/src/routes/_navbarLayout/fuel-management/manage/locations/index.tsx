import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_navbarLayout/fuel-management/manage/locations/',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <div className='pl-4'>Select a location from the left.</div>
}
