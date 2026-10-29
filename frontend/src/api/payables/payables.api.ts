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
}
