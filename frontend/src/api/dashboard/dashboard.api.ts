import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

export const dashboardApi = {
  async getSqlAllData<T = unknown>(query: Record<string, string>, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/sql/all-data', { ...requestConfig(options), params: query })).data
  },
  async refreshCache<T = { message: string }>(options: RequestOptions): Promise<T> {
    return (await apiClient.post('/sql/refresh-dashboard-cache', null, requestConfig(options))).data
  },
}
