export type StationAuditFrequency = 'all' | 'daily' | 'weekly' | 'monthly'

export interface StationAuditStatusOption {
  _id: string
  key: string
  label: string
}

export interface StationAuditChecklistItem {
  _id: string
  item: string
  description: string
  sortOrder: number
  category: string
  frequency: Exclude<StationAuditFrequency, 'all'>
  auditTypes: Array<'store' | 'visitor'>
  commentRequired: boolean
  requestOrderEnabled: boolean
  suppliesVendor: string
  department: { _id: string; name: string; departmentHead?: string | null }
  statusOptionSet: {
    _id: string
    name: string
    options: StationAuditStatusOption[]
  }
  followUp: boolean
  completed: boolean
  run: { _id: string; periodKey: string; state: string; completedAt?: string | null } | null
  response: {
    _id: string
    checked: boolean
    checkedAt?: string | null
    selectedStatus?: { optionId?: string; key?: string; label?: string }
    comment?: string
    photos?: string[]
    issueRaised?: boolean
    issue?: string | null
  } | null
}

export interface SaveStationAuditResponseInput {
  checked: boolean
  statusOptionId: string
  comment: string
  photos: string[]
  issueRaised: boolean
}

export interface SaveStationAuditResponseResult {
  run: { _id: string; periodKey: string; state: string; completedAt?: string | null }
  response: NonNullable<StationAuditChecklistItem['response']>
  completed: boolean
  issue: { _id: string } | null
  summary: { total: number; completed: number; pending: number }
}

export interface StationAuditChecklistSection {
  _id: string
  name: string
  description: string
  sortOrder: number
  sectionType: 'checklist' | 'order'
  summary: { total: number; completed: number; pending: number }
  checklists: StationAuditChecklistItem[]
}

export interface StationAuditChecklistReadModel {
  location: { _id: string; name: string; timezone: string }
  type: 'store' | 'visitor'
  frequency: StationAuditFrequency
  periodKeys: Record<'daily' | 'weekly' | 'monthly', string>
  summary: { total: number; completed: number; pending: number }
  sections: StationAuditChecklistSection[]
}

export interface StationAuditSectionSummary {
  _id: string
  name: string
  description: string
  sortOrder: number
  sectionType: 'checklist' | 'order'
  summary: { total: number; completed: number; pending: number }
  frequencies: Record<'daily' | 'weekly' | 'monthly', { total: number; completed: number; pending: number }>
}

export interface StationAuditSectionListReadModel {
  location: { _id: string; name: string; timezone: string }
  type: 'store' | 'visitor'
  periodKeys: Record<'daily' | 'weekly' | 'monthly', string>
  summary: { total: number; completed: number; pending: number }
  sections: StationAuditSectionSummary[]
}
