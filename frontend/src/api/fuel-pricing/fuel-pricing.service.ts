import { actionOptions } from '@/api/resources/action-options'
import type { ActionType, RequestOptions } from '@/api/core/types'
import { fuelPricingApi } from './fuel-pricing.api'
import type {
  FuelPriceSubmission,
  FuelPriceVerification,
  FuelPricingSource,
  FuelScheduleUpdate,
} from './fuel-pricing.types'

const readOptions = (source: FuelPricingSource, resourceType: string, message: string) =>
  actionOptions('fuelPricing', source, 'read', resourceType, message)

const manageOptions = (
  source: FuelPricingSource,
  action: 'read' | 'update' | 'delete',
  message: string,
) => actionOptions('fuelPricing.setFuelPrice', source, action, 'fuel-price', message)

// Receipt verification is completed by receiving staff from the global navbar
// prompt. Authentication is still required by apiClient/backend auth, but this
// workflow must not inherit the price-publishing permission.
const verificationOptions = (
  action: Extract<ActionType, 'read' | 'update'>,
  message: string,
): RequestOptions => ({
  actionContext: {
    action,
    resourceType: 'fuel-price-verification',
    source: 'fuel-pricing.verification',
    message,
  },
})

export const fuelPricingService = {
  getMatrix<T = unknown>(date: string) {
    return fuelPricingApi.getMatrix<T>(
      date,
      readOptions('fuel-pricing.dashboard', 'fuel-price', `Fuel pricing dashboard viewed for ${date}`),
    )
  },

  getCurrent<T = unknown>(locationId: string, stationName: string, source: FuelPricingSource) {
    return fuelPricingApi.getCurrent<T>(
      locationId,
      manageOptions(source, 'read', `Current fuel prices viewed for ${stationName}`),
    )
  },

  async getLogs<T = unknown>(locationId: string, stationName: string, source: FuelPricingSource): Promise<T[]> {
    const payload = await fuelPricingApi.getLogs<{ logs?: T[] }>(
      locationId,
      manageOptions(source, 'read', `Fuel price history viewed for ${stationName}`),
    )
    return payload.logs || []
  },

  publish(input: FuelPriceSubmission, source: FuelPricingSource) {
    const timing = input.isScheduled && input.scheduledDateTime
      ? ` scheduled for ${input.scheduledDateTime}`
      : ' requested for immediate publishing'
    return fuelPricingApi.upsertRetail(
      input,
      manageOptions(source, 'update', `Fuel price update for ${input.stationName}${timing}`),
    )
  },

  updateSchedule(input: FuelScheduleUpdate, stationName: string, source: FuelPricingSource) {
    return fuelPricingApi.updateSchedule(
      input,
      manageOptions(source, 'update', `Scheduled fuel prices updated for ${stationName} at ${input.scheduledDateTime}`),
    )
  },

  cancelSchedule(locationId: string, stationName: string, source: FuelPricingSource) {
    return fuelPricingApi.cancelSchedule(
      locationId,
      manageOptions(source, 'delete', `Scheduled fuel price update cancelled for ${stationName}`),
    )
  },

  checkPendingVerification<T = unknown>() {
    return fuelPricingApi.checkPendingVerification<T>(
      verificationOptions('read', 'Pending fuel price receipt verification checked'),
    )
  },

  verifyPriceReceipt(input: FuelPriceVerification, stationName: string) {
    return fuelPricingApi.verifyPriceReceipt(
      input,
      verificationOptions('update', `Fuel price receipt verification submitted for ${stationName}`),
    )
  },

  getTicker<T = unknown>(source: FuelPricingSource = 'fuel-pricing.dashboard') {
    return fuelPricingApi.getTicker<T>(
      readOptions(source, 'fuel-price', 'Fuel price ticker checked'),
    )
  },
}
