export type AuditTrackerIssueStatus = 'created' | 'in_progress' | 'on_hold' | 'resolved'
export type AuditTrackerIssuePriority = 'low' | 'normal' | 'high' | 'critical'

export interface AuditTrackerPerson {
  _id: string
  firstName: string
  lastName: string
  email: string
  is_active?: boolean
}

export interface AuditTrackerIssue {
  _id: string
  status: AuditTrackerIssueStatus
  priority: AuditTrackerIssuePriority
  snapshot: {
    sectionName: string
    checklistItem: string
    category: string
    departmentName: string
    statusKey: string
    statusLabel: string
    originalComment: string
    originalPhotos: string[]
  }
  site: { _id: string; stationName: string; site?: string; timezone?: string }
  originDepartment: { _id: string; name: string }
  currentDepartment: { _id: string; name: string }
  assignees: Array<{
    user: AuditTrackerPerson
    role: 'owner' | 'collaborator'
    assignedBy?: string | null
    assignedAt: string
    read: boolean
    readAt?: string | null
  }>
  escalation: {
    level: 'none' | 'department' | 'head_office'
    escalatedAt?: string | null
    escalatedBy?: string | null
    reason?: string
  }
  response: {
    _id: string
    selectedStatus?: { key?: string; label?: string }
    comment?: string
    photos?: string[]
    checkedAt?: string | null
    checkedBy?: AuditTrackerPerson | null
  }
  run: {
    _id: string
    frequency: 'daily' | 'weekly' | 'monthly'
    periodKey: string
    type: 'store' | 'visitor'
    startedAt: string
    completedAt?: string | null
  }
  raisedBy: AuditTrackerPerson
  raisedAt: string
  updatedAt: string
  previousIssue?: string | null
  occurrenceNumber: number
}

export interface MyIssuesQuery {
  search?: string
  site?: string
  status?: 'all' | Exclude<AuditTrackerIssueStatus, 'resolved'>
  priority?: 'all' | AuditTrackerIssuePriority
  page?: number
  limit?: number
  department?: string
}

export interface MyIssuesReadModel {
  issues: AuditTrackerIssue[]
  summary: { total: number; created: number; inProgress: number; onHold: number }
  sites: Array<{ _id: string; name: string }>
  departments?: Array<{ _id: string; name: string; isAdminDepartment: boolean }>
  pagination: { page: number; limit: number; total: number; pages: number }
  filters: { search: string; site: string; status: string; priority: string; department?: string }
}

export type AuditTrackerActivityEventType =
  | 'issue_raised'
  | 'issue_viewed'
  | 'comment_added'
  | 'photos_added'
  | 'status_changed'
  | 'priority_changed'
  | 'assignment_changed'
  | 'department_changed'
  | 'escalated'
  | 'resolved'
  | 'reopened'

export interface AuditTrackerActivity {
  _id: string
  eventType: AuditTrackerActivityEventType
  actor: AuditTrackerPerson | null
  body: string
  photos: string[]
  changes: Array<{
    field: string
    from: { id?: string | null; value?: string; label?: string }
    to: { id?: string | null; value?: string; label?: string }
  }>
  createdAt: string
  updatedAt: string
}

export interface AuditTrackerActivityReadModel {
  activities: AuditTrackerActivity[]
  total: number
  hasMore: boolean
}

export interface AddAuditTrackerActivityInput {
  body: string
  photos: string[]
}

export interface AuditTrackerEscalationTarget {
  department: { _id: string; name: string; isAdminDepartment: boolean }
  assignees: AuditTrackerPerson[]
}

export interface AuditTrackerDepartmentOption {
  _id: string
  name: string
  isAdminDepartment: boolean
  current: boolean
  assignees: AuditTrackerPerson[]
}

export interface AuditTrackerAssignmentCandidate extends AuditTrackerPerson {
  departments: Array<{ _id: string; name: string; current: boolean }>
}

