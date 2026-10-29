import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

type Query = Record<string, string | number | boolean | undefined>

export const cycleCountApi = {
  async get<T>(path: string, query: Query | undefined, options: RequestOptions): Promise<T> {
    return (await apiClient.get(`/cycle-count${path}`, {
      ...requestConfig(options),
      ...(query ? { params: query } : {}),
    })).data
  },

  async post<T>(path: string, input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.post(`/cycle-count${path}`, input, requestConfig(options))).data
  },

  async put<T>(path: string, input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.put(`/cycle-count${path}`, input, requestConfig(options))).data
  },

  async remove<T>(path: string, input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.delete(`/cycle-count${path}`, {
      ...requestConfig(options),
      ...(input === undefined ? {} : { data: input }),
    })).data
  },
}
