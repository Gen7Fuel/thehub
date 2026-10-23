// Settings Quick Customers orchestration across locations and AR customers.
import { arCustomersApi } from '@/api/ar-customers/ar-customers.api'
import type { ArCustomer, QuickSelectEntry } from '@/api/ar-customers/ar-customers.types'
import { locationsApi } from '@/api/locations/locations.api'
import { actionOptions } from '@/api/resources/action-options'
export type { ArCustomer, QuickSelectEntry } from '@/api/ar-customers/ar-customers.types'

const config = (action: 'read' | 'update' | 'create' | 'delete', resourceType: string, message: string) => actionOptions('po.manageQuickCustomers', 'settings.quick-customers', action, resourceType, message)

export const quickCustomersApi = {
  async listSites(): Promise<{ stationName: string }[]> {
    return locationsApi.listSettings(config('read', 'location', 'Sites viewed for Quick Customers configuration'))
  },
  async list(stationName: string): Promise<QuickSelectEntry[]> {
    return arCustomersApi.listQuickSelect(stationName, config('read', 'quick-customer', `Quick Customers viewed for ${stationName}`))
  },
  async listCustomers(stationName: string): Promise<ArCustomer[]> {
    return arCustomersApi.list(config('read', 'ar-customer', `AR customers searched while configuring Quick Customers for ${stationName}`))
  },
  async add(customer: ArCustomer, stationName: string): Promise<void> {
    await arCustomersApi.addQuickSelect(customer._id, stationName, config('create', 'quick-customer', `${customer.name} added to Quick Customers for ${stationName}`))
  },
  async move(id: string, name: string, stationName: string, direction: 'up' | 'down'): Promise<QuickSelectEntry[]> {
    return arCustomersApi.moveQuickSelect(stationName, id, direction, config('update', 'quick-customer-order', `${name} moved ${direction} in Quick Customers for ${stationName}`))
  },
  async remove(entry: QuickSelectEntry, stationName: string): Promise<void> {
    await arCustomersApi.removeQuickSelect(entry._id, stationName, config('delete', 'quick-customer', `${entry.name} removed from Quick Customers for ${stationName}`))
  },
  async updateLabel(entry: QuickSelectEntry, stationName: string, label: string): Promise<void> {
    await arCustomersApi.updateQuickSelectLabel(entry._id, stationName, label, config('update', 'quick-customer', `Button label updated for ${entry.name} at ${stationName}`))
  },
  async updateFleetCard(entry: QuickSelectEntry, stationName: string, fleetCardNumber: string): Promise<void> {
    await arCustomersApi.updateFleetCard(entry._id, fleetCardNumber, config('update', 'ar-customer', `Fleet card assignment updated for ${entry.name} while configuring ${stationName}`))
  },
}
