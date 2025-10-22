import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/settings/sites/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div className='pl-4'>Select a site from the left</div>
}
