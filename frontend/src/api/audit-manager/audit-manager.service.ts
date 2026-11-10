import { actionOptions } from '@/api/resources/action-options'
import { auditManagerApi } from './audit-manager.api'
import type { AuditManagerChecklistCreate, AuditManagerChecklistStatusCreate, AuditManagerChecklistUpdate, AuditManagerChecklistUpdateField, AuditManagerDepartmentCreate, AuditManagerDepartmentUpdate, AuditManagerDepartmentUpdateField, AuditManagerSectionCreate, AuditManagerSectionUpdate, AuditManagerStatusOptionSetCreate, AuditManagerStatusOptionSetField, AuditManagerStatusOptionSetUpdate } from './audit-manager.types'

export const auditManagerService = {
  checklistSections() {
    return auditManagerApi.checklistSections(actionOptions('auditManager.checklist', 'audit-manager.checklists', 'read', 'station-audit-section', 'Accessible Station Audit checklist sections viewed'))
  },
  checklistSection(sectionId: string) {
    return auditManagerApi.checklistSection(sectionId, actionOptions('auditManager.checklist', 'audit-manager.checklists', 'read', 'station-audit-checklist', 'Station Audit checklist metadata viewed'))
  },
  checklistEditOptions(sectionId: string, permission = 'auditManager.checklist.edit') {
    return auditManagerApi.checklistEditOptions(sectionId, actionOptions(permission, 'audit-manager.checklists', 'read', 'station-audit-checklist-options', 'Station Audit checklist edit options viewed'))
  },
  updateChecklist(sectionId: string, checklistId: string, input: AuditManagerChecklistUpdate, field: AuditManagerChecklistUpdateField) {
    const permission = field === 'active'
      ? 'auditManager.checklist.edit.updateActiveStatus'
      : 'auditManager.checklist.edit'
    return auditManagerApi.updateChecklist(sectionId, checklistId, input, actionOptions(permission, 'audit-manager.checklists', 'update', 'station-audit-checklist', `Station Audit checklist ${field} updated`))
  },
  createChecklist(sectionId: string, input: AuditManagerChecklistCreate) {
    return auditManagerApi.createChecklist(sectionId, input, actionOptions('auditManager.checklist.add', 'audit-manager.checklists', 'create', 'station-audit-checklist', 'Station Audit checklist created'))
  },
  createChecklistStatusOptionSet(sectionId: string, input: AuditManagerChecklistStatusCreate) {
    return auditManagerApi.createChecklistStatusOptionSet(sectionId, input, actionOptions('auditManager.checklist.add', 'audit-manager.checklists', 'create', 'station-audit-status-option-set', 'Status options created while adding a checklist'))
  },
  reorderChecklists(sectionId: string, frequency: 'daily' | 'weekly' | 'monthly', checklistIds: string[]) {
    return auditManagerApi.reorderChecklists(sectionId, frequency, checklistIds, actionOptions('auditManager.checklist.edit', 'audit-manager.checklists', 'update', 'station-audit-checklist-order', `Station Audit ${frequency} checklist order updated`))
  },
  createChecklistStatusOptions(sectionId: string, checklistId: string, input: AuditManagerChecklistStatusCreate) {
    return auditManagerApi.createChecklistStatusOptions(sectionId, checklistId, input, actionOptions('auditManager.checklist.edit', 'audit-manager.checklists', 'create', 'station-audit-status-option-set', 'Status options created and assigned to a checklist'))
  },
  listStatusOptionSets() {
    return auditManagerApi.listStatusOptionSets(actionOptions('auditManager.statusOptions', 'audit-manager.status-options', 'read', 'station-audit-status-option-set', 'Station Audit status options viewed'))
  },
  statusOptionUsage(statusOptionSetId: string) {
    return auditManagerApi.statusOptionUsage(statusOptionSetId, actionOptions('auditManager.statusOptions', 'audit-manager.status-options', 'read', 'station-audit-status-option-usage', 'Station Audit status-option usage viewed'))
  },
  createStatusOptionSet(input: AuditManagerStatusOptionSetCreate) {
    return auditManagerApi.createStatusOptionSet(input, actionOptions('auditManager.statusOptions.add', 'audit-manager.status-options', 'create', 'station-audit-status-option-set', 'Station Audit status-option set created'))
  },
  updateStatusOptionSet(statusOptionSetId: string, input: AuditManagerStatusOptionSetUpdate, field: AuditManagerStatusOptionSetField) {
    const permission = field === 'active'
      ? 'auditManager.statusOptions.edit.statusUpdate'
      : 'auditManager.statusOptions.edit'
    return auditManagerApi.updateStatusOptionSet(statusOptionSetId, input, actionOptions(permission, 'audit-manager.status-options', 'update', 'station-audit-status-option-set', `Station Audit status-option ${field} updated`))
  },
  listDepartments() {
    return auditManagerApi.listDepartments(
      actionOptions('auditManager.department', 'audit-manager.departments', 'read', 'station-audit-department', 'Station Audit departments viewed for management'),
    )
  },
  departmentOptions(permission = 'auditManager.department.edit') {
    return auditManagerApi.departmentOptions(
      actionOptions(permission, 'audit-manager.departments', 'read', 'station-audit-department-options', 'Station Audit department options viewed'),
    )
  },
  createDepartment(input: AuditManagerDepartmentCreate) {
    return auditManagerApi.createDepartment(
      input,
      actionOptions('auditManager.department.add', 'audit-manager.departments', 'create', 'station-audit-department', 'Station Audit department created'),
    )
  },
  updateDepartment(departmentId: string, input: AuditManagerDepartmentUpdate, field: AuditManagerDepartmentUpdateField) {
    const permission = field === 'assignmentStrategy'
      ? 'auditManager.department.edit.strategyAutomation'
      : field === 'active'
        ? 'auditManager.department.edit.status'
        : 'auditManager.department.edit'
    return auditManagerApi.updateDepartment(
      departmentId,
      input,
      actionOptions(permission, 'audit-manager.departments', 'update', 'station-audit-department', `Station Audit department ${String(field)} updated`),
    )
  },
  listSections() {
    return auditManagerApi.listSections(
      actionOptions(
        'auditManager.section',
        'audit-manager.sections',
        'read',
        'station-audit-section',
        'Station Audit sections viewed for management',
      ),
    )
  },
  updateSection(sectionId: string, input: AuditManagerSectionUpdate, fieldLabel: string) {
    return auditManagerApi.updateSection(
      sectionId,
      input,
      actionOptions(
        'auditManager.section.edit',
        'audit-manager.sections',
        'update',
        'station-audit-section',
        `Station Audit section ${fieldLabel} update requested`,
      ),
    )
  },
  createSection(input: AuditManagerSectionCreate) {
    return auditManagerApi.createSection(
      input,
      actionOptions(
        'auditManager.section.add',
        'audit-manager.sections',
        'create',
        'station-audit-section',
        'Station Audit section created',
      ),
    )
  },
  addUniversalSite(siteId: string) {
    return auditManagerApi.addUniversalSite(
      siteId,
      actionOptions(
        'auditManager.section.add.allSite',
        'audit-manager.sections',
        'update',
        'station-audit-section-sites',
        'Site added to all Station Audit sections',
      ),
    )
  },
  addUniversalDepartment(departmentId: string) {
    return auditManagerApi.addUniversalDepartment(
      departmentId,
      actionOptions(
        'auditManager.section.add.allDepartment',
        'audit-manager.sections',
        'update',
        'station-audit-section-departments',
        'Admin department added to all Station Audit sections',
      ),
    )
  },
  reorderSections(sectionIds: string[]) {
    return auditManagerApi.reorderSections(
      sectionIds,
      actionOptions(
        'auditManager.section.edit',
        'audit-manager.sections',
        'update',
        'station-audit-section-order',
        'Station Audit section order updated',
      ),
    )
  },
}
