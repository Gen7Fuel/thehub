import type { RequestOptions } from '@/api/core/types'
import { statusSalesApi } from './status-sales.api'

const ctx = (source: string, action: 'read' | 'create', resourceType: string, message: string): RequestOptions => ({
  permission: 'status', actionContext: { source, action, resourceType, message },
})

export const statusSalesService = {
  list<T>(query: { stationName: string; startDate: string; endDate: string }) {
    return statusSalesApi.list<T>(query, ctx('status.list', 'read', 'status-sale', `Status sales viewed for ${query.stationName} from ${query.startDate} to ${query.endDate}`))
  },
  customer<T>(card: string) { return statusSalesApi.customer<T>(card, ctx('status.form', 'read', 'status-customer', `Status customer details looked up for card ending ${card.slice(-4)}`)) },
  create<T extends { stationName?: string; statusCardNumber?: string; amount?: string | number }, R = unknown>(input: T) {
    return statusSalesApi.create<T, R>(input, ctx('status.form', 'create', 'status-sale', `Status sale submitted for ${input.stationName || 'unknown site'}, card ending ${input.statusCardNumber?.slice(-4) || 'unknown'}, ${input.amount || 0} litres`))
  },
}
