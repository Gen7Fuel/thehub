import { actionOptions } from '@/api/resources/action-options'
import { createFuelResourceApi } from './resource.api'

const api = createFuelResourceApi('/fuel-station-tanks')
const opts = (permission: string, source: string, action: 'read' | 'create' | 'update' | 'delete', resource: string, message: string) =>
  actionOptions(permission, source, action, resource, message)

export const fuelStationTanksService = {
  listLocations<T = unknown>(source: string, message: string, permission = 'fuelManagement.workspace') {
    return api.get<T>('/all-locations', undefined, opts(permission, source, 'read', 'fuel-station', message))
  },
  listManagedStations<T = unknown>() {
    return api.get<T>('/stations', undefined, opts('fuelManagement.manage', 'fuel-management.manage.stations', 'read', 'fuel-station', 'Fuel Management stations viewed'))
  },
  getStationProjection<T = unknown>(
    stationId: string,
    date: string,
    source: string,
    permission = 'fuelManagement.workspace',
    accessContext?: { message: string; groupId: string },
  ) {
    const options = opts(
      permission,
      source,
      'read',
      'fuel-station-tank',
      accessContext?.message || `Fuel tank projection viewed for station ${stationId} on ${date}`,
    )
    options.accessGroupId = accessContext?.groupId
    return api.get<T>(`/station/${encodeURIComponent(stationId)}`, { date }, options)
  },
  syncAllVolumes<T = unknown>(source: string, message: string, permission = 'fuelManagement.volume.fetchLatestReading') {
    return api.get<T>('/sync-all-volumes', undefined, opts(permission, source, 'read', 'fuel-station-tank', message))
  },
  getReconciliation<T = unknown>(stationId: string) {
    return api.get<T>(`/reconciliation/${encodeURIComponent(stationId)}`, undefined, opts('fuelManagement.volume.viewHistoricalSalesVolumeChart', 'fuel-management.volume', 'read', 'fuel-reconciliation', `Historical fuel reconciliation viewed for station ${stationId}`))
  },
  getHistory<T = unknown>(tankId: string, date: string) {
    return api.get<T>(`/history/${encodeURIComponent(tankId)}`, { date }, opts('fuelManagement.volume.viewHistoricalVolume', 'fuel-management.volume', 'read', 'fuel-station-tank', `Fuel tank ${tankId} history viewed for ${date}`))
  },
  getLocation<T = unknown>(id: string) {
    return api.get<T>(`/location/${encodeURIComponent(id)}`, undefined, opts('fuelManagement.manage', 'fuel-management.manage.stations', 'read', 'fuel-station', `Fuel station ${id} opened for editing`))
  },
  updateLocation<T = unknown>(id: string, input: unknown, name?: string) {
    return api.put<T>(`/location/${encodeURIComponent(id)}`, input, opts('fuelManagement.manage', 'fuel-management.manage.stations', 'update', 'fuel-station', `Fuel station configuration update requested for ${name || id}`))
  },
  createTank<T = unknown>(input: unknown, stationName?: string) {
    return api.post<T>('/tanks', input, opts('fuelManagement.manage', 'fuel-management.manage.stations', 'create', 'fuel-station-tank', `Fuel tank creation requested${stationName ? ` for ${stationName}` : ''}`))
  },
  updateTank<T = unknown>(id: string, input: unknown, tankLabel?: string) {
    return api.put<T>(`/tanks/${encodeURIComponent(id)}`, input, opts('fuelManagement.manage', 'fuel-management.manage.stations', 'update', 'fuel-station-tank', `Fuel tank update requested for ${tankLabel || id}`))
  },
  manualUpdate<T = unknown>(
    id: string,
    input: unknown,
    tankLabel?: string,
    source = 'fuel-management.volume',
    permission = 'fuelManagement.volume.addPhysicalReading',
  ) {
    return api.patch<T>(
      `/manual-update/${encodeURIComponent(id)}`,
      input,
      opts(permission, source, 'update', 'fuel-station-tank', `Manual fuel volume reading submitted for ${tankLabel || id}`),
    )
  },
  removeTank<T = unknown>(id: string, tankLabel?: string) {
    return api.remove<T>(`/tanks/${encodeURIComponent(id)}`, opts('fuelManagement.manage', 'fuel-management.manage.stations', 'delete', 'fuel-station-tank', `Fuel tank removal requested for ${tankLabel || id}`))
  },
}
