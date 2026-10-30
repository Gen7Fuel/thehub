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
  async get<T>(id: string, options: RequestOptions): Promise<T> {
    return (await apiClient.get(`/purchase-orders/${encodeURIComponent(id)}`, requestConfig(options))).data
  },
  async checkUnique(stationName: string, poNumber: string, options: RequestOptions): Promise<{ unique: boolean }> {
    return (await apiClient.get('/purchase-orders/unique', { ...requestConfig(options), params: { stationName, poNumber } })).data
  },
  async create<T, R = unknown>(input: T, options: RequestOptions): Promise<R> {
    return (await apiClient.post('/purchase-orders', input, requestConfig(options))).data
  },
  async update<T, R = unknown>(id: string, input: T, options: RequestOptions): Promise<R> {
    return (await apiClient.put(`/purchase-orders/${encodeURIComponent(id)}`, input, requestConfig(options))).data
  },
  async remove<T = unknown>(id: string, options: RequestOptions): Promise<T> {
    return (await apiClient.delete(`/purchase-orders/${encodeURIComponent(id)}`, requestConfig(options))).data
  },
}
