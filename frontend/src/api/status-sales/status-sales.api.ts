import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

export const statusSalesApi = {
  async list<T>(query: Record<string, unknown>, options: RequestOptions): Promise<T> { return (await apiClient.get('/status-sales', { ...requestConfig(options), params: query })).data },
  async customer<T>(card: string, options: RequestOptions): Promise<T> { return (await apiClient.get(`/status-sales/${encodeURIComponent(card)}`, requestConfig(options))).data },
  async create<T, R>(input: T, options: RequestOptions): Promise<R> { return (await apiClient.post('/status-sales', input, requestConfig(options))).data },
}