export interface AuditTrackerBoardReadModel {
  sections: Record<AuditTrackerIssueStatus, { issues: AuditTrackerIssue[]; total: number }>
  sites: Array<{ _id: string; name: string }>
  departments: Array<{ _id: string; name: string }>
  filters: { site: string; department: string; priority: string; search: string }
  resolvedWindowDays: number
}

export interface AuditTrackerHistoricalIssue {
  _id: string
  status: AuditTrackerIssueStatus
  priority: AuditTrackerIssuePriority
  snapshot: AuditTrackerIssue['snapshot']
  site: AuditTrackerIssue['site']
  currentDepartment: { _id: string; name: string } | null
  assignees: AuditTrackerIssue['assignees']
  occurrenceNumber: number
  raisedAt: string
  resolvedAt?: string | null
  updatedAt: string
}

export interface AuditTrackerIssueHistoryReadModel {
  currentSite: AuditTrackerHistoricalIssue[]
  otherSites: AuditTrackerHistoricalIssue[]
  total: number
  window: { from: string; to: string }
}

export interface AuditTrackerHistoricalActivityReadModel {
  issue: AuditTrackerHistoricalIssue
  activities: AuditTrackerActivity[]
}

export type AuditReportFrequency = 'daily' | 'weekly' | 'monthly'

export interface AuditReportAvailability {
  type: 'store' | 'visitor'
  frequency: AuditReportFrequency
  anchor: string
  periods: Array<{
    periodKey: string
    date: string
    endDate?: string
    label: string
    runCount: number
    completedRunCount: number
    hasData: boolean
  }>
}

export interface AuditReportOverview {
  type: 'store' | 'visitor'
  frequency: AuditReportFrequency
  location: { _id: string; name: string; timezone: string }
  sites: Array<{ _id: string; name: string }>
  period: { periodKey: string; start: string; end: string; label: string }
  summary: { total: number; completed: number; pending: number }
  sections: Array<{
    _id: string
    name: string
    description: string
    sortOrder: number | null
    run: { _id: string; state: 'in_progress' | 'completed'; startedBy?: AuditTrackerPerson | null; completedBy?: AuditTrackerPerson | null; completedAt?: string | null } | null
    summary: { total: number; completed: number; pending: number }
  }>
}

export interface AuditReportSection {
  type: 'store' | 'visitor'
  frequency: AuditReportFrequency
  location: { _id: string; name: string; timezone: string }
  period: { periodKey: string; start: string; end: string; label: string }
  section: { _id: string; name: string; description: string }
  run: { _id: string; state: 'in_progress' | 'completed'; startedBy?: AuditTrackerPerson | null; completedBy?: AuditTrackerPerson | null; startedAt: string; completedAt?: string | null } | null
  summary: { total: number; completed: number; pending: number }
  checklists: Array<{
    checklist: string
    expectedRevision: { _id: string; version: string } | null
    submittedRevision: string | null
    snapshot: {
      item: string
      description: string
      category: string
      frequency: AuditReportFrequency
      sortOrder: number | null
      departmentName: string
    }
    completed: boolean
    response: null | {
      selectedStatus?: { key?: string; label?: string }
      comment?: string
      photos?: string[]
      checkedAt?: string | null
      checkedBy?: AuditTrackerPerson | null
      issueRaised?: boolean
      requestOrder?: boolean
      orderCreated?: boolean
    }
  }>
}

export interface AuditVisitorComparison {
  type: 'visitor'
  frequency: AuditReportFrequency
  location: { _id: string; name: string; timezone: string }
  period: AuditReportSection['period']
  section: AuditReportSection['section']
  storeRun: AuditReportSection['run']
  visitorRun: AuditReportSection['run']
  summary: { total: number; differing: number; statusDifferences: number; issueDifferences: number }
  checklists: Array<{
    checklist: string
    snapshot: AuditReportSection['checklists'][number]['snapshot']
    store: AuditReportSection['checklists'][number] | null
    visitor: AuditReportSection['checklists'][number] | null
    statusDiffers: boolean
    issueDiffers: boolean
    differs: boolean
  }>
}
