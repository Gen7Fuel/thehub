import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
import type { Permission, PermissionInput } from './permissions.types'
export const permissionsApi = {
  async list(options: RequestOptions): Promise<Permission[]> { return (await apiClient.get('/permissions', requestConfig(options))).data },
  async get(id: string, options: RequestOptions): Promise<Permission> { return (await apiClient.get(`/permissions/${id}`, requestConfig(options))).data },
  async create(input: PermissionInput, options: RequestOptions): Promise<Permission> { return (await apiClient.post('/permissions', input, requestConfig(options))).data.data },
  async update(id: string, input: PermissionInput, options: RequestOptions): Promise<Permission> { return (await apiClient.put(`/permissions/${id}`, input, requestConfig(options))).data.data },
  async remove(id: string, options: RequestOptions): Promise<void> { await apiClient.delete(`/permissions/${id}`, requestConfig(options)) },
}
