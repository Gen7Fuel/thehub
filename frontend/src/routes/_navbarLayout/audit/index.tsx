import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/audit/')({
  beforeLoad: () => {
    throw redirect({ to: '/audit/checklist' })
  },
})
