import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

type Query = Record<string, string | undefined>

export const cashSummaryApi = {
  async getByDate<T = unknown>(query: Query, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/cash-summary/by-date', { ...requestConfig(options), params: query })).data
  },
  async getByRange<T = unknown>(query: Query, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/cash-summary/by-range', { ...requestConfig(options), params: query })).data
  },
  async updateBatch<T = unknown>(input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.post('/cash-summary/batch', input, requestConfig(options))).data
  },
  async getLottery<T = unknown>(query: Query, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/cash-summary/lottery', { ...requestConfig(options), params: query })).data
  },
  async saveLottery<T = unknown>(input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.post('/cash-summary/lottery', input, requestConfig(options))).data
  },
  async getReport<T = unknown>(query: Query, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/cash-summary/report', { ...requestConfig(options), params: query })).data
  },
  async updateReportField<T = unknown>(field: 'notes' | 'unsettled-prepays' | 'handheld-debit' | 'submitted', input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.put(`/cash-summary/report/${field}`, input, requestConfig(options))).data
  },
  async getPayoutsCheck<T = unknown>(query: Query, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/cash-summary/payouts-check', { ...requestConfig(options), params: query })).data
  },
  async getArCheck<T = unknown>(query: Query, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/cash-summary/ar-check', { ...requestConfig(options), params: query })).data
  },
  async getVoidedTransactionDetails<T = unknown>(query: Query, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/cash-summary/voided-transactions-details', { ...requestConfig(options), params: query })).data
  },
  async getOverShort<T = unknown>(query: Query, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/cash-summary/over-short', { ...requestConfig(options), params: query })).data
  },
}
