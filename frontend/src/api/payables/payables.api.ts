import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

export type PayablesQuery = {
  location?: string
  from?: string
  to?: string
}

export const payablesApi = {
  async list<T = unknown[]>(query: PayablesQuery, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/payables', {
      ...requestConfig(options),
      params: query,
    })).data
  },
  async get<T>(id: string, options: RequestOptions): Promise<T> {
    return (await apiClient.get(`/payables/${encodeURIComponent(id)}`, requestConfig(options))).data
  },
  async create<T, R = unknown>(input: T, options: RequestOptions): Promise<R> {
    return (await apiClient.post('/payables', input, requestConfig(options))).data
  },
  async update<T, R = unknown>(id: string, input: T, options: RequestOptions): Promise<R> {
    return (await apiClient.put(`/payables/${encodeURIComponent(id)}`, input, requestConfig(options))).data
  },
  async remove<T = unknown>(id: string, options: RequestOptions): Promise<T> {
    return (await apiClient.delete(`/payables/${encodeURIComponent(id)}`, requestConfig(options))).data
  },
  async listVendorTags<T>(options: RequestOptions): Promise<T> {
    return (await apiClient.get('/payables/vendor-tags', requestConfig(options))).data
  },
  async listVendorOptions<T>(location: string, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/payables/vendor-options', { ...requestConfig(options), params: { location } })).data
  },
  async upsertVendorTag<T, R = unknown>(input: T, options: RequestOptions): Promise<R> {
    return (await apiClient.put('/payables/vendor-tags', input, requestConfig(options))).data
  },
  async setSageBill<T = unknown>(id: string, key: string, options: RequestOptions): Promise<T> {
    return (await apiClient.put(`/payables/${encodeURIComponent(id)}/sage-bill`, { key }, requestConfig(options))).data
  },
  async summary<T>(query: { location?: string; date?: string }, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/payables/stats/summary', { ...requestConfig(options), params: query })).data
  },
}
