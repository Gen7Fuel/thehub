import { actionOptions } from '@/api/resources/action-options'
import { auditTrackerApi } from './audit-tracker.api'
import type { AddAuditTrackerActivityInput, AuditReportFrequency, MyIssuesQuery } from './audit-tracker.types'

export const auditTrackerService = {
  reportAvailability(query: { site: string; frequency: AuditReportFrequency; anchor: string }) {
    return auditTrackerApi.reportAvailability(query, actionOptions('auditTracker.report', 'audit-tracker.report.availability', 'read', 'station-audit-run', 'Station Audit report availability viewed'))
  },
  reportOverview(query: { site: string; frequency: AuditReportFrequency; date: string }) {
    return auditTrackerApi.reportOverview(query, actionOptions('auditTracker.report', 'audit-tracker.report.overview', 'read', 'station-audit-run', 'Station Audit report overview viewed'))
  },
  issuesBoard(query: { search?: string; site?: string; department?: string; priority?: string }) {
    return auditTrackerApi.issuesBoard(query, actionOptions('auditTracker.issuesBoard', 'audit-tracker.issues-board', 'read', 'station-audit-issue', 'Station Audit Issues Board viewed'))
  },
  issuesBoardActivity(issueId: string) {
    return auditTrackerApi.issuesBoardActivity(issueId, actionOptions('auditTracker.issuesBoard', 'audit-tracker.issues-board.activity', 'read', 'station-audit-issue-activity', 'Issues Board activity viewed'))
  },
  departmentIssues(query: MyIssuesQuery) {
    return auditTrackerApi.departmentIssues(query, actionOptions('auditTracker.departmentIssues', 'audit-tracker.department-issues', 'read', 'station-audit-issue', 'Department Station Audit issues viewed'))
  },
  departmentIssue(issueId: string) {
    return auditTrackerApi.departmentIssue(issueId, actionOptions('auditTracker.departmentIssues', 'audit-tracker.department-issues.detail', 'read', 'station-audit-issue', 'Department Station Audit issue opened'))
  },
  departmentIssueActivities(issueId: string) {
    return auditTrackerApi.departmentIssueActivities(issueId, actionOptions('auditTracker.departmentIssues', 'audit-tracker.department-issues.activity', 'read', 'station-audit-issue-activity', 'Department issue activity viewed'))
  },
  addDepartmentIssueActivity(issueId: string, input: AddAuditTrackerActivityInput) {
    return auditTrackerApi.addDepartmentIssueActivity(issueId, input, actionOptions('auditTracker.departmentIssues.postComments', 'audit-tracker.department-issues.activity', 'create', 'station-audit-issue-activity', 'Department issue activity added'))
  },
  updateDepartmentIssueStatus(issueId: string, input: { status: string; comment: string }) {
    return auditTrackerApi.updateDepartmentIssueStatus(issueId, input, actionOptions('auditTracker.departmentIssues.updateStatus', 'audit-tracker.department-issues.status', 'update', 'station-audit-issue', 'Department issue status updated'))
  },
  departmentOptions(issueId: string) {
    return auditTrackerApi.departmentOptions(issueId, actionOptions('auditTracker.departmentIssues.changeDepartment', 'audit-tracker.department-issues.department', 'read', 'station-audit-department', 'Issue department options viewed'))
  },
  updateDepartmentIssuePriority(issueId: string, priority: string) {
    return auditTrackerApi.updateDepartmentIssuePriority(issueId, priority, actionOptions('auditTracker.departmentIssues.changePriority', 'audit-tracker.department-issues.priority', 'update', 'station-audit-issue', 'Issue priority updated'))
  },
  changeDepartmentIssueDepartment(issueId: string, input: { department: string; comment: string }) {
    return auditTrackerApi.changeDepartmentIssueDepartment(issueId, input, actionOptions('auditTracker.departmentIssues.changeDepartment', 'audit-tracker.department-issues.department', 'update', 'station-audit-issue', 'Issue department changed'))
  },
  assignmentOptions(issueId: string) {
    return auditTrackerApi.assignmentOptions(issueId, actionOptions('auditTracker.departmentIssues.changeAssignment', 'audit-tracker.department-issues.assignment', 'read', 'station-audit-department', 'Issue assignment options viewed'))
  },
  changeDepartmentIssueAssignments(issueId: string, assignments: Array<{ user: string; role: 'owner' | 'collaborator' }>) {
    return auditTrackerApi.changeDepartmentIssueAssignments(issueId, assignments, actionOptions('auditTracker.departmentIssues.changeAssignment', 'audit-tracker.department-issues.assignment', 'update', 'station-audit-issue', 'Issue assignment changed'))
  },
  departmentIssueHistory(issueId: string) {
    return auditTrackerApi.departmentIssueHistory(issueId, actionOptions('auditTracker.departmentIssues', 'audit-tracker.department-issues.history', 'read', 'station-audit-issue', 'Department historical issues viewed'))
  },
  historicalDepartmentIssueActivities(issueId: string, historicalIssueId: string) {
    return auditTrackerApi.historicalDepartmentIssueActivities(issueId, historicalIssueId, actionOptions('auditTracker.departmentIssues', 'audit-tracker.department-issues.history', 'read', 'station-audit-issue-activity', 'Department historical issue activity viewed'))
  },
  myIssues(query: MyIssuesQuery) {
    return auditTrackerApi.myIssues(
      query,
      actionOptions(
        'auditTracker.myIssues',
        'audit-tracker.my-issues',
        'read',
        'station-audit-issue',
        'Assigned open Station Audit issues viewed',
      ),
    )
  },
  myIssue(issueId: string) {
    return auditTrackerApi.myIssue(
      issueId,
      actionOptions('auditTracker.myIssues', 'audit-tracker.my-issues.detail', 'read', 'station-audit-issue', 'Assigned Station Audit issue opened'),
    )
  },
  issueActivities(issueId: string) {
    return auditTrackerApi.issueActivities(
      issueId,
      actionOptions(
        'auditTracker.myIssues',
        'audit-tracker.my-issues.activity',
        'read',
        'station-audit-issue-activity',
        'Station Audit issue activity viewed',
      ),
    )
  },
  addIssueActivity(issueId: string, input: AddAuditTrackerActivityInput) {
    return auditTrackerApi.addIssueActivity(
      issueId,
      input,
      actionOptions(
        'auditTracker.myIssues.postComments',
        'audit-tracker.my-issues.activity',
        'create',
        'station-audit-issue-activity',
        'Station Audit issue activity added',
      ),
    )
  },
  escalationTarget(issueId: string) {
    return auditTrackerApi.escalationTarget(
      issueId,
      actionOptions('auditTracker.myIssues.escalateIssue', 'audit-tracker.my-issues.escalation', 'read', 'station-audit-department', 'Station Audit escalation destination viewed'),
    )
  },
  updateIssueStatus(issueId: string, input: { status: string; comment: string }) {
    return auditTrackerApi.updateIssueStatus(
      issueId,
      input,
      actionOptions('auditTracker.myIssues.updateStatus', 'audit-tracker.my-issues.status', 'update', 'station-audit-issue', 'Station Audit issue status updated'),
    )
  },
  escalateIssue(issueId: string, input: { reason: string }) {
    return auditTrackerApi.escalateIssue(
      issueId,
      input,
      actionOptions('auditTracker.myIssues.escalateIssue', 'audit-tracker.my-issues.escalation', 'update', 'station-audit-issue', 'Station Audit issue escalated'),
    )
  },
  issueHistory(issueId: string) {
    return auditTrackerApi.issueHistory(
      issueId,
      actionOptions('auditTracker.myIssues', 'audit-tracker.my-issues.history', 'read', 'station-audit-issue', 'Historical Station Audit issues viewed'),
    )
  },
  historicalIssueActivities(issueId: string, historicalIssueId: string) {
    return auditTrackerApi.historicalIssueActivities(
      issueId,
      historicalIssueId,
      actionOptions('auditTracker.myIssues', 'audit-tracker.my-issues.history', 'read', 'station-audit-issue-activity', 'Historical Station Audit issue activity viewed'),
    )
  },
}
