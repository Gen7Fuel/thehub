import type { ActionType, RequestOptions } from '@/api/core/types'
import { fuelSettingsApi, type FuelSettingsBatchUpdate, type FuelSettingsResource } from './fuel-settings.api'

const labels: Record<FuelSettingsResource, string> = {
  'supplier-discounts': 'supplier discounts',
  'carrier-fcs': 'carrier fuel surcharges',
  'carrier-haulage': 'carrier haulage rates',
  'station-discounts': 'station discounts',
}
const permissions: Record<FuelSettingsResource, string> = {
  'supplier-discounts': 'fuelSettings.supplierDiscounts',
  'carrier-fcs': 'fuelSettings.fsc',
  'carrier-haulage': 'fuelSettings.haulage',
  'station-discounts': 'fuelSettings.stationDiscounts',
}
const options = (resource: FuelSettingsResource, action: ActionType, message: string, edit = false): RequestOptions => ({
  permission: `${permissions[resource]}${edit ? '.edit' : ''}`,
  actionContext: { action, resourceType: `fuel-${resource}`, source: `fuel-settings.${resource}`, message },
})
const nextMonth = () => new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric', timeZone: 'America/Toronto' })
  .format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1))
const updateMessage = <T>(resource: FuelSettingsResource, input: FuelSettingsBatchUpdate<T>) => {
  const counts = `${input.updates.length} updated and ${input.deletions.length} deleted`
  if (input.isImmediate) return `${labels[resource]} changed immediately — ${counts}`
  return `${labels[resource]} scheduled for ${input.scheduleEffectiveDate || `1st of ${nextMonth()}`} — ${counts}`
}

export const fuelSettingsService = {
  list<T>(resource: FuelSettingsResource) {
    return fuelSettingsApi.list<T>(resource, options(resource, 'read', `${labels[resource]} viewed`))
  },
  createBatch<T, R = unknown>(resource: FuelSettingsResource, entries: T[]) {
    return fuelSettingsApi.createBatch<T, R>(resource, entries, options(resource, 'create', `${entries.length} ${labels[resource]} rows created`, true))
  },
  updateBatch<T, R = unknown>(resource: FuelSettingsResource, input: FuelSettingsBatchUpdate<T>) {
    return fuelSettingsApi.updateBatch<T, R>(resource, input, options(resource, 'update', updateMessage(resource, input), true))
  },
  rescheduleStationDiscount<T extends { location: string; newScheduleDate: string }, R = unknown>(input: T) {
    return fuelSettingsApi.rescheduleStationDiscount<T, R>(input, options(
      'station-discounts',
      'update',
      `Station discount for ${input.location} rescheduled for ${input.newScheduleDate}`,
      true,
    ))
  },
}
