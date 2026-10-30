import type { ActionType, RequestOptions } from '@/api/core/types'
import { locationsApi } from '@/api/locations/locations.api'
import { vendorsApi } from './vendors.api'

const ctx = (source: string, action: ActionType, message: string, permission = 'vendor'): RequestOptions => ({
  permission, actionContext: { source, action, resourceType: 'vendor', message },
})

export const vendorsService = {
  list<T = unknown[]>(source = 'vendor.list', query?: { location?: string; category?: string }, message?: string, permission = 'vendor') {
    return vendorsApi.list<T>(ctx(source, 'read', message || `Vendors viewed${query?.location ? ` for ${query.location}` : ''}`, permission), query)
  },
  get<T>(id: string, source = 'order-rec.detail') { return vendorsApi.get<T>(id, ctx(source, 'read', 'Vendor details loaded for Order Rec', source.startsWith('order-rec') ? 'orderRec.id' : 'vendor')) },
  getByName<T>(id: string) { return vendorsApi.getByName<T>(id, ctx('vendor.edit', 'read', 'Vendor and site configuration opened for editing')) },
  create<T extends { name?: string; sites?: Array<{ site: string }> }, R = unknown>(input: T) {
    const sites = input.sites?.map(s => s.site).join(', ') || 'unknown sites'
    return vendorsApi.create<T, R>(input, ctx('vendor.create', 'create', `Vendor ${input.name || 'unknown'} creation requested for ${sites}`))
  },
  update<T extends { name?: string; sites?: Array<{ site: string }> }, R = unknown>(id: string, input: T) {
    const sites = input.sites?.map(s => s.site).join(', ') || 'unknown sites'
    return vendorsApi.update<T, R>(id, input, ctx('vendor.edit', 'update', `Vendor ${input.name || 'unknown'} update requested for ${sites}`))
  },
  listLocations(source: string, permission = 'vendor') {
    return locationsApi.list(ctx(source, 'read', 'Locations loaded for vendor configuration', permission))
  },
}
