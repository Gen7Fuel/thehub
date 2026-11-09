import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
import type { AuditManagerChecklistSectionDetail, AuditManagerChecklistSectionList, AuditManagerDepartmentCreate, AuditManagerDepartmentList, AuditManagerDepartmentOptions, AuditManagerDepartmentUpdate, AuditManagerDepartmentUpdateResult, AuditManagerSectionCreate, AuditManagerSectionList, AuditManagerSectionUpdate, AuditManagerSectionUpdateResult, AuditManagerStatusOptionSetCreate, AuditManagerStatusOptionSetList, AuditManagerStatusOptionSetResult, AuditManagerStatusOptionSetUpdate, AuditManagerStatusOptionUsage, AuditManagerUniversalSiteResult } from './audit-manager.types'

export const auditManagerApi = {
  async checklistSections(options: RequestOptions): Promise<AuditManagerChecklistSectionList> {
    return (await apiClient.get('/station-audits/manager/checklists/sections', requestConfig(options))).data
  },
  async checklistSection(sectionId: string, options: RequestOptions): Promise<AuditManagerChecklistSectionDetail> {
    return (await apiClient.get(`/station-audits/manager/checklists/sections/${sectionId}`, requestConfig(options))).data
  },
  async listStatusOptionSets(options: RequestOptions): Promise<AuditManagerStatusOptionSetList> {
    return (await apiClient.get('/station-audits/manager/status-options', requestConfig(options))).data
  },
  async statusOptionUsage(statusOptionSetId: string, options: RequestOptions): Promise<AuditManagerStatusOptionUsage> {
    return (await apiClient.get(`/station-audits/manager/status-options/${statusOptionSetId}/usage`, requestConfig(options))).data
  },
  async createStatusOptionSet(input: AuditManagerStatusOptionSetCreate, options: RequestOptions): Promise<AuditManagerStatusOptionSetResult> {
    return (await apiClient.post('/station-audits/manager/status-options', input, requestConfig(options))).data
  },
  async updateStatusOptionSet(statusOptionSetId: string, input: AuditManagerStatusOptionSetUpdate, options: RequestOptions): Promise<AuditManagerStatusOptionSetResult> {
    return (await apiClient.put(`/station-audits/manager/status-options/${statusOptionSetId}`, input, requestConfig(options))).data
  },
  async listDepartments(options: RequestOptions): Promise<AuditManagerDepartmentList> {
    return (await apiClient.get('/station-audits/manager/departments', requestConfig(options))).data
  },
  async departmentOptions(options: RequestOptions): Promise<AuditManagerDepartmentOptions> {
    return (await apiClient.get('/station-audits/manager/departments/options', requestConfig(options))).data
  },
  async updateDepartment(departmentId: string, input: AuditManagerDepartmentUpdate, options: RequestOptions): Promise<AuditManagerDepartmentUpdateResult> {
    return (await apiClient.put(`/station-audits/manager/departments/${departmentId}`, input, requestConfig(options))).data
  },
  async createDepartment(input: AuditManagerDepartmentCreate, options: RequestOptions): Promise<AuditManagerDepartmentUpdateResult> {
    return (await apiClient.post('/station-audits/manager/departments', input, requestConfig(options))).data
  },
  async listSections(options: RequestOptions): Promise<AuditManagerSectionList> {
    return (
      await apiClient.get('/station-audits/manager/sections', requestConfig(options))
    ).data
  },
  async updateSection(
    sectionId: string,
    input: AuditManagerSectionUpdate,
    options: RequestOptions,
  ): Promise<AuditManagerSectionUpdateResult> {
    return (
      await apiClient.put(
        `/station-audits/manager/sections/${sectionId}`,
        input,
        requestConfig(options),
      )
    ).data
  },
  async createSection(input: AuditManagerSectionCreate, options: RequestOptions): Promise<AuditManagerSectionUpdateResult> {
    return (
      await apiClient.post('/station-audits/manager/sections', input, requestConfig(options))
    ).data
  },
  async addUniversalSite(siteId: string, options: RequestOptions): Promise<AuditManagerUniversalSiteResult> {
    return (
      await apiClient.put(
        '/station-audits/manager/sections/sites/universal',
        { siteId },
        requestConfig(options),
      )
    ).data
  },
  async reorderSections(sectionIds: string[], options: RequestOptions): Promise<void> {
    await apiClient.put(
      '/station-audits/manager/sections/reorder',
      { sectionIds },
      requestConfig(options),
    )
  },
}
