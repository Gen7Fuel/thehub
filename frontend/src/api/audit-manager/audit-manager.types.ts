export interface AuditManagerSite {
  _id: string
  stationName: string
  site?: string
}

export interface AuditManagerDepartmentSummary {
  _id: string
  name: string
  description?: string
  departmentHead?: string | AuditManagerUserSummary | null
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

export interface AuditManagerUniversalDepartmentResult {
  department: AuditManagerDepartmentSummary
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

export interface AuditManagerStatusOption {
  _id?: string
  key: string
  label: string
  sortOrder: number
}

export interface AuditManagerStatusOptionSet {
  _id: string
  name: string
  description: string
  options: AuditManagerStatusOption[]
  active: boolean
  checklistCount: number
  activeChecklistCount: number
  createdAt: string
  updatedAt: string
}

export interface AuditManagerStatusOptionSetList {
  statusOptionSets: AuditManagerStatusOptionSet[]
}

export interface AuditManagerStatusOptionUsage {
  checklists: Array<{
    _id: string
    item: string
    description: string
    active: boolean
    section: { _id: string; name: string; active: boolean } | null
  }>
}

export type AuditManagerStatusOptionSetUpdate =
  | { name: string }
  | { description: string }
  | { options: Array<{ label: string }> }
  | { active: boolean }

export type AuditManagerStatusOptionSetField = 'name' | 'description' | 'options' | 'active'
export type AuditManagerStatusOptionSetCreate = {
  name: string
  description: string
  options: Array<{ label: string }>
  active: boolean
}

export interface AuditManagerStatusOptionSetResult {
  statusOptionSet: AuditManagerStatusOptionSet
}

export interface AuditManagerChecklistSectionList {
  sections: AuditManagerSection[]
}

export interface AuditManagerChecklistDetail {
  _id: string
  item: string
  description: string
  sortOrder: number | null
  category: string
  frequency: 'daily' | 'weekly' | 'monthly'
  auditTypes: Array<'store' | 'visitor'>
  department: { _id: string; name: string; active: boolean } | null
  statusOptionSet: AuditManagerStatusOptionSet | null
  followUp: boolean
  commentRequired: boolean
  requestOrderEnabled: boolean
  suppliesVendor: string
  assignedSites: AuditManagerSite[]
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface AuditManagerChecklistSectionDetail {
  section: AuditManagerSection
  checklists: AuditManagerChecklistDetail[]
}

export interface AuditManagerChecklistEditOptions {
  sites: AuditManagerSite[]
  departments: Array<{
    _id: string
    name: string
    active: boolean
    departmentHead: AuditManagerUserSummary | null
    defaultIssueAssignees: AuditManagerUserSummary[]
  }>
  statusOptionSets: Array<AuditManagerStatusOptionSet & { checklistCount: number }>
  categories: string[]
  vendors: string[]
}

export type AuditManagerChecklistUpdate =
  | { item: string }
  | { description: string }
  | { category: string }
  | { frequency: 'daily' | 'weekly' | 'monthly' }
  | { auditTypes: Array<'store' | 'visitor'> }
  | { department: string }
  | { statusOptionSet: string }
  | { followUp: boolean }
  | { commentRequired: boolean }
  | { assignedSites: string[] }
  | { orderConfiguration: { enabled: boolean; vendor: string } }
  | { active: boolean }

export interface AuditManagerChecklistCreate {
  item: string
  description: string
  category: string
  frequency: 'daily' | 'weekly' | 'monthly'
  auditTypes: Array<'store' | 'visitor'>
  department: string
  statusOptionSet: string
  followUp: boolean
  commentRequired: boolean
  assignedSites: string[]
  orderConfiguration: { enabled: boolean; vendor: string }
  active: boolean
}

export type AuditManagerChecklistUpdateField =
  | 'item' | 'description' | 'category' | 'frequency' | 'auditTypes'
  | 'department' | 'statusOptionSet' | 'followUp'
  | 'commentRequired' | 'assignedSites' | 'orderConfiguration' | 'active'

export interface AuditManagerChecklistUpdateResult {
  checklist: AuditManagerChecklistDetail
}

export interface AuditManagerChecklistStatusCreate {
  name: string
  description: string
  options: Array<{ label: string }>
}
