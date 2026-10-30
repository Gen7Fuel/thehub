import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

export const fleetApi = {
  async getByCardNumber<T>(cardNumber: string, stationName: string, options: RequestOptions): Promise<T> {
    return (await apiClient.get(`/fleet/getByCardNumber/${encodeURIComponent(cardNumber)}`, { ...requestConfig(options), params: { stationName } })).data
  },
  async verify<T>(cardNumber: string, options: RequestOptions): Promise<T> {
    return (await apiClient.get(`/fleet/verify/${encodeURIComponent(cardNumber)}`, requestConfig(options))).data
  },
}
