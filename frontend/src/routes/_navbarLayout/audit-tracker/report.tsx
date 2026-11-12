import { createFileRoute } from '@tanstack/react-router'
import { ChartNoAxesCombined } from 'lucide-react'
import { AuditTrackerPage } from '@/components/custom/station-audits/AuditTrackerPage'

export const Route = createFileRoute('/_navbarLayout/audit-tracker/report')({
  component: AuditTrackerReportPage,
})

function AuditTrackerReportPage() {
  return (
    <AuditTrackerPage
      permission="report"
      title="Audit Tracker Report"
      description="Analyze issue status, ownership, recurrence, and resolution performance."
      icon={ChartNoAxesCombined}
    />
  )
}
