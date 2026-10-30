import { actionOptions } from '@/api/resources/action-options'
import { locationsApi } from '@/api/locations/locations.api'
import { orderRecApi } from '@/api/order-rec/order-rec.api'
import { safesheetsApi } from '@/api/safesheets/safesheets.api'
import { vendorsApi } from '@/api/vendors/vendors.api'
import { dashboardApi } from './dashboard.api'

const read = (source: string, resourceType: string, message: string) =>
  actionOptions('dashboard', source, 'read', resourceType, message)

export const dashboardService = {
  refreshCacheForSettings<T = { message: string }>() {
    return dashboardApi.refreshCache<T>(
      actionOptions('settings', 'settings.system', 'update', 'dashboard-cache', 'Manual Dashboard cache refresh requested from Settings'),
    )
  },
  getOrderRecRange<T = unknown>(query: Record<string, unknown>) {
    return orderRecApi.range<T>(query, read('dashboard.order-recs', 'order-rec', `Order Rec dashboard viewed${query.site ? ` for ${query.site}` : ''}`))
  },
  getOrderRecs<T = unknown>(site: string, startDate: string, endDate: string) {
    return orderRecApi.list<T>({ site, startDate, endDate }, read('dashboard.order-recs', 'order-rec', `Order Recs dashboard status viewed for ${site} from ${startDate} to ${endDate}`))
  },
  getSafeBalances<T = unknown>(site: string, from: string, to: string) {
    return safesheetsApi.getDailyBalances<T>(site, from, to, read('dashboard.safesheet', 'safesheet-balance', `Safesheet balances viewed on Dashboard for ${site} from ${from} to ${to}`))
  },
  getLocation<T = unknown>(site: string) {
    return locationsApi.getByName(site, read('dashboard.site', 'location', `Site configuration loaded for Dashboard: ${site}`)) as Promise<T>
  },
  getVendors<T = unknown[]>(site: string) {
    return vendorsApi.list<T>(read('dashboard.vendors', 'vendor', `Vendors viewed on Dashboard for ${site}`), { location: site })
  },
  getVendor<T = unknown>(vendorId: string) {
    return vendorsApi.get<T>(vendorId, read('dashboard.vendors', 'vendor', `Vendor ${vendorId} viewed on Dashboard`))
  },
  getSqlAllData<T = unknown>(query: Record<string, string>) {
    return dashboardApi.getSqlAllData<T>(query, read('dashboard.sql', 'dashboard-data', `Dashboard SQL data viewed for ${query.site || 'selected site'}`))
  },
}
