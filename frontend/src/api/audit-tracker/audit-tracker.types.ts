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
}

export interface MyIssuesReadModel {
  issues: AuditTrackerIssue[]
  summary: { total: number; created: number; inProgress: number; onHold: number }
  sites: Array<{ _id: string; name: string }>
  pagination: { page: number; limit: number; total: number; pages: number }
  filters: { search: string; site: string; status: string; priority: string }
}

export type AuditTrackerActivityEventType =
  | 'issue_raised'
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
