import type { ActionType, RequestOptions } from '@/api/core/types'
import { locationsApi } from '@/api/locations/locations.api'
import type { Site } from '@/api/locations/locations.types'
import { payablesApi, type PayablesQuery } from './payables.api'

const options = (source: string, action: ActionType, resourceType: string, message: string, permission = 'payables'): RequestOptions => ({
  permission,
  actionContext: { action, resourceType, source, message },
})
const amount = (value: unknown) => Number(value || 0).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })

export const payablesService = {
  list<T>(query: PayablesQuery, context: { site: string; from: string; to: string; source?: string }) {
    return payablesApi.list<T>(query, options(context.source || 'payables.list', 'read', 'payable', `Payables viewed for ${context.site} from ${context.from} to ${context.to}`))
  },
  listLocations() {
    return locationsApi.list(options('payables.list', 'read', 'location', 'Locations loaded for Payables filtering'))
  },
  listVendorOptions<T>(location: string) {
    return payablesApi.listVendorOptions<T>(location, options('payables.form', 'read', 'payable-vendor', `Payable vendor suggestions loaded for ${location}`))
  },
  create<T extends { vendorName?: string; amount?: number; date?: string }, R = unknown>(input: T, source = 'payables.form') {
    return payablesApi.create<T, R>(input, options(source, 'create', 'payable', `Payable for ${input.vendorName || 'unknown vendor'} created for ${amount(input.amount)}${input.date ? ` on ${input.date}` : ''}`))
  },
  update<T, R = unknown>(payable: { _id: string; vendorName: string; location?: { stationName?: string } }, input: T, purpose: string) {
    return payablesApi.update<T, R>(payable._id, input, options('payables.list', 'update', 'payable', `${purpose} for ${payable.vendorName}${payable.location?.stationName ? ` at ${payable.location.stationName}` : ''}`))
  },
  remove<T = unknown>(payable: { _id: string; vendorName: string; amount?: number; location?: { stationName?: string } }) {
    return payablesApi.remove<T>(payable._id, options('payables.list', 'delete', 'payable', `Payable for ${payable.vendorName} (${amount(payable.amount)}) deletion requested${payable.location?.stationName ? ` at ${payable.location.stationName}` : ''}`))
  },
  async resolveLocationAndCreate<T extends { location: string; vendorName?: string; amount?: number; date?: string }, R = unknown>(input: T & Record<string, unknown>) {
    const locations = await locationsApi.list(options('payables.offline-sync', 'read', 'location', `Location resolved for queued payable at ${input.location}`))
    const selected = locations.find((location: Site) => location.stationName === input.location)
    if (!selected) throw new Error(`Location "${input.location}" not found`)
    return payablesService.create({ ...input, location: selected._id }, 'payables.offline-sync') as Promise<R>
  },
}
