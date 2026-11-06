import { createFileRoute } from '@tanstack/react-router'
import { SlidersHorizontal } from 'lucide-react'
import { AuditManagerPage } from '@/components/custom/station-audits/AuditManagerPage'

export const Route = createFileRoute('/_navbarLayout/audit-manager/status-options')({
  component: () => <AuditManagerPage permission="statusOptions" title="Status Option Management" description="Create and maintain reusable checklist status option sets." icon={SlidersHorizontal} />,
})
