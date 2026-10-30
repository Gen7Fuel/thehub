import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

export const invoiceUploadApi = {
  async vendors<T>(options: RequestOptions): Promise<T> { return (await apiClient.get('/invoice-upload/vendors', requestConfig(options))).data },
  async list<T>(query: Record<string, unknown>, options: RequestOptions): Promise<T> { return (await apiClient.get('/invoice-upload/list', { ...requestConfig(options), params: query })).data },
  async get<T>(id: string, options: RequestOptions): Promise<T> { return (await apiClient.get(`/invoice-upload/${encodeURIComponent(id)}`, requestConfig(options))).data },
  async create<T, R>(input: T, options: RequestOptions): Promise<R> { return (await apiClient.post('/invoice-upload/submit', input, requestConfig(options))).data },
  async update<T, R>(id: string, input: T, options: RequestOptions): Promise<R> { return (await apiClient.put(`/invoice-upload/${encodeURIComponent(id)}`, input, requestConfig(options))).data },
}
