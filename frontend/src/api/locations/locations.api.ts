import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
import type { Site, SiteInput } from './locations.types'

export const locationsApi = {
  async list(options: RequestOptions): Promise<Site[]> { return (await apiClient.get('/locations', requestConfig(options))).data },
  async getByName(stationName: string, options: RequestOptions): Promise<Site> { return (await apiClient.get(`/locations/name/${encodeURIComponent(stationName)}`, requestConfig(options))).data },
  async listSettings(options: RequestOptions): Promise<Site[]> { return (await apiClient.get('/locations/settings', requestConfig(options))).data },
  async getSettings(id: string, options: RequestOptions): Promise<Site> { return (await apiClient.get(`/locations/settings/${id}`, requestConfig(options))).data.location },
  async create(input: SiteInput, options: RequestOptions): Promise<Site> { return (await apiClient.post('/locations', input, requestConfig(options))).data },
  async update(id: string, input: Partial<SiteInput>, options: RequestOptions): Promise<Site> { return (await apiClient.put(`/locations/${id}`, input, requestConfig(options))).data.location },
  async assignUsers(id: string, stationName: string, userIds: string[], options: RequestOptions): Promise<void> { await apiClient.post(`/locations/${id}/assign-users`, { stationName, userIds }, requestConfig(options)) },
  async checkManagerCode(location: string, code: string, options: RequestOptions): Promise<{ success: boolean; error?: string }> {
    return (await apiClient.post('/locations/check-code', { location, code }, requestConfig(options))).data
  },
}
