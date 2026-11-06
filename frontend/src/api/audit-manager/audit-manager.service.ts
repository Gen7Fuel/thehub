import { actionOptions } from '@/api/resources/action-options'
import { auditManagerApi } from './audit-manager.api'
import type { AuditManagerDepartmentCreate, AuditManagerDepartmentUpdate, AuditManagerDepartmentUpdateField, AuditManagerSectionCreate, AuditManagerSectionUpdate } from './audit-manager.types'

export const auditManagerService = {
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
        'auditManager.section.edit',
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
        'auditManager.section.edit',
        'audit-manager.sections',
        'update',
        'station-audit-section-sites',
        'Site added to all Station Audit sections',
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
