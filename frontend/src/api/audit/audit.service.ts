import { actionOptions } from '@/api/resources/action-options'
import { auditApi } from './audit.api'

const read = (permission: string, source: string, resourceType: string, message: string) =>
  actionOptions(permission, source, 'read', resourceType, message)
const mutate = (permission: string, source: string, action: 'create' | 'update' | 'delete', resourceType: string, message: string) =>
  actionOptions(permission, source, action, resourceType, message)

const sources = {
  checklist: 'station-audit.checklist',
  interface: 'station-audit.interface',
  visitor: 'station-audit.visitor',
  templates: 'station-audit.templates',
  dashboard: 'dashboard.station-audit',
} as const

type AuditSubmission = {
  site: string
  [key: string]: unknown
}

type AuditReadContext = {
  checklistName?: string
  periodLabel?: string
}

const label = (value: unknown, fallback: string) => {
  const text = String(value || '').trim()
  return text || fallback
}

const withPeriod = (message: string, periodLabel?: string) =>
  periodLabel ? `${message} — ${periodLabel}` : message

export const auditService = {
  listChecklistTemplates<T = unknown[]>() {
    return auditApi.listTemplates<T>(read('stationAudit', sources.checklist, 'audit-template', 'Station Audit checklists viewed'))
  },
  listInterfaceTemplates<T = unknown[]>() {
    return auditApi.listTemplates<T>(read('stationAudit.interface', sources.interface, 'audit-template', 'Station Audit interface templates viewed'))
  },
  listVisitorTemplates<T = unknown[]>() {
    return auditApi.listTemplates<T>(read('stationAudit.visitor', sources.visitor, 'audit-template', 'Visitor Audit templates viewed'))
  },
  listAdminTemplates<T = unknown[]>() {
    return auditApi.listTemplates<T>(read('stationAudit.template', sources.templates, 'audit-template', 'Station Audit templates viewed for administration'))
  },
  getTemplateForAdmin<T = unknown>(id: string, name?: string) {
    return auditApi.getTemplate<T>(id, {}, read('stationAudit.template', sources.templates, 'audit-template', `Station Audit checklist template ${label(name, 'selected checklist')} opened for editing`))
  },
  createTemplate<T = unknown>(input: unknown, name: string) {
    return auditApi.createTemplate<T>(input, mutate('stationAudit.template', sources.templates, 'create', 'audit-template', `Station Audit template ${name} creation requested`))
  },
  updateTemplate<T = unknown>(id: string, input: unknown, name: string) {
    return auditApi.updateTemplate<T>(id, input, mutate('stationAudit.template', sources.templates, 'update', 'audit-template', `Station Audit template ${name} update requested`))
  },
  removeTemplate(id: string, name = id) {
    return auditApi.removeTemplate(id, mutate('stationAudit.template', sources.templates, 'delete', 'audit-template', `Station Audit template ${name} deletion requested`))
  },
  listSelectTemplates<T = unknown[]>(context: 'checklist' | 'interface' | 'visitor' | 'templates') {
    const permission = context === 'templates' ? 'stationAudit.template' : context === 'interface' ? 'stationAudit.interface' : context === 'visitor' ? 'stationAudit.visitor' : 'stationAudit.checklist'
    const message = context === 'templates'
      ? 'Audit status and dropdown option sets viewed for administration'
      : `Audit status and dropdown options viewed for ${context}`
    return auditApi.listSelectTemplates<T>(read(permission, sources[context], 'audit-select-template', message))
  },
  getSelectTemplate<T = unknown>(id: string, name?: string) {
    return auditApi.getSelectTemplate<T>(id, read('stationAudit.template', sources.templates, 'audit-select-template', `Audit status/dropdown option set ${label(name, 'selected option set')} opened for editing`))
  },
  createSelectTemplate<T = unknown>(input: unknown, name: string) {
    return auditApi.createSelectTemplate<T>(input, mutate('stationAudit.template', sources.templates, 'create', 'audit-select-template', `Audit dropdown template ${name} creation requested`))
  },
  updateSelectTemplate<T = unknown>(id: string, input: unknown, name: string) {
    return auditApi.updateSelectTemplate<T>(id, input, mutate('stationAudit.template', sources.templates, 'update', 'audit-select-template', `Audit dropdown template ${name} update requested`))
  },
  removeSelectTemplate(id: string, name = id) {
    return auditApi.removeSelectTemplate(id, mutate('stationAudit.template', sources.templates, 'delete', 'audit-select-template', `Audit dropdown template ${name} deletion requested`))
  },
  getChecklistStats<T = unknown>(site: string, periodKeys: Record<string, string>) {
    return auditApi.getStationStats<T>(site, periodKeys, read('stationAudit', sources.checklist, 'audit-statistics', `Station Audit statistics viewed for ${site}`))
  },
  getDashboardStats<T = unknown>(site: string, periodKeys: Record<string, string>) {
    return auditApi.getStationStats<T>(site, periodKeys, read('dashboard', sources.dashboard, 'audit-statistics', `Station Audit statistics viewed on Dashboard for ${site}`))
  },
  getChecklistItems<T = unknown>(query: Record<string, unknown>, context: AuditReadContext = {}) {
    const name = label(context.checklistName, 'selected checklist')
    const message = withPeriod(`Station Audit checklist ${name} opened for ${label(query.site, 'selected site')}`, context.periodLabel)
    return auditApi.getItemsFull<T>(query, read('stationAudit.checklist', sources.checklist, 'audit-item', message))
  },
  getVisitorItems<T = unknown>(query: Record<string, unknown>, context: AuditReadContext = {}) {
    const name = label(context.checklistName, 'selected checklist')
    const message = withPeriod(`Visitor Audit checklist ${name} opened for ${label(query.site, 'selected site')}`, context.periodLabel)
    return auditApi.getItemsFull<T>(query, read('stationAudit.visitor', sources.visitor, 'audit-item', message))
  },
  compareAudits<T = unknown>(query: Record<string, unknown>, context: AuditReadContext = {}) {
    const name = label(context.checklistName, 'selected checklist')
    const message = withPeriod(`Store and visitor audits compared for ${label(query.site, 'selected site')} — ${name}`, context.periodLabel)
    return auditApi.compare<T>(query, read('stationAudit.interface', sources.interface, 'audit-comparison', message))
  },
  listStationIssues<T = unknown>(site: string) {
    return auditApi.listOpenIssues<T>({ mode: 'station', site }, read('stationAudit', sources.checklist, 'audit-issue', `Open Station Audit issues viewed for ${site}`))
  },
  listInterfaceIssues<T = unknown>(query: Record<string, unknown>) {
    const department = query.assignedTo ? ` for ${String(query.assignedTo)}` : ''
    const message = `All open Station Audit issues viewed for ${label(query.site, 'selected site')}${department} in the audit interface`
    return auditApi.listOpenIssues<T>(query, read('stationAudit.interface', sources.interface, 'audit-issue', message))
  },
  updateStationIssueStatus<T = unknown>(id: string, status: string) {
    return auditApi.updateIssueStatus<T>(id, status, mutate('stationAudit', sources.checklist, 'update', 'audit-issue', `Station Audit issue status update requested to ${status}`))
  },
  updateInterfaceIssueStatus<T = unknown>(id: string, status: string) {
    return auditApi.updateIssueStatus<T>(id, status, mutate('stationAudit.interface', sources.interface, 'update', 'audit-issue', `Station Audit issue status update requested to ${status}`))
  },
  saveChecklist<T = unknown>(input: AuditSubmission) {
    return auditApi.saveStoreAudit<T>(input, mutate('stationAudit.checklist', sources.checklist, 'update', 'audit-instance', `Station Audit submission requested for ${input.site}`))
  },
  saveVisitorAudit<T = unknown>(input: AuditSubmission) {
    return auditApi.saveVisitorAudit<T>(input, mutate('stationAudit.visitor', sources.visitor, 'update', 'audit-instance', `Visitor Audit submission requested for ${input.site}`))
  },
}

