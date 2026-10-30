import { actionOptions } from '@/api/resources/action-options'
import { createFuelResourceApi } from './resource.api'

const api = createFuelResourceApi('/fuel-orders')
const opts = (permission: string, source: string, action: 'read' | 'create' | 'update', message: string) =>
  actionOptions(permission, source, action, 'fuel-order', message)

export function buildFuelOrderAccessGroupId(source: string, date: string, stationIds: string[]) {
  const value = `${source}|${date}|${[...stationIds].sort().join('|')}`
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${source}.${date}.${(hash >>> 0).toString(36)}`
}

export const fuelOrdersService = {
  listWorkspace<T = unknown>(
    stationId: string,
    date: string,
    source = 'fuel-management.workspace',
    accessContext?: { message: string; groupId: string },
  ) {
    const options = opts(
      'fuelManagement.workspace',
      source,
      'read',
      accessContext?.message || `Fuel orders viewed for station ${stationId} on ${date}`,
    )
    options.accessGroupId = accessContext?.groupId
    return api.get<T>('/workspace-orders', { stationId, date }, options)
  },
  checkExisting<T = unknown>(stationId: string, orderDate: string) {
    return api.get<T>('/check-existing', { stationId, orderDate }, opts('fuelManagement.createOrder', 'fuel-management.create-order', 'read', `Existing fuel orders checked for station ${stationId} on ${orderDate}`))
  },
  getRetainPoNumber<T = unknown>(sourceOrderId: string, stationId: string, orderDate: string) {
    return api.get<T>('/retain-po-number', { sourceOrderId, stationId, orderDate }, opts('fuelManagement.workspace.updateOrderStatus', 'fuel-management.workspace', 'read', `Retain PO number calculated from fuel order ${sourceOrderId}`))
  },
  create<T = unknown>(input: unknown, orderCount: number) {
    return api.post<T>('', input, opts('fuelManagement.createOrder', 'fuel-management.create-order', 'create', `${orderCount} fuel order${orderCount === 1 ? '' : 's'} creation requested`))
  },
  update<T = unknown>(id: string, input: unknown, message: string, permission: string, source = 'fuel-management.workspace') {
    return api.put<T>(`/${encodeURIComponent(id)}`, input, opts(permission, source, 'update', message))
  },
  retain<T = unknown>(input: unknown, sourceOrderId: string) {
    return api.post<T>('/retain', input, opts('fuelManagement.workspace.rescheduleOrder', 'fuel-management.workspace', 'create', `Fuel retain order creation requested from order ${sourceOrderId}`))
  },
  notifyUpcoming<T = unknown>() {
    return api.get<T>('/notify-upcoming', undefined, opts('fuelManagement.manage', 'fuel-management.manage', 'read', 'Upcoming fuel order notifications requested'))
  },
}
