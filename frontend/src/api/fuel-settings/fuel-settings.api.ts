import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

export type FuelSettingsResource = 'supplier-discounts' | 'carrier-fcs' | 'carrier-haulage' | 'station-discounts'

export interface FuelSettingsBatchUpdate<T> {
  updates: T[]
  deletions: T[]
  isImmediate: boolean
  scheduleEffectiveDate?: string | null
}

export const fuelSettingsApi = {
  async list<T>(resource: FuelSettingsResource, options: RequestOptions): Promise<T> {
    return (await apiClient.get(`/fuel-settings/${resource}`, requestConfig(options))).data
  },
  async createBatch<T, R = unknown>(resource: FuelSettingsResource, entries: T[], options: RequestOptions): Promise<R> {
    return (await apiClient.post(`/fuel-settings/${resource}/batch`, { entries }, requestConfig(options))).data
  },
  async updateBatch<T, R = unknown>(resource: FuelSettingsResource, input: FuelSettingsBatchUpdate<T>, options: RequestOptions): Promise<R> {
    return (await apiClient.put(`/fuel-settings/${resource}/batch`, input, requestConfig(options))).data
  },
  async rescheduleStationDiscount<T, R = unknown>(input: T, options: RequestOptions): Promise<R> {
    return (await apiClient.put('/fuel-settings/station-discounts/reschedule-single', input, requestConfig(options))).data
  },
}
