import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

export const fuelRecApi = {
  async capture<T = unknown>(input: FormData, options: RequestOptions): Promise<T> {
    return (await apiClient.post('/fuel-rec/capture', input, requestConfig(options))).data
  },

  async list<T = unknown>(site: string, from: string, to: string, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/fuel-rec/list', {
      ...requestConfig(options),
      params: { site, from, to },
    })).data
  },

  async requestAgain<T = unknown>(input: { site: string; date: string }, options: RequestOptions): Promise<T> {
    return (await apiClient.post('/fuel-rec/request-again', input, requestConfig(options))).data
  },

  async remove<T = unknown>(id: string, options: RequestOptions): Promise<T> {
    return (await apiClient.delete(`/fuel-rec/${encodeURIComponent(id)}`, requestConfig(options))).data
  },

  async addComment<T = unknown>(id: string, text: string, options: RequestOptions): Promise<T> {
    return (await apiClient.post(`/fuel-rec/${encodeURIComponent(id)}/comment`, { text }, requestConfig(options))).data
  },

  async getLinkablePos<T = unknown>(id: string, daysBack: number, options: RequestOptions): Promise<T> {
    return (await apiClient.get(`/fuel-rec/${encodeURIComponent(id)}/linkable-pos`, {
      ...requestConfig(options),
      params: { daysBack },
    })).data
  },

  async linkPo<T = unknown>(id: string, fuelOrderId: string, options: RequestOptions): Promise<T> {
    return (await apiClient.post(`/fuel-rec/${encodeURIComponent(id)}/link-po`, { fuelOrderId }, requestConfig(options))).data
  },

  async unlinkPo<T = unknown>(id: string, fuelOrderId: string, options: RequestOptions): Promise<T> {
    return (await apiClient.post(`/fuel-rec/${encodeURIComponent(id)}/unlink-po`, { fuelOrderId }, requestConfig(options))).data
  },
}
