import { arCustomersApi } from '@/api/ar-customers/ar-customers.api'
import { fleetApi } from '@/api/fleet/fleet.api'
import { locationsApi } from '@/api/locations/locations.api'
import { productsApi } from '@/api/products/products.api'
import type { RequestOptions } from '@/api/core/types'

const read = (resourceType: string, message: string): RequestOptions => ({
  permission: 'po',
  actionContext: { action: 'read', source: 'po.form', resourceType, message },
})

export const purchaseOrderSupportService = {
  listProducts<T>() { return productsApi.list<T>(read('product', 'Products loaded for Purchase Order entry')) },
  listLocations() { return locationsApi.list(read('location', 'Locations loaded for Purchase Order entry')) },
  listCustomers() { return arCustomersApi.list(read('ar-customer', 'AR customers loaded for Purchase Order entry')) },
  listQuickCustomers(stationName: string) { return arCustomersApi.listQuickSelect(stationName, read('ar-customer', `Quick customers loaded for Purchase Order entry at ${stationName}`)) },
  getFleetCard<T>(cardNumber: string, stationName: string) { return fleetApi.getByCardNumber<T>(cardNumber, stationName, read('fleet-card', `Fleet card details checked for Purchase Order entry at ${stationName}`)) },
  verifyFleetCard<T>(cardNumber: string) { return fleetApi.verify<T>(cardNumber, read('fleet-card', 'Fleet card status verified for Purchase Order entry')) },
}
