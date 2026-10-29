import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
import type { ATMRecord, ATMRecordFilters, CreateATMRecordInput } from './atm.types'

export const atmApi = {
  async list(filters: ATMRecordFilters, options: RequestOptions): Promise<ATMRecord[]> {
    return (await apiClient.get('/atm', { ...requestConfig(options), params: filters })).data
  },

  async create(input: CreateATMRecordInput, options: RequestOptions): Promise<ATMRecord> {
    return (await apiClient.post('/atm', input, requestConfig(options))).data
  },

  async remove(id: string, options: RequestOptions): Promise<void> {
    await apiClient.delete(`/atm/${id}`, requestConfig(options))
  },
}

