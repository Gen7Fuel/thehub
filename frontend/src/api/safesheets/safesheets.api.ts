import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
export const safesheetsApi = {
  async exists(site: string, options: RequestOptions): Promise<boolean> { return (await apiClient.get(`/safesheets/${encodeURIComponent(site)}`, requestConfig(options))).data.exists },
  async create(site: string, initialBalance: number, options: RequestOptions): Promise<void> { await apiClient.post('/safesheets', { site, initialBalance }, requestConfig(options)) },
  async get<T = unknown>(site: string, query: { from?: string; to?: string; sortAssigned?: boolean }, options: RequestOptions): Promise<T> {
    return (await apiClient.get(`/safesheets/site/${encodeURIComponent(site)}`, {
      ...requestConfig(options),
      params: query,
    })).data
  },
  async addEntry<T = unknown>(site: string, input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.post(`/safesheets/site/${encodeURIComponent(site)}/entries`, input, requestConfig(options))).data
  },
  async updateEntry<T = unknown>(site: string, entryId: string, input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.put(`/safesheets/site/${encodeURIComponent(site)}/entries/${encodeURIComponent(entryId)}`, input, requestConfig(options))).data
  },
  async deleteEntry<T = unknown>(site: string, entryId: string, options: RequestOptions): Promise<T> {
    return (await apiClient.delete(`/safesheets/site/${encodeURIComponent(site)}/entries/${encodeURIComponent(entryId)}`, requestConfig(options))).data
  },
  async getDailyBalances<T = unknown>(site: string, from: string, to: string, options: RequestOptions): Promise<T> {
    return (await apiClient.get(`/safesheets/site/${encodeURIComponent(site)}/daily-balances`, {
      ...requestConfig(options),
      params: { from, to },
    })).data
  },
}
