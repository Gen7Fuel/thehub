import type { ActionType, RequestOptions } from '@/api/core/types'
import { purchaseOrdersApi, type PurchaseOrderQuery } from './purchase-orders.api'

const context = (source: string, action: ActionType, message: string, permission = 'po'): RequestOptions => ({
  permission,
  actionContext: { source, action, resourceType: 'purchase-order', message },
})

const label = (order: Record<string, any>) => order.poNumber ? `PO #${order.poNumber}` : `purchase order for ${order.customerName || 'unknown customer'}`

export const purchaseOrdersService = {
  list<T = unknown[]>(query: PurchaseOrderQuery, source = 'po.list') {
    const site = query.stationName || query.site || 'all sites'
    const range = query.startDate && query.endDate ? ` from ${query.startDate} to ${query.endDate}` : ''
    return purchaseOrdersApi.list<T>(query, context(source, 'read', `Purchase orders viewed for ${site}${range}`))
  },
  checkUnique(stationName: string, poNumber: string) {
    return purchaseOrdersApi.checkUnique(stationName, poNumber, context('po.form', 'read', `PO #${poNumber} availability checked for ${stationName}`))
  },
  create<T extends Record<string, any>, R = unknown>(input: T, source = 'po.form') {
    return purchaseOrdersApi.create<T, R>(input, context(source, 'create', `${label(input)} created for ${input.stationName || 'unknown site'}${input.date ? ` on ${input.date}` : ''}`))
  },
  update<T, R = unknown>(order: Record<string, any>, input: T, purpose: string, permission = 'po') {
    return purchaseOrdersApi.update<T, R>(order._id, input, context('po.list', 'update', `${purpose} for ${label(order)}`, permission))
  },
  remove<T = unknown>(order: Record<string, any>) {
    return purchaseOrdersApi.remove<T>(order._id, context('po.list', 'delete', `${label(order)} deletion requested`, 'po.delete'))
  },
}
