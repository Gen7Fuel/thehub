import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

type Query = Record<string, string | undefined>

export const cashRecApi = {
  async getEntries<T = unknown>(query: Query, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/cash-rec/entries', { ...requestConfig(options), params: query })).data
  },

  async getKardpollEntries<T = unknown>(query: Query, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/cash-rec/kardpoll-entries', { ...requestConfig(options), params: query })).data
  },

  async saveBankStatement<T = unknown>(input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.post('/cash-rec/bank-statement', input, requestConfig(options))).data
  },

  async updateMerchantFees<T = unknown>(input: unknown, options: RequestOptions): Promise<T> {
    return (await apiClient.patch('/cash-rec/bank-statement/merchant-fees', input, requestConfig(options))).data
  },

  async uploadKardpollExcel<T = unknown>(input: FormData, options: RequestOptions): Promise<T> {
    return (await apiClient.post('/cash-rec/parse-kardpoll-excel', input, requestConfig(options))).data
  },

  async sendWeeklyArReport<T = { message?: string }>(options: RequestOptions): Promise<T> {
    return (await apiClient.post('/cash-rec/send-weekly-ar-report', null, requestConfig(options))).data
  },
}
