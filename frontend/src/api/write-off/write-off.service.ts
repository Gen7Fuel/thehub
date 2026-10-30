import { actionOptions } from '@/api/resources/action-options'
import { writeOffApi } from './write-off.api'

const permissions = {
  create: 'writeOff.create',
  requests: 'writeOff.requests',
  updateMissingUpc: 'writeOff.requests.list.updateMissingItemsUpc',
  pushMissing: 'writeOff.requests.list.pushMissingItems',
} as const

const read = (permission: string, source: string, resourceType: string, message: string) =>
  actionOptions(permission, source, 'read', resourceType, message)
const mutate = (permission: string, source: string, action: 'create' | 'update' | 'delete' | 'approve', resourceType: string, message: string) =>
  actionOptions(permission, source, action, resourceType, message)

export const writeOffService = {
  getWorkList<T = unknown>(site: string) {
    return writeOffApi.getWorkList<T>({ site }, read(permissions.create, 'write-off.create', 'write-off-cart', `Write-off draft list viewed for ${site}`))
  },
  addWorkListItem<T = unknown>(site: string, item: unknown) {
    const name = (item as { name?: string })?.name || 'item'
    return writeOffApi.addWorkListItem<T>({ site, item }, mutate(permissions.create, 'write-off.create', 'create', 'write-off-cart-item', `Write-off draft item ${name} added for ${site}`))
  },
  updateWorkListItem<T = unknown>(site: string, itemId: string, field: string, value: unknown) {
    return writeOffApi.updateWorkListItem<T>(itemId, { site, [field]: value }, mutate(permissions.create, 'write-off.create', 'update', 'write-off-cart-item', `Write-off draft item ${itemId} ${field} update requested for ${site}`))
  },
  removeWorkListItem<T = unknown>(site: string, itemId: string) {
    return writeOffApi.removeWorkListItem<T>(itemId, site, mutate(permissions.create, 'write-off.create', 'delete', 'write-off-cart-item', `Write-off draft item ${itemId} removal requested for ${site}`))
  },
  clearWorkList<T = unknown>(site: string) {
    return writeOffApi.clearWorkList<T>(site, mutate(permissions.create, 'write-off.create', 'delete', 'write-off-cart', `Write-off draft list cleared for ${site}`))
  },
  list<T = unknown>(site: string, type: 'WO' | 'ATE' | 'BT', from?: string, to?: string) {
    return writeOffApi.list<T>({ site, listType: type, from, to }, read(permissions.requests, 'write-off.requests', 'write-off', `Write-off ${type} requests viewed for ${site}${from && to ? ` from ${from} to ${to}` : ''}`))
  },
  get<T = unknown>(id: string) {
    return writeOffApi.get<T>(id, read(permissions.requests, 'write-off.detail', 'write-off', `Write-off ${id} opened for review`))
  },
  create<T = unknown>(input: { site: string; submittedBy?: string; items: unknown[]; timestamp: number }) {
    return writeOffApi.create<T>(input, mutate(permissions.create, 'write-off.create', 'create', 'write-off', `Write-off submission requested for ${input.site} with ${input.items.length} item${input.items.length === 1 ? '' : 's'}`))
  },
  addComment<T = unknown>(id: string, itemId: string, input: { initials: string; author: string; text: string }) {
    return writeOffApi.addComment<T>(id, itemId, input, mutate(permissions.requests, 'write-off.detail', 'create', 'write-off-comment', `Comment added to write-off ${id} item ${itemId}`))
  },
  updateItemDetails<T = unknown>(id: string, itemId: string, input: { qty: number; reason?: string; markdownAction?: string | null }) {
    return writeOffApi.updateItemDetails<T>(id, itemId, input, mutate(permissions.requests, 'write-off.detail', 'update', 'write-off-item', `Write-off ${id} item ${itemId} details update requested`))
  },
  updateItemCompleted<T = unknown>(id: string, itemId: string, completed: boolean) {
    return writeOffApi.updateItemCompleted<T>(id, itemId, { completed }, mutate(permissions.requests, 'write-off.detail', 'update', 'write-off-item', `Write-off ${id} item ${itemId} completion changed to ${completed}`))
  },
  finalize<T = unknown>(id: string, listType: string) {
    return writeOffApi.finalize<T>(id, mutate(permissions.requests, 'write-off.detail', 'approve', 'write-off', `Write-off ${id} ${listType === 'BT' ? 'approval' : 'finalization'} requested`))
  },
  updateMissingUpc<T = unknown>(id: string, itemId: string, upc: string) {
    return writeOffApi.updateMissingUpc<T>(id, itemId, upc, mutate(permissions.updateMissingUpc, 'write-off.detail', 'update', 'write-off-item', `Missing UPC update requested for write-off ${id} item ${itemId}`))
  },
  resubmitMissing<T = unknown>(id: string) {
    return writeOffApi.resubmitMissing<T>(id, mutate(permissions.pushMissing, 'write-off.detail', 'update', 'write-off', `Missing write-off items resubmission requested for ${id}`))
  },
}
