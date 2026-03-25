import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_navbarLayout/fuel-management/manage/racks/',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <div className='pl-4'>Select a rack from the left.</div>
}
