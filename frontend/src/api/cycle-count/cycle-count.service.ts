import { actionOptions } from '@/api/resources/action-options'
import { cycleCountApi } from './cycle-count.api'

const permissions = {
  count: 'cycleCount',
  manage: 'cycleCount.manageCount',
  lookup: 'cycleCount.lookup',
  writeOff: 'writeOff.create',
  dashboard: 'dashboard',
} as const

const read = (permission: string, source: string, resource: string, message: string) =>
  actionOptions(permission, source, 'read', resource, message)
const mutate = (
  permission: string,
  source: string,
  action: 'create' | 'update' | 'delete',
  resource: string,
  message: string,
) => actionOptions(permission, source, action, resource, message)

export const cycleCountService = {
  getDailyItems<T = unknown>(site: string) {
    return cycleCountApi.get<T>('/daily-items-v2', { site }, read(permissions.count, 'cycle-count.count', 'cycle-count-instance', `Cycle Count opened for ${site}`))
  },
  saveItem<T = unknown>(input: { entryId: string; field: 'foh' | 'boh'; value: number; breakdown?: unknown; site?: string }) {
    return cycleCountApi.post<T>('/save-item-v2', input, mutate(permissions.count, 'cycle-count.count', 'update', 'cycle-count-item', `Cycle Count ${input.field.toUpperCase()} update requested for item ${input.entryId}`))
  },
  finalize<T = unknown>(siteName: string, targetDate?: string, source = 'cycle-count.count') {
    const dateLabel = targetDate ? ` for ${targetDate}` : ''
    return cycleCountApi.post<T>('/finalize-and-sync', { siteName, targetDate }, mutate(permissions.count, source, 'update', 'cycle-count-instance', `Cycle Count finalization and inventory sync requested for ${siteName}${dateLabel}`))
  },
  getDailyReport<T = unknown>(site: string, date: string) {
    return cycleCountApi.get<T>('/daily-report', { site, date }, read(permissions.count, 'cycle-count.report', 'cycle-count-report', `Cycle Count report viewed for ${site} on ${date}`))
  },
  getInstanceNotes<T = unknown>(instanceId: string | number) {
    return cycleCountApi.get<T>(`/instance-notes/${encodeURIComponent(String(instanceId))}`, undefined, read(permissions.count, 'cycle-count.report', 'cycle-count-note', `Cycle Count notes viewed for instance ${instanceId}`))
  },
  addInstanceNote<T = unknown>(instanceId: string | number, note: string) {
    return cycleCountApi.post<T>('/instance-notes', { instanceId, note }, mutate(permissions.count, 'cycle-count.report', 'create', 'cycle-count-note', `Cycle Count note added to instance ${instanceId}`))
  },
  updateManagerCount<T = unknown>(itemId: string | number, input: unknown) {
    return cycleCountApi.put<T>(`/items/${encodeURIComponent(String(itemId))}/manager-count`, input, mutate(permissions.count, 'cycle-count.report', 'update', 'cycle-count-item', `Manager recount update requested for Cycle Count item ${itemId}`))
  },
  listInstances<T = unknown>(site: string, view: 'active' | 'historical') {
    return cycleCountApi.get<T>('/instances', { site, view }, read(permissions.manage, 'cycle-count.manage.schedule', 'cycle-count-instance', `${view === 'active' ? 'Active' : 'Historical'} Cycle Count schedules viewed for ${site}`))
  },
  checkScheduleDate<T = unknown>(site: string, date: string) {
    return cycleCountApi.get<T>('/schedules/check-date', { site, date }, read(permissions.manage, 'cycle-count.manage.schedule', 'cycle-count-instance', `Cycle Count schedule date checked for ${site} on ${date}`))
  },
  listActiveRules<T = unknown>() {
    return cycleCountApi.get<T>('/groups/active-rules', undefined, read(permissions.manage, 'cycle-count.manage.schedule', 'cycle-count-group', 'Active Cycle Count group rules viewed for scheduling'))
  },
  getSchedule<T = unknown>(id: string | number) {
    return cycleCountApi.get<T>(`/schedules/details/${encodeURIComponent(String(id))}`, undefined, read(permissions.manage, 'cycle-count.manage.schedule', 'cycle-count-instance', `Cycle Count schedule ${id} viewed`))
  },
  createSchedule<T = unknown>(input: { site: string; date: string; [key: string]: unknown }) {
    return cycleCountApi.post<T>('/schedules/create', input, mutate(permissions.manage, 'cycle-count.manage.schedule', 'create', 'cycle-count-instance', `Cycle Count schedule creation requested for ${input.site} on ${input.date}`))
  },
  searchScheduleItems<T = unknown>(query: string, siteMongoId: string) {
    return cycleCountApi.get<T>('/schedules/items/search', { query, siteMongoId }, read(permissions.manage, 'cycle-count.manage.schedule', 'inventory-item', 'Inventory items searched while editing a Cycle Count schedule'))
  },
  addScheduleItems<T = unknown>(instanceId: string | number, productIds: Array<string | number>) {
    return cycleCountApi.put<T>(`/schedules/details/${encodeURIComponent(String(instanceId))}/items`, { productIds }, mutate(permissions.manage, 'cycle-count.manage.schedule', 'update', 'cycle-count-instance', `${productIds.length} item${productIds.length === 1 ? '' : 's'} addition requested for Cycle Count schedule ${instanceId}`))
  },
  removeScheduleItems<T = unknown>(instanceId: string | number, productIds: Array<string | number>) {
    return cycleCountApi.remove<T>(`/schedules/details/${encodeURIComponent(String(instanceId))}/items`, { productIds }, mutate(permissions.manage, 'cycle-count.manage.schedule', 'delete', 'cycle-count-item', `${productIds.length} item${productIds.length === 1 ? '' : 's'} removal requested from Cycle Count schedule ${instanceId}`))
  },
  deleteInstance<T = unknown>(id: string | number) {
    return cycleCountApi.remove<T>(`/instance/${encodeURIComponent(String(id))}`, undefined, mutate(permissions.manage, 'cycle-count.manage.schedule', 'delete', 'cycle-count-instance', `Cycle Count schedule ${id} deletion requested`))
  },
  listGroups<T = unknown>() {
    return cycleCountApi.get<T>('/groups', undefined, read(permissions.manage, 'cycle-count.manage.groups', 'cycle-count-group', 'Cycle Count groups viewed'))
  },
  getGroup<T = unknown>(id: string | number) {
    return cycleCountApi.get<T>(`/groups/${encodeURIComponent(String(id))}`, undefined, read(permissions.manage, 'cycle-count.manage.groups', 'cycle-count-group', `Cycle Count group ${id} opened for editing`))
  },
  getFilterableColumns<T = unknown>() {
    return cycleCountApi.get<T>('/groups/filterable-columns', undefined, read(permissions.manage, 'cycle-count.manage.groups', 'inventory-field', 'Available Cycle Count group fields viewed'))
  },
  getUniqueValues<T = unknown>(column: string) {
    return cycleCountApi.get<T>('/groups/unique-values', { column }, read(permissions.manage, 'cycle-count.manage.groups', 'inventory-field-value', `Available values viewed for Cycle Count group field ${column}`))
  },
  previewGroupItems<T = unknown>(site: string, column: string, values: string[]) {
    return cycleCountApi.get<T>('/groups/preview-items', { site, column, values: values.join(',') }, read(permissions.manage, 'cycle-count.manage.groups', 'inventory-item', `Cycle Count group preview viewed for ${site}`))
  },
  createGroup<T = unknown>(input: { name: string; filter_column: string; values: string[] }) {
    return cycleCountApi.post<T>('/groups', input, mutate(permissions.manage, 'cycle-count.manage.groups', 'create', 'cycle-count-group', `Cycle Count group creation requested for ${input.name}`))
  },
  updateGroup<T = unknown>(id: string | number, input: { name: string; values: string[] }) {
    return cycleCountApi.put<T>(`/groups/${encodeURIComponent(String(id))}`, input, mutate(permissions.manage, 'cycle-count.manage.groups', 'update', 'cycle-count-group', `Cycle Count group update requested for ${input.name}`))
  },
  deleteGroup<T = unknown>(id: string | number, name?: string) {
    return cycleCountApi.remove<T>(`/groups/${encodeURIComponent(String(id))}`, undefined, mutate(permissions.manage, 'cycle-count.manage.groups', 'delete', 'cycle-count-group', `Cycle Count group deletion requested${name ? ` for ${name}` : ` for ID ${id}`}`))
  },
  getItemBook<T = unknown>(site: string) {
    return cycleCountApi.get<T>('/item-bk', { site }, read(permissions.manage, 'cycle-count.manage.items', 'inventory-item', `Cycle Count item book viewed for ${site}`))
  },
  massEditItemBook<T = unknown>(site: string, ids: Array<string | number>, updates: unknown) {
    return cycleCountApi.put<T>('/item-bk/mass-edit', { ids, updates }, mutate(permissions.manage, 'cycle-count.manage.items', 'update', 'inventory-item', `${ids.length} Cycle Count item-book record${ids.length === 1 ? '' : 's'} update requested for ${site}`))
  },
  getCurrentInventory<T = unknown>(site: string, limit?: number) {
    return cycleCountApi.get<T>('/current-inventory', { site, limit }, read(permissions.count, 'cycle-count.inventory', 'inventory', `Current inventory viewed for ${site}${limit ? ` (first ${limit} items)` : ''}`))
  },
  getInventoryCategories<T = unknown>(site: string) {
    return cycleCountApi.get<T>('/inventory-categories', { site }, read(permissions.count, 'cycle-count.inventory', 'inventory-category', `Inventory categories viewed for ${site}`))
  },
  lookupItem<T = unknown>(upcBarcode: string, site: string) {
    return cycleCountApi.get<T>('/lookup', { upc_barcode: upcBarcode, site }, read(permissions.lookup, 'order-rec.scan', 'inventory-item', `Inventory item lookup requested for scanned code at ${site}`))
  },
  searchItemsForWriteOff<T = unknown>(site: string, query: string) {
    return cycleCountApi.get<T>('/search', { site, q: query }, read(permissions.writeOff, 'write-off.create', 'inventory-item', `Inventory item search requested for write-off at ${site}`))
  },
  getDashboardDailyCounts<T = unknown>(site: string, startDate: string, endDate: string) {
    return cycleCountApi.get<T>('/v2/daily-counts', { site, startDate, endDate }, read(permissions.dashboard, 'dashboard.cycle-count', 'cycle-count-summary', `Cycle Count dashboard summary viewed for ${site} from ${startDate} to ${endDate}`))
  },
}
