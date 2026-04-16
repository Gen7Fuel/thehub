import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/support/')({
  beforeLoad: () => {
    throw redirect({ to: '/support/list' })
  },
  component: () => null,
})
