import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

export const vendorsApi = {
  async list<T = unknown[]>(options: RequestOptions, query?: { location?: string; category?: string }): Promise<T> {
    return (await apiClient.get('/vendors', { ...requestConfig(options), params: query })).data
  },
  async get<T>(id: string, options: RequestOptions): Promise<T> { return (await apiClient.get(`/vendors/${encodeURIComponent(id)}`, requestConfig(options))).data },
  async getByName<T>(id: string, options: RequestOptions): Promise<T> { return (await apiClient.get(`/vendors/by-name/${encodeURIComponent(id)}`, requestConfig(options))).data },
  async create<T, R = unknown>(input: T, options: RequestOptions): Promise<R> { return (await apiClient.post('/vendors', input, requestConfig(options))).data },
  async update<T, R = unknown>(id: string, input: T, options: RequestOptions): Promise<R> { return (await apiClient.put(`/vendors/${encodeURIComponent(id)}`, input, requestConfig(options))).data },
}

