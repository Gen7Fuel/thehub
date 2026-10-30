import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

export const orderRecApi = {
  async list<T>(query: Record<string, unknown>, options: RequestOptions): Promise<T> { return (await apiClient.get('/order-rec', { ...requestConfig(options), params: query })).data },
  async workflow<T>(week: string, options: RequestOptions): Promise<T> { return (await apiClient.get('/order-rec/workflow', { ...requestConfig(options), params: { week } })).data },
  async range<T>(query: Record<string, unknown>, options: RequestOptions): Promise<T> { return (await apiClient.get('/order-rec/range', { ...requestConfig(options), params: query })).data },
  async get<T>(id: string, options: RequestOptions): Promise<T> { return (await apiClient.get(`/order-rec/${encodeURIComponent(id)}`, requestConfig(options))).data },
  async create<T, R>(input: T, options: RequestOptions): Promise<R> { return (await apiClient.post('/order-rec', input, requestConfig(options))).data },
  async update<T, R>(id: string, input: T, options: RequestOptions): Promise<R> { return (await apiClient.put(`/order-rec/${encodeURIComponent(id)}`, input, requestConfig(options))).data },
  async updateItem<T, R>(id: string, catIdx: number, itemIdx: number, input: T, options: RequestOptions): Promise<R> { return (await apiClient.put(`/order-rec/${encodeURIComponent(id)}/item/${catIdx}/${itemIdx}`, input, requestConfig(options))).data },
  async updateNote<T>(id: string, note: string, options: RequestOptions): Promise<T> { return (await apiClient.patch(`/order-rec/${encodeURIComponent(id)}`, { extraItemsNote: note }, requestConfig(options))).data },
  async remove<T>(id: string, options: RequestOptions): Promise<T> { return (await apiClient.delete(`/order-rec/${encodeURIComponent(id)}`, requestConfig(options))).data },
  async updateStatus<T>(id: string, input: Record<string, unknown>, options: RequestOptions): Promise<T> { return (await apiClient.put(`/order-rec/${encodeURIComponent(id)}/status`, input, requestConfig(options))).data },
  async addComment<T>(id: string, input: { text: string; photos?: string[] }, options: RequestOptions): Promise<T> { return (await apiClient.post(`/order-rec/${encodeURIComponent(id)}/comments`, input, requestConfig(options))).data },
  async assignVendor<T>(id: string, vendor: string, options: RequestOptions): Promise<T> { return (await apiClient.patch(`/order-rec/${encodeURIComponent(id)}/vendor`, { vendor }, requestConfig(options))).data },
  async lookupScanItem<T>(site: string, upc: string, options: RequestOptions): Promise<T> { return (await apiClient.get('/order-rec/scan/item', { ...requestConfig(options), params: { site, upc } })).data },
  async createScan<T, R>(input: T, options: RequestOptions): Promise<R> { return (await apiClient.post('/order-rec/scan', input, requestConfig(options))).data },
  async coremarkPriceBook<T>(upcs: string[], options: RequestOptions): Promise<T> { return (await apiClient.post('/order-rec/coremark-price-book', { upcs }, requestConfig(options))).data },
  async sendEmail<T, R = unknown>(input: T, options: RequestOptions): Promise<R> { return (await apiClient.post('/send-orderec-email', input, requestConfig(options))).data },
}
