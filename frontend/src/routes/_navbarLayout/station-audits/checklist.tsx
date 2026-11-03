import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/station-audits/checklist')({
  component: ChecklistLayout,
})

function ChecklistLayout() {
  return <Outlet />
}
