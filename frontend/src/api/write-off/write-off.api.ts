import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

type Query = Record<string, string | undefined>

export const writeOffApi = {
  async getWorkList<T = unknown>(query: Query, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/write-off/work-list', { ...requestConfig(options), params: query })).data
  },

  async addWorkListItem<T = unknown>(input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.post('/write-off/work-list', input, requestConfig(options))).data
  },

  async updateWorkListItem<T = unknown>(itemId: string, input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.put(`/write-off/work-list/${encodeURIComponent(itemId)}`, input, requestConfig(options))).data
  },

  async removeWorkListItem<T = unknown>(itemId: string, site: string, options: RequestOptions): Promise<T> {
    return (await apiClient.delete(`/write-off/work-list/${encodeURIComponent(itemId)}`, { ...requestConfig(options), params: { site } })).data
  },

  async clearWorkList<T = unknown>(site: string, options: RequestOptions): Promise<T> {
    return (await apiClient.delete('/write-off/work-list', { ...requestConfig(options), params: { site } })).data
  },

  async list<T = unknown>(query: Query, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/write-off/list', { ...requestConfig(options), params: query })).data
  },

  async get<T = unknown>(id: string, options: RequestOptions): Promise<T> {
    return (await apiClient.get(`/write-off/${encodeURIComponent(id)}`, requestConfig(options))).data
  },

  async create<T = unknown>(input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.post('/write-off', input, requestConfig(options))).data
  },

  async addComment<T = unknown>(id: string, itemId: string, input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.post(`/write-off/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/comments`, input, requestConfig(options))).data
  },

  async updateItemDetails<T = unknown>(id: string, itemId: string, input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.patch(`/write-off/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/details`, input, requestConfig(options))).data
  },

  async updateItemCompleted<T = unknown>(id: string, itemId: string, input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.patch(`/write-off/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`, input, requestConfig(options))).data
  },

  async finalize<T = unknown>(id: string, options: RequestOptions): Promise<T> {
    return (await apiClient.patch(`/write-off/${encodeURIComponent(id)}/finalize`, {}, requestConfig(options))).data
  },

  async updateMissingUpc<T = unknown>(id: string, itemId: string, upc_barcode: string, options: RequestOptions): Promise<T> {
    return (await apiClient.patch(`/write-off/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/upc`, { upc_barcode }, requestConfig(options))).data
  },

  async resubmitMissing<T = unknown>(id: string, options: RequestOptions): Promise<T> {
    return (await apiClient.patch(`/write-off/${encodeURIComponent(id)}/resubmit-missing`, {}, requestConfig(options))).data
  },
}
