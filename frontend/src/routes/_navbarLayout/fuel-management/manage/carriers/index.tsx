import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_navbarLayout/fuel-management/manage/carriers/',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <div className='pl-4'>Select a carrier from the left.</div>
}
