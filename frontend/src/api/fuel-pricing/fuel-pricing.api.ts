import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
import type {
  FuelPriceSubmission,
  FuelPriceVerification,
  FuelPricingMutationResponse,
  FuelScheduleUpdate,
} from './fuel-pricing.types'

export const fuelPricingApi = {
  async getMatrix<T = unknown>(date: string, options: RequestOptions): Promise<T> {
    return (await apiClient.get('/fuel-pricing', {
      ...requestConfig(options),
      params: { date },
    })).data
  },

  async getCurrent<T = unknown>(locationId: string, options: RequestOptions): Promise<T> {
    return (await apiClient.get(`/fuel-pricing/current/${encodeURIComponent(locationId)}`, requestConfig(options))).data
  },

  async getLogs<T = unknown>(locationId: string, options: RequestOptions): Promise<T> {
    return (await apiClient.get(`/fuel-pricing/logs/${encodeURIComponent(locationId)}`, requestConfig(options))).data
  },

  async upsertRetail(input: FuelPriceSubmission, options: RequestOptions): Promise<FuelPricingMutationResponse> {
    return (await apiClient.post('/fuel-pricing/upsert-retail', input, requestConfig(options))).data
  },

  async updateSchedule(input: FuelScheduleUpdate, options: RequestOptions): Promise<FuelPricingMutationResponse> {
    return (await apiClient.put('/fuel-pricing/edit-schedule-prices', input, requestConfig(options))).data
  },

  async cancelSchedule(locationId: string, options: RequestOptions): Promise<FuelPricingMutationResponse> {
    return (await apiClient.delete(`/fuel-pricing/cancel-schedule/${encodeURIComponent(locationId)}`, requestConfig(options))).data
  },

  async checkPendingVerification<T = unknown>(options: RequestOptions): Promise<T> {
    return (await apiClient.get('/fuel-pricing/check-pending-verification', requestConfig(options))).data
  },

  async verifyPriceReceipt(input: FuelPriceVerification, options: RequestOptions): Promise<FuelPricingMutationResponse> {
    return (await apiClient.put('/fuel-pricing/verify-price-receipt', input, requestConfig(options))).data
  },

  async getTicker<T = unknown>(options: RequestOptions): Promise<T> {
    return (await apiClient.get('/fuel-pricing/prices-ticker', requestConfig(options))).data
  },
}
