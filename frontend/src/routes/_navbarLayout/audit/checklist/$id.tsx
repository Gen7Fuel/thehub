import { createFileRoute, useParams } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/audit/checklist/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = useParams({ from: '/_navbarLayout/audit/checklist/$id' });

  return <div>Hello "/_navbarLayout/audit/checklist/{id}"!</div>;
}
