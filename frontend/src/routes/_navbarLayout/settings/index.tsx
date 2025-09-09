import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/settings/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div className='pl-4'>Select a settings option from the left.</div>
}
