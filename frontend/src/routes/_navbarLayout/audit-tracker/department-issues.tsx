import { createFileRoute } from '@tanstack/react-router'
import { Building2 } from 'lucide-react'
import { AuditTrackerPage } from '@/components/custom/station-audits/AuditTrackerPage'

export const Route = createFileRoute('/_navbarLayout/audit-tracker/department-issues')({
  component: DepartmentIssuesPage,
})

function DepartmentIssuesPage() {
  return (
    <AuditTrackerPage
      permission="departmentIssues"
      title="Department Issues"
      description="Review Station Audit issues belonging to your accessible departments."
      icon={Building2}
    />
  )
}
