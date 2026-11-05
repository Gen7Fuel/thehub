import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
import type { SaveStationAuditResponseInput, SaveStationAuditResponseResult, StationAuditChecklistReadModel, StationAuditFrequency, StationAuditSectionListReadModel } from './station-audits.types'

export interface StationAuditChecklistQuery {
  site: string
  frequency: StationAuditFrequency
  type?: 'store' | 'visitor'
  section?: string
  date?: string
}

export const stationAuditsApi = {
  async listSections(
    query: Pick<StationAuditChecklistQuery, 'site' | 'type' | 'date'>,
    options: RequestOptions,
  ): Promise<StationAuditSectionListReadModel> {
    return (
      await apiClient.get('/station-audits/sections', {
        ...requestConfig(options),
        params: query,
      })
    ).data
  },

  async getSectionChecklists(
    sectionId: string,
    query: StationAuditChecklistQuery,
    options: RequestOptions,
  ): Promise<StationAuditChecklistReadModel> {
    return (
      await apiClient.get(`/station-audits/checklists/${sectionId}`, {
        ...requestConfig(options),
        params: query,
      })
    ).data
  },

  async saveResponse(
    sectionId: string,
    checklistId: string,
    query: Pick<StationAuditChecklistQuery, 'site' | 'type' | 'date'>,
    input: SaveStationAuditResponseInput,
    options: RequestOptions,
  ): Promise<SaveStationAuditResponseResult> {
    return (
      await apiClient.put(
        `/station-audits/checklists/${sectionId}/responses/${checklistId}`,
        input,
        { ...requestConfig(options), params: query },
      )
    ).data
  },
}
