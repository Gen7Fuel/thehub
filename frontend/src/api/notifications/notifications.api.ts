import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

export const notificationsApi = {
  async list<T>(options: RequestOptions): Promise<T> { return (await apiClient.get('/notification', requestConfig(options))).data },
  async listSent<T>(options: RequestOptions): Promise<T> { return (await apiClient.get('/notification/sent', requestConfig(options))).data },
  async get<T>(id: string, options: RequestOptions): Promise<T> { return (await apiClient.get(`/notification/${encodeURIComponent(id)}`, requestConfig(options))).data },
  async unreadCount(options: RequestOptions): Promise<{ count: number }> { return (await apiClient.get('/notification/unread-count', requestConfig(options))).data },
  async unreadSummary(options: RequestOptions): Promise<{ unreadCount: number }> { return (await apiClient.get('/notification/unread-summary', requestConfig(options))).data },
  async dismissSummary(options: RequestOptions): Promise<void> { await apiClient.post('/notification/dismiss-summary', {}, requestConfig(options)) },
  async send<T, R = unknown>(input: T, options: RequestOptions): Promise<R> { return (await apiClient.post('/notification', input, requestConfig(options))).data },
  async listTemplates<T>(options: RequestOptions): Promise<T> { return (await apiClient.get('/notification/template', requestConfig(options))).data },
  async getTemplate<T>(id: string, options: RequestOptions): Promise<T> { return (await apiClient.get(`/notification/template/${encodeURIComponent(id)}`, requestConfig(options))).data },
  async saveTemplate<T, R = unknown>(input: T, options: RequestOptions): Promise<R> { return (await apiClient.post('/notification/template', input, requestConfig(options))).data },
  async deleteTemplate(id: string, options: RequestOptions): Promise<void> { await apiClient.delete(`/notification/template/${encodeURIComponent(id)}`, requestConfig(options)) },
}
