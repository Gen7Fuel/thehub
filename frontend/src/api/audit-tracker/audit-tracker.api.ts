import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
import type {
  AddAuditTrackerActivityInput,
  AuditTrackerActivity,
  AuditTrackerActivityReadModel,
  AuditTrackerEscalationTarget,
  AuditTrackerIssue,
  AuditTrackerHistoricalActivityReadModel,
  AuditTrackerIssueHistoryReadModel,
  MyIssuesQuery,
  MyIssuesReadModel,
} from './audit-tracker.types'

export const auditTrackerApi = {
  async myIssues(query: MyIssuesQuery, options: RequestOptions): Promise<MyIssuesReadModel> {
    return (
      await apiClient.get('/station-audits/tracker/my-issues', {
        ...requestConfig(options),
        params: query,
      })
    ).data
  },
  async issueActivities(issueId: string, options: RequestOptions): Promise<AuditTrackerActivityReadModel> {
    return (
      await apiClient.get(`/station-audits/tracker/my-issues/${issueId}/activities`, {
        ...requestConfig(options),
        params: { limit: 100 },
      })
    ).data
  },
  async addIssueActivity(issueId: string, input: AddAuditTrackerActivityInput, options: RequestOptions): Promise<{ activity: AuditTrackerActivity }> {
    return (
      await apiClient.post(
        `/station-audits/tracker/my-issues/${issueId}/activities`,
        input,
        requestConfig(options),
      )
    ).data
  },
  async escalationTarget(issueId: string, options: RequestOptions): Promise<AuditTrackerEscalationTarget> {
    return (
      await apiClient.get(
        `/station-audits/tracker/my-issues/${issueId}/escalation-target`,
        requestConfig(options),
      )
    ).data
  },
  async updateIssueStatus(issueId: string, input: { status: string; comment: string }, options: RequestOptions): Promise<{ issue: AuditTrackerIssue }> {
    return (
      await apiClient.post(
        `/station-audits/tracker/my-issues/${issueId}/status`,
        input,
        requestConfig(options),
      )
    ).data
  },
  async escalateIssue(issueId: string, input: { reason: string }, options: RequestOptions): Promise<{ issue: AuditTrackerIssue }> {
    return (
      await apiClient.post(
        `/station-audits/tracker/my-issues/${issueId}/escalate`,
        input,
        requestConfig(options),
      )
    ).data
  },
  async issueHistory(issueId: string, options: RequestOptions): Promise<AuditTrackerIssueHistoryReadModel> {
    return (
      await apiClient.get(
        `/station-audits/tracker/my-issues/${issueId}/history`,
        requestConfig(options),
      )
    ).data
  },
  async historicalIssueActivities(issueId: string, historicalIssueId: string, options: RequestOptions): Promise<AuditTrackerHistoricalActivityReadModel> {
    return (
      await apiClient.get(
        `/station-audits/tracker/my-issues/${issueId}/history/${historicalIssueId}/activities`,
        requestConfig(options),
      )
    ).data
  },
}
