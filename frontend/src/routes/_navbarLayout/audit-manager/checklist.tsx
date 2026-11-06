import { createFileRoute } from '@tanstack/react-router'
import { ListChecks } from 'lucide-react'
import { AuditManagerPage } from '@/components/custom/station-audits/AuditManagerPage'

export const Route = createFileRoute('/_navbarLayout/audit-manager/checklist')({
  component: () => <AuditManagerPage permission="checklist" title="Checklist Management" description="Create and maintain Station Audit checklist definitions." icon={ListChecks} />,
})
