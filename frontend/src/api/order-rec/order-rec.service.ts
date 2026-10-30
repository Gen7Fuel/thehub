import type { ActionType, RequestOptions } from '@/api/core/types'
import { orderRecApi } from './order-rec.api'

const ctx = (source: string, action: ActionType, message: string, permission = 'orderRec'): RequestOptions => ({
  permission, actionContext: { source, action, resourceType: 'order-rec', message },
})
const label = (order: any) => order?.filename || order?.integerId || order?._id || 'unknown order'

export const orderRecService = {
  list<T>(query: Record<string, unknown>, source = 'order-rec.list') { return orderRecApi.list<T>(query, ctx(source, 'read', `Order Recs viewed${query.site ? ` for ${query.site}` : ''}`)) },
  workflow<T>(week: string) { return orderRecApi.workflow<T>(week, ctx('order-rec.workflow', 'read', `Order Rec workflow viewed for week of ${week}`, 'orderRec.workflow')) },
  range<T>(query: Record<string, unknown>) { return orderRecApi.range<T>(query, ctx('order-rec.dashboard', 'read', `Order Rec dashboard viewed${query.site ? ` for ${query.site}` : ''}`)) },
  get<T>(id: string, source = 'order-rec.detail') { return orderRecApi.get<T>(id, ctx(source, 'read', `Order Rec ${id} opened`, 'orderRec.id')) },
  create<T extends Record<string, any>, R = unknown>(input: T, source = 'order-rec.create') { return orderRecApi.create<T, R>(input, ctx(source, 'create', `Order Rec creation requested for ${input.site || 'unknown site'}`, 'orderRec.upload')) },
  update<T, R = unknown>(order: any, input: T, source = 'order-rec.detail', purpose = 'Order Rec updated') { return orderRecApi.update<T, R>(order._id || order, input, ctx(source, 'update', `${purpose}: ${label(order)}`, 'orderRec.id')) },
  updateItem<T, R = unknown>(order: any, catIdx: number, itemIdx: number, input: T) { return orderRecApi.updateItem<T, R>(order._id || order, catIdx, itemIdx, input, ctx('order-rec.detail', 'update', `Order Rec item updated: ${label(order)}`, 'orderRec.id')) },
  updateNote<T>(order: any, note: string, source = 'order-rec.detail') { return orderRecApi.updateNote<T>(order._id || order, note, ctx(source, 'update', `Extra-items note updated: ${label(order)}`, 'orderRec.id')) },
  remove<T>(order: any) { return orderRecApi.remove<T>(order._id || order, ctx('order-rec.detail', 'delete', `Order Rec deletion requested: ${label(order)}`, 'orderRec.id.deleteButton')) },
  updateStatus<T>(order: any, input: Record<string, unknown>) { return orderRecApi.updateStatus<T>(order._id || order, input, ctx('order-rec.workflow', 'update', `Order Rec ${label(order)} status changed to ${input.status}`, 'orderRec.workflow')) },
  addComment<T>(order: any, input: { text: string; photos?: string[] }, source = 'order-rec.detail') { return orderRecApi.addComment<T>(order._id || order, input, ctx(source, 'update', `Comment added to Order Rec ${label(order)}`, source === 'order-rec.workflow' ? 'orderRec.workflow' : 'orderRec.id')) },
  assignVendor<T>(order: any, vendorId: string, vendorName?: string) { return orderRecApi.assignVendor<T>(order._id, vendorId, ctx('order-rec.workflow', 'update', `Order Rec ${label(order)} assigned to ${vendorName || 'selected vendor'}`, 'orderRec.workflow')) },
  lookupScanItem<T>(site: string, upc: string) { return orderRecApi.lookupScanItem<T>(site, upc, ctx('order-rec.scanner', 'read', `Barcode looked up for store-created Order Rec at ${site}`)) },
  createScan<T extends { site?: string }, R = unknown>(input: T) { return orderRecApi.createScan<T, R>(input, ctx('order-rec.scanner', 'create', `Store-created Order Rec submitted for ${input.site || 'unknown site'}`, 'orderRec.scanToOrder')) },
  coremarkPriceBook<T>(upcs: string[]) { return orderRecApi.coremarkPriceBook<T>(upcs, ctx('order-rec.detail', 'read', `CoreMark price book loaded for ${upcs.length} Order Rec items`)) },
  sendEmail<T, R = unknown>(input: T, purpose: string) { return orderRecApi.sendEmail<T, R>(input, ctx('order-rec.detail', 'create', purpose, 'orderRec.id')) },
}
