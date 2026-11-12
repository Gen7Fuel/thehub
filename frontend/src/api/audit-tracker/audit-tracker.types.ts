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
