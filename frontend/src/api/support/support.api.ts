import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

export const supportApi = {
  async list<T>(query: Record<string, unknown>, options: RequestOptions): Promise<T> { return (await apiClient.get('/support/tickets', { ...requestConfig(options), params: query })).data },
  async get<T>(id: string, options: RequestOptions): Promise<T> { return (await apiClient.get(`/support/tickets/${encodeURIComponent(id)}`, requestConfig(options))).data },
  async create<T, R>(input: T, options: RequestOptions): Promise<R> { return (await apiClient.post('/support/tickets', input, requestConfig(options))).data },
}
