export interface AuditManagerSite {
  _id: string
  stationName: string
  site?: string
}

export interface AuditManagerDepartmentSummary {
  _id: string
  name: string
  description?: string
  departmentHead?: string | null
  members?: Array<{ user: string; addedAt?: string; addedBy?: string | null }>
  assignmentStrategy: 'department_head' | 'station_manager' | 'operations_queue'
  isAdminDepartment?: boolean
  active: boolean
}

export interface AuditManagerSection {
  _id: string
  name: string
  description: string
  sortOrder: number | null
  sectionType: 'checklist' | 'order'
  sites: AuditManagerSite[]
  departments: AuditManagerDepartmentSummary[]
  active: boolean
  checklistCount: number
  activeChecklistCount: number
  createdAt: string
  updatedAt: string
}

export interface AuditManagerSectionList {
  sections: AuditManagerSection[]
  options: {
    sites: AuditManagerSite[]
    departments: AuditManagerDepartmentSummary[]
  }
}

export type AuditManagerSectionUpdate =
  | { name: string }
  | { description: string }
  | { sectionType: 'checklist' | 'order' }
  | { sites: string[] }
  | { departments: string[] }
  | { active: boolean }

export interface AuditManagerSectionUpdateResult {
  section: AuditManagerSection
}

export interface AuditManagerSectionCreate {
  name: string
  description: string
  sectionType: 'checklist' | 'order'
  sites: string[]
  departments: string[]
  active: boolean
}

export interface AuditManagerUniversalSiteResult {
  site: AuditManagerSite
  updatedSections: number
}

export interface AuditManagerUserSummary {
  _id: string
  firstName: string
  lastName: string
  email: string
  is_active?: boolean
  role?: { _id: string; role_name: string } | null
}

export interface AuditManagerDepartmentDetail {
  _id: string
  name: string
  description: string
  departmentHead: AuditManagerUserSummary | null
  members: Array<{ user: AuditManagerUserSummary | null; addedBy?: AuditManagerUserSummary | null; addedAt?: string }>
  memberCount: number
  defaultIssueAssignees: AuditManagerUserSummary[]
  assignmentStrategy: 'department_head' | 'station_manager' | 'operations_queue'
  isAdminDepartment: boolean
  accessScope: 'admin' | 'member'
  escalationDepartment?: { _id: string; name: string; active: boolean } | null
  notificationEmails: string[]
  siteNotifications: Array<{ site: AuditManagerSite | null; emails: string[] }>
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface AuditManagerDepartmentList {
  departments: AuditManagerDepartmentDetail[]
}

export interface AuditManagerDepartmentOptions {
  users: AuditManagerUserSummary[]
  sites: AuditManagerSite[]
  departments: Array<{ _id: string; name: string; active: boolean }>
}

export type AuditManagerDepartmentUpdate =
  | { name: string }
  | { description: string }
  | { departmentHead: string | null }
  | { members: string[] }
  | { defaultIssueAssignees: string[] }
  | { assignmentStrategy: AuditManagerDepartmentDetail['assignmentStrategy'] }
  | { escalationDepartment: string | null }
  | { notificationEmails: string[] }
  | { siteNotifications: Array<{ site: string; emails: string[] }> }
  | { active: boolean }

export type AuditManagerDepartmentUpdateField =
  | 'name'
  | 'description'
  | 'departmentHead'
  | 'members'
  | 'defaultIssueAssignees'
  | 'assignmentStrategy'
  | 'escalationDepartment'
  | 'notificationEmails'
  | 'siteNotifications'
  | 'active'

export interface AuditManagerDepartmentUpdateResult {
  department: AuditManagerDepartmentDetail
}

export interface AuditManagerDepartmentCreate {
  name: string
  description: string
  departmentHead: string | null
  members: string[]
  defaultIssueAssignees: string[]
  assignmentStrategy: AuditManagerDepartmentDetail['assignmentStrategy']
  escalationDepartment: string | null
  notificationEmails: string[]
  siteNotifications: Array<{ site: string; emails: string[] }>
  active: boolean
}
