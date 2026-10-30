import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

type Query = Record<string, string | number | boolean | undefined>

export function createFuelResourceApi(basePath: string) {
  return {
    async get<T>(path: string, query: Query | undefined, options: RequestOptions): Promise<T> {
      return (await apiClient.get(`${basePath}${path}`, {
        ...requestConfig(options),
        ...(query ? { params: query } : {}),
      })).data
    },
    async post<T>(path: string, input: unknown, options: RequestOptions): Promise<T> {
      return (await apiClient.post(`${basePath}${path}`, input, requestConfig(options))).data
    },
    async put<T>(path: string, input: unknown, options: RequestOptions): Promise<T> {
      return (await apiClient.put(`${basePath}${path}`, input, requestConfig(options))).data
    },
    async patch<T>(path: string, input: unknown, options: RequestOptions): Promise<T> {
      return (await apiClient.patch(`${basePath}${path}`, input, requestConfig(options))).data
    },
    async remove<T>(path: string, options: RequestOptions): Promise<T> {
      return (await apiClient.delete(`${basePath}${path}`, requestConfig(options))).data
    },
  }
}
