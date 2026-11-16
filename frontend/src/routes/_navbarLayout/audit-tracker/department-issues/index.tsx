import { createFileRoute } from '@tanstack/react-router'
import { IssueQueuePage } from '../my-issues/index'

export const Route = createFileRoute('/_navbarLayout/audit-tracker/department-issues/')({
  component: DepartmentIssuesPage,
})

function DepartmentIssuesPage() {
  return <IssueQueuePage scope="departmentIssues" />
}
