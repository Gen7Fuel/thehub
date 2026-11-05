import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/station-audits/visitor')({
  component: Outlet,
})
