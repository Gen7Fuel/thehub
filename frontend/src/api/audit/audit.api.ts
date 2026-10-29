import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

type Query = Record<string, unknown>

export const auditApi = {
  async listTemplates<T = unknown[]>(options: RequestOptions): Promise<T> {
    return (await apiClient.get('/audit', requestConfig(options))).data
  },

  async getTemplate<T = unknown>(id: string, query: Query, options: RequestOptions): Promise<T> {
    return (await apiClient.get(`/audit/${id}`, { ...requestConfig(options), params: query })).data
  },

  async createTemplate<T = unknown>(input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.post('/audit', input, requestConfig(options))).data
  },

  async updateTemplate<T = unknown>(id: string, input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.put(`/audit/${id}`, input, requestConfig(options))).data
  },

  async removeTemplate(id: string, options: RequestOptions): Promise<void> {
    await apiClient.delete(`/audit/${id}`, requestConfig(options))
  },

  async listSelectTemplates<T = unknown[]>(options: RequestOptions): Promise<T> {
    return (await apiClient.get('/audit/select-templates', requestConfig(options))).data
  },

  async getSelectTemplate<T = unknown>(id: string, options: RequestOptions): Promise<T> {
    return (await apiClient.get(`/audit/select-templates/${id}`, requestConfig(options))).data
  },

  async createSelectTemplate<T = unknown>(input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.post('/audit/select-templates', input, requestConfig(options))).data
  },

  async updateSelectTemplate<T = unknown>(id: string, input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.put(`/audit/select-templates/${id}`, input, requestConfig(options))).data
  },

  async removeSelectTemplate(id: string, options: RequestOptions): Promise<void> {
    await apiClient.delete(`/audit/select-templates/${id}`, requestConfig(options))
  },

  async getStationStats<T = unknown>(site: string, periodKeys: Record<string, string>, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/audit/station-stats', {
      ...requestConfig(options),
      params: { site, periodKeys: JSON.stringify(periodKeys) },
    })).data
  },

  async getItemsFull<T = unknown>(query: Query, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/audit/items-full', { ...requestConfig(options), params: query })).data
  },

  async compare<T = unknown>(query: Query, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/audit/compare', { ...requestConfig(options), params: query })).data
  },

  async listOpenIssues<T = unknown>(query: Query, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/audit/open-issues', { ...requestConfig(options), params: query })).data
  },

  async updateIssueStatus<T = unknown>(id: string, status: string, options: RequestOptions): Promise<T> {
    return (await apiClient.put(`/audit/issues/${id}/status`, { status }, requestConfig(options))).data
  },

  async updateIssue<T = unknown>(id: string, input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.put(`/audit/issues/${id}`, input, requestConfig(options))).data
  },

  async saveStoreAudit<T = unknown>(input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.post('/audit/instance', input, requestConfig(options))).data
  },

  async saveVisitorAudit<T = unknown>(input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.post('/audit/visitor', input, requestConfig(options))).data
  },
}

