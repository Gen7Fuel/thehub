import { actionOptions } from '@/api/resources/action-options'
import { atmApi } from './atm.api'
import type { ATMRecordFilters, CreateATMRecordInput } from './atm.types'

const permission = 'accounting.atm'
const source = 'accounting.atm'

export const atmService = {
  list(filters: ATMRecordFilters) {
    const location = filters.stationName || 'all accessible sites'
    return atmApi.list(filters, actionOptions(permission, source, 'read', 'atm-record', `ATM records viewed for ${location}`))
  },

  create(input: CreateATMRecordInput) {
    return atmApi.create(input, actionOptions(permission, source, 'create', 'atm-record', `ATM fill record creation requested for ${input.stationName}`))
  },

  remove(id: string) {
    return atmApi.remove(id, actionOptions(permission, source, 'delete', 'atm-record', `ATM record ${id} deletion requested`))
  },
}

