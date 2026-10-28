import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
import type { Role, RoleInput } from './roles.types'
export const rolesApi = {
  async list(options: RequestOptions): Promise<Role[]> { return (await apiClient.get('/roles', requestConfig(options))).data },
  async get(id: string, options: RequestOptions): Promise<Role> { return (await apiClient.get(`/roles/${id}`, requestConfig(options))).data },
  async create(input: Omit<RoleInput, 'inStoreAccount'> & { inStoreAccount?: boolean }, options: RequestOptions): Promise<Role> { return (await apiClient.post('/roles', input, requestConfig(options))).data.role },
  async update(id: string, input: RoleInput, options: RequestOptions): Promise<Role> { return (await apiClient.put(`/roles/${id}`, input, requestConfig(options))).data.role },
  async remove(id: string, options: RequestOptions): Promise<void> { await apiClient.delete(`/roles/${id}`, requestConfig(options)) },
  async assignUsers(id: string, userIds: string[], options: RequestOptions): Promise<void> { await apiClient.put(`/roles/${id}/assign-users`, { userIds }, requestConfig(options)) },
}
