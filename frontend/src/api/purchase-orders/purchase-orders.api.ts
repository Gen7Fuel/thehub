import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

export type PurchaseOrderQuery = {
  startDate?: string
  endDate?: string
  stationName?: string
  site?: string
}

export const purchaseOrdersApi = {
  async list<T = unknown[]>(query: PurchaseOrderQuery, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/purchase-orders', {
      ...requestConfig(options),
      params: query,
    })).data
  },
}
