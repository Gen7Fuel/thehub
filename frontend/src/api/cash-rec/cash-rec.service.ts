import { actionOptions } from '@/api/resources/action-options'
import { locationsApi } from '@/api/locations/locations.api'
import { payablesApi } from '@/api/payables/payables.api'
import { purchaseOrdersApi } from '@/api/purchase-orders/purchase-orders.api'
import { cashRecApi } from './cash-rec.api'

const permission = 'accounting.cashRec'
const sources = {
  report: 'cash-rec.report',
  entries: 'cash-rec.entries',
  bank: 'cash-rec.bank',
  kardpoll: 'cash-rec.kardpoll',
  receivables: 'cash-rec.receivables',
  payouts: 'cash-rec.payouts',
  administration: 'settings.cash-rec',
} as const

const read = (source: string, resourceType: string, message: string) =>
  actionOptions(permission, source, 'read', resourceType, message)
const mutate = (source: string, action: 'create' | 'update', resourceType: string, message: string) =>
  actionOptions(permission, source, action, resourceType, message)

export const cashRecService = {
  getReport<T = unknown>(site: string, date: string) {
    return cashRecApi.getEntries<T>({ site, date }, read(sources.report, 'cash-reconciliation', `Cash reconciliation report viewed for ${site} on ${date}`))
  },

  getEntries<T = unknown>(site: string, date: string) {
    return cashRecApi.getEntries<T>({ site, date }, read(sources.entries, 'cash-reconciliation', `Cash reconciliation entries viewed for ${site} on ${date}`))
  },

  getKardpollEntries<T = unknown>(site: string, date: string) {
    return cashRecApi.getKardpollEntries<T>({ site, date }, read(sources.report, 'kardpoll-report', `Kardpoll reconciliation details viewed for ${site} on ${date}`))
  },

  listReceivables<T = unknown[]>(site: string, startDate: string, endDate: string, source: string = sources.receivables) {
    return purchaseOrdersApi.list<T>(
      { stationName: site || undefined, startDate, endDate },
      read(source, 'purchase-order', `Cash reconciliation receivables viewed for ${site || 'all sites'} from ${startDate} to ${endDate}`),
    )
  },

  listPayouts<T = unknown[]>(site: string, from: string, to: string, source: string = sources.payouts) {
    return payablesApi.list<T>(
      { from, to },
      read(source, 'payable', `Cash reconciliation payout data loaded from ${from} to ${to}${site ? ` and displayed for ${site}` : ''}`),
    )
  },

  listLocationsForBankMatching<T = unknown[]>() {
    return locationsApi.list(
      read(sources.bank, 'location', 'Site list loaded to match an uploaded bank statement'),
    ) as Promise<T>
  },

  saveBankStatement<T = unknown>(input: { site: string; date: string; [key: string]: unknown }) {
    return cashRecApi.saveBankStatement<T>(input, mutate(sources.bank, 'create', 'bank-statement', `Bank statement capture requested for ${input.site} on ${input.date}`))
  },

  updateMerchantFees<T = unknown>(input: { site: string; date: string; merchantFees: number }) {
    return cashRecApi.updateMerchantFees<T>(input, mutate(sources.report, 'update', 'bank-statement', `Merchant fee update requested for ${input.site} on ${input.date}`))
  },

  uploadKardpollExcel<T = unknown>(input: FormData, site: string) {
    return cashRecApi.uploadKardpollExcel<T>(input, mutate(sources.kardpoll, 'update', 'kardpoll-report', `Kardpoll report upload requested for ${site}`))
  },

  sendWeeklyArReport<T = { message?: string }>() {
    return cashRecApi.sendWeeklyArReport<T>(mutate(sources.administration, 'create', 'ar-report', 'Weekly accounts receivable report generation requested'))
  },
}
