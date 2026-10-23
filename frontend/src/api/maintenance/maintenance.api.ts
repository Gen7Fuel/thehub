import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
import type { MaintenanceInput } from './maintenance.types'
export const maintenanceApi = {
  async list<T>(options: RequestOptions): Promise<T[]> { return (await apiClient.get('/maintenance', requestConfig(options))).data },
  async get<T>(id: string, options: RequestOptions): Promise<T> { return (await apiClient.get(`/maintenance/${id}`, requestConfig(options))).data },
  async create(input: MaintenanceInput, options: RequestOptions): Promise<void> { await apiClient.post('/maintenance', input, requestConfig(options)) },
  async update(id: string, input: Partial<MaintenanceInput>, options: RequestOptions): Promise<void> { await apiClient.put(`/maintenance/${id}`, input, requestConfig(options)) },
  async notify(id: string, options: RequestOptions): Promise<void> { await apiClient.post(`/maintenance/${id}/notify`, {}, requestConfig(options)) },
  async cancel(id: string, options: RequestOptions): Promise<void> { await apiClient.post(`/maintenance/${id}/cancel`, {}, requestConfig(options)) },
  async remove(id: string, options: RequestOptions): Promise<void> { await apiClient.delete(`/maintenance/${id}`, requestConfig(options)) },
}
