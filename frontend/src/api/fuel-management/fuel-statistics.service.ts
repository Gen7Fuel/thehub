import { actionOptions } from '@/api/resources/action-options'
import { createFuelResourceApi } from './resource.api'

const api = createFuelResourceApi('/fuel-statistics')
const options = (message: string) => actionOptions('fuelManagement.statistics', 'fuel-management.statistics', 'read', 'fuel-statistics', message)

export const fuelStatisticsService = {
  inventoryCoverage<T = unknown>(stationGradePairs: unknown[], horizonDays = 14) {
    return api.post<T>('/inventory-coverage', { stationGradePairs, horizonDays }, options(`Fuel inventory coverage statistics viewed for ${stationGradePairs.length} station-grade selection${stationGradePairs.length === 1 ? '' : 's'}`))
  },
  pipelineSummary<T = unknown>(stationIds: string[], fromMonth: string, toMonth: string) {
    return api.post<T>('/pipeline-summary', { stationIds, fromMonth, toMonth }, options(`Fuel order pipeline statistics viewed for ${stationIds.length} station${stationIds.length === 1 ? '' : 's'} from ${fromMonth} to ${toMonth}`))
  },
  salesSummary<T = unknown>(stationIds: string[], fromMonth: string, toMonth: string) {
    return api.post<T>('/sales-summary', { stationIds, fromMonth, toMonth }, options(`Fuel sales statistics viewed for ${stationIds.length} station${stationIds.length === 1 ? '' : 's'} from ${fromMonth} to ${toMonth}`))
  },
}
