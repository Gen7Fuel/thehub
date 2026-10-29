export type FuelPricingSource =
  | 'fuel-pricing.dashboard'
  | 'fuel-pricing.desktop'
  | 'fuel-pricing.mobile'
  | 'fuel-pricing.verification'

export interface FuelPriceSubmission {
  locationId: string
  stationName: string
  prices: Record<string, number>
  isScheduled: boolean
  scheduledDateTime: string | null
}

export interface FuelScheduleUpdate {
  locationId: string
  prices: Record<string, number>
  scheduledDateTime: string
}

export interface FuelPriceVerification {
  locationId: string
  filename: string
  infonetFilename?: string | null
}

export interface FuelPricingMutationResponse {
  success?: boolean
  message?: string
  autoDeferred?: boolean
  isScheduled?: boolean
  updatesApplied?: number
}
