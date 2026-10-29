import { actionOptions } from '@/api/resources/action-options'
import { createFuelResourceApi } from './resource.api'

const api = createFuelResourceApi('/fuel-sales')

export const fuelSalesService = {
  sync<T = unknown>(stationId: string, stationName?: string) {
    return api.post<T>(`/sync/${encodeURIComponent(stationId)}`, {}, actionOptions('fuelManagement.workspace', 'fuel-management.workspace', 'update', 'fuel-sales', `Live fuel sales synchronization requested for ${stationName || stationId}`))
  },
}
