import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
import type {
  AddAuditTrackerActivityInput,
  AuditTrackerActivity,
  AuditTrackerActivityReadModel,
  AuditTrackerEscalationTarget,
  AuditTrackerDepartmentOption,
  AuditTrackerAssignmentCandidate,
  AuditTrackerBoardReadModel,
  AuditTrackerIssue,
  AuditTrackerHistoricalActivityReadModel,
  AuditTrackerIssueHistoryReadModel,
  AuditReportFrequency,
  AuditReportAvailability,
  AuditReportOverview,
  AuditReportSection,
  AuditVisitorComparison,
  MyIssuesQuery,
  MyIssuesReadModel,
} from './audit-tracker.types'

export const auditTrackerApi = {
  async reportAvailability(query: { site: string; type: 'store' | 'visitor'; frequency: AuditReportFrequency; anchor: string }, options: RequestOptions): Promise<AuditReportAvailability> {
    return (await apiClient.get('/station-audits/tracker/reports/availability', { ...requestConfig(options), params: query })).data
  },
  async reportOverview(query: { site: string; type: 'store' | 'visitor'; frequency: AuditReportFrequency; date: string; visitorIndex?: number }, options: RequestOptions): Promise<AuditReportOverview> {
    return (await apiClient.get('/station-audits/tracker/reports/overview', { ...requestConfig(options), params: query })).data
  },
  async reportSection(sectionId: string, query: { site: string; type: 'store' | 'visitor'; frequency: AuditReportFrequency; date: string }, options: RequestOptions): Promise<AuditReportSection> {
    return (await apiClient.get(`/station-audits/tracker/reports/sections/${sectionId}`, { ...requestConfig(options), params: query })).data
  },
  async visitorComparison(sectionId: string, query: { site: string; frequency: AuditReportFrequency; date: string; visitorIndex: number }, options: RequestOptions): Promise<AuditVisitorComparison> {
    return (await apiClient.get(`/station-audits/tracker/reports/visitor-comparison/${sectionId}`, { ...requestConfig(options), params: query })).data
  },
  async issuesBoard(query: { search?: string; site?: string; department?: string; priority?: string }, options: RequestOptions): Promise<AuditTrackerBoardReadModel> {
    return (await apiClient.get('/station-audits/tracker/issues-board', { ...requestConfig(options), params: query })).data
  },
  async issuesBoardActivity(issueId: string, options: RequestOptions): Promise<AuditTrackerActivityReadModel> {
    return (await apiClient.get(`/station-audits/tracker/issues-board/${issueId}/activities`, requestConfig(options))).data
  },
  async departmentIssues(query: MyIssuesQuery, options: RequestOptions): Promise<MyIssuesReadModel> {
    return (await apiClient.get('/station-audits/tracker/department-issues', { ...requestConfig(options), params: query })).data
  },
  async departmentIssue(issueId: string, options: RequestOptions): Promise<{ issue: AuditTrackerIssue }> {
    return (await apiClient.get(`/station-audits/tracker/department-issues/${issueId}`, requestConfig(options))).data
  },
  async departmentIssueActivities(issueId: string, options: RequestOptions): Promise<AuditTrackerActivityReadModel> {
    return (await apiClient.get(`/station-audits/tracker/department-issues/${issueId}/activities`, { ...requestConfig(options), params: { limit: 100 } })).data
  },
  async addDepartmentIssueActivity(issueId: string, input: AddAuditTrackerActivityInput, options: RequestOptions): Promise<{ activity: AuditTrackerActivity }> {
    return (await apiClient.post(`/station-audits/tracker/department-issues/${issueId}/activities`, input, requestConfig(options))).data
  },
  async updateDepartmentIssueStatus(issueId: string, input: { status: string; comment: string }, options: RequestOptions): Promise<{ issue: AuditTrackerIssue }> {
    return (await apiClient.post(`/station-audits/tracker/department-issues/${issueId}/status`, input, requestConfig(options))).data
  },
  async departmentOptions(issueId: string, options: RequestOptions): Promise<{ departments: AuditTrackerDepartmentOption[] }> {
    return (await apiClient.get(`/station-audits/tracker/department-issues/${issueId}/department-options`, requestConfig(options))).data
  },
  async updateDepartmentIssuePriority(issueId: string, priority: string, options: RequestOptions): Promise<{ issue: AuditTrackerIssue }> {
    return (await apiClient.post(`/station-audits/tracker/department-issues/${issueId}/priority`, { priority }, requestConfig(options))).data
  },
  async changeDepartmentIssueDepartment(issueId: string, input: { department: string; comment: string }, options: RequestOptions): Promise<{ issue: AuditTrackerIssue }> {
    return (await apiClient.post(`/station-audits/tracker/department-issues/${issueId}/department`, input, requestConfig(options))).data
  },
  async assignmentOptions(issueId: string, options: RequestOptions): Promise<{ users: AuditTrackerAssignmentCandidate[] }> {
    return (await apiClient.get(`/station-audits/tracker/department-issues/${issueId}/assignment-options`, requestConfig(options))).data
  },
  async changeDepartmentIssueAssignments(issueId: string, assignments: Array<{ user: string; role: 'owner' | 'collaborator' }>, options: RequestOptions): Promise<{ issue: AuditTrackerIssue }> {
    return (await apiClient.post(`/station-audits/tracker/department-issues/${issueId}/assignments`, { assignments }, requestConfig(options))).data
  },
  async departmentIssueHistory(issueId: string, options: RequestOptions): Promise<AuditTrackerIssueHistoryReadModel> {
    return (await apiClient.get(`/station-audits/tracker/department-issues/${issueId}/history`, requestConfig(options))).data
  },
  async historicalDepartmentIssueActivities(issueId: string, historicalIssueId: string, options: RequestOptions): Promise<AuditTrackerHistoricalActivityReadModel> {
    return (await apiClient.get(`/station-audits/tracker/department-issues/${issueId}/history/${historicalIssueId}/activities`, requestConfig(options))).data
  },
  async myIssueCounts(options: RequestOptions): Promise<{ pending: number; unread: number }> {
    return (await apiClient.get('/station-audits/tracker/my-issues/counts', requestConfig(options))).data
  },
  async myIssues(query: MyIssuesQuery, options: RequestOptions): Promise<MyIssuesReadModel> {
    return (
      await apiClient.get('/station-audits/tracker/my-issues', {
        ...requestConfig(options),
        params: query,
      })
    ).data
  },
  async myIssue(issueId: string, options: RequestOptions): Promise<{ issue: AuditTrackerIssue }> {
    return (
      await apiClient.get(
        `/station-audits/tracker/my-issues/${issueId}`,
        requestConfig(options),
      )
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
