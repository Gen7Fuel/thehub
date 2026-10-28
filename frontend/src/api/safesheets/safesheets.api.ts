import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
export const safesheetsApi = {
  async exists(site: string, options: RequestOptions): Promise<boolean> { return (await apiClient.get(`/safesheets/${encodeURIComponent(site)}`, requestConfig(options))).data.exists },
  async create(site: string, initialBalance: number, options: RequestOptions): Promise<void> { await apiClient.post('/safesheets', { site, initialBalance }, requestConfig(options)) },
  async getDailyBalances<T = unknown>(site: string, from: string, to: string, options: RequestOptions): Promise<T> {
    return (await apiClient.get(`/safesheets/site/${encodeURIComponent(site)}/daily-balances`, {
      ...requestConfig(options),
      params: { from, to },
    })).data
  },
}
