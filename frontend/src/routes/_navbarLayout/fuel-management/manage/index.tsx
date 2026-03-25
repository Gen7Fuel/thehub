import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/fuel-management/manage/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div className='pl-4'>Select an option from the left.</div>
}
