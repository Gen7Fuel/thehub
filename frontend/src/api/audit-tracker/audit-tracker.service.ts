import { actionOptions } from '@/api/resources/action-options'
import { auditTrackerApi } from './audit-tracker.api'
import type { AddAuditTrackerActivityInput, MyIssuesQuery } from './audit-tracker.types'

export const auditTrackerService = {
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
