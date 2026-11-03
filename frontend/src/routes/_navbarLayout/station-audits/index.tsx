import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/station-audits/')({
  beforeLoad: () => {
    throw redirect({ to: '/station-audits/checklist' })
  },
})
