import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

export const userGroupsApi = {
  async list<T>(options: RequestOptions): Promise<T> { return (await apiClient.get('/user-groups', requestConfig(options))).data },
  async save<T, R = unknown>(input: T, options: RequestOptions): Promise<R> { return (await apiClient.post('/user-groups', input, requestConfig(options))).data },
  async remove(id: string, options: RequestOptions): Promise<void> { await apiClient.delete(`/user-groups/${encodeURIComponent(id)}`, requestConfig(options)) },
}
