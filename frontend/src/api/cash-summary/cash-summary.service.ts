import { locationsApi } from '@/api/locations/locations.api'
import { safesheetsApi } from '@/api/safesheets/safesheets.api'
import { filesApi } from '@/api/files/files.api'
import { actionOptions } from '@/api/resources/action-options'
import { cashSummaryApi } from './cash-summary.api'

const permissions = {
  form: 'accounting.cashSummary.form',
  list: 'accounting.cashSummary.list',
  report: 'accounting.cashSummary.report',
  unlock: 'accounting.cashSummary.report.unlockShift',
  lottery: 'accounting.cashSummary.lottery',
  lotteryList: 'accounting.cashSummary.lotteryList',
  overShort: 'accounting.cashSummary.overShortReport',
} as const

const read = (permission: string, source: string, resourceType: string, message: string) =>
  actionOptions(permission, source, 'read', resourceType, message)
const mutate = (permission: string, source: string, action: 'create' | 'update', resourceType: string, message: string) =>
  actionOptions(permission, source, action, resourceType, message)

export const cashSummaryService = {
  getLocationProfile<T = unknown>(site: string, source: string, permission: string = permissions.form) {
    return locationsApi.getByName(site, read(permission, source, 'location', `Site configuration loaded for ${site} in Cash Summary`)) as Promise<T>
  },
  getFormShifts<T = unknown>(site: string, date: string) {
    return cashSummaryApi.getByDate<T>({ site, date }, read(permissions.form, 'cash-summary.form', 'cash-summary-shift', `Cash Summary shifts opened for ${site} on ${date}`))
  },
  saveFormShifts<T = unknown>(items: unknown[], site: string, date: string) {
    return cashSummaryApi.updateBatch<T>({ items }, mutate(permissions.form, 'cash-summary.form', 'update', 'cash-summary-shift', `Cash Summary shift data save requested for ${site} on ${date}`))
  },
  listSubmitted<T = unknown>(site: string, from: string, to: string) {
    return cashSummaryApi.getByRange<T>({ site, from, to }, read(permissions.list, 'cash-summary.list', 'cash-summary-shift', `Cash Summary List viewed for ${site} from ${from} to ${to}`))
  },
  getReport<T = unknown>(site: string, date: string) {
    return cashSummaryApi.getReport<T>({ site, date }, read(permissions.report, 'cash-summary.report', 'cash-summary-report', `Cash Summary report viewed for ${site} on ${date}`))
  },
  getLottery<T = unknown>(site: string, date: string, context: 'form' | 'lottery' | 'lottery-list' | 'report') {
    const permission = context === 'lottery-list' ? permissions.lotteryList : context === 'report' ? permissions.report : context === 'form' ? permissions.form : permissions.lottery
    return cashSummaryApi.getLottery<T>({ site, date }, read(permission, `cash-summary.${context}`, 'lottery-summary', `Lottery summary viewed for ${site} on ${date} in Cash Summary ${context}`))
  },
  saveLottery<T = unknown>(input: { site: string; date: string; [key: string]: unknown }) {
    return cashSummaryApi.saveLottery<T>(input, mutate(permissions.lottery, 'cash-summary.lottery', 'update', 'lottery-summary', `Lottery summary save requested for ${input.site} on ${input.date}`))
  },
  setSubmitted<T = unknown>(site: string, date: string, submitted: boolean) {
    return cashSummaryApi.updateReportField<T>('submitted', { site, date, submitted }, mutate(permissions.unlock, 'cash-summary.report', 'update', 'cash-summary-report', `Cash Summary report ${submitted ? 'submission' : 'unlock'} requested for ${site} on ${date}`))
  },
  saveNotes<T = unknown>(site: string, date: string, notes: string) {
    return cashSummaryApi.updateReportField<T>('notes', { site, date, notes }, mutate(permissions.report, 'cash-summary.report', 'update', 'cash-summary-report', `Cash Summary notes update requested for ${site} on ${date}`))
  },
  saveAdjustment<T = unknown>(site: string, date: string, key: 'unsettledPrepays' | 'handheldDebit', value: number) {
    const field = key === 'unsettledPrepays' ? 'unsettled-prepays' : 'handheld-debit'
    return cashSummaryApi.updateReportField<T>(field, { site, date, [key]: value }, mutate(permissions.report, 'cash-summary.report', 'update', 'cash-summary-report', `Cash Summary ${key === 'unsettledPrepays' ? 'unsettled prepays' : 'handheld debit'} update requested for ${site} on ${date}`))
  },
  getPayoutsCheck<T = unknown>(site: string, date: string) {
    return cashSummaryApi.getPayoutsCheck<T>({ site, date }, read(permissions.report, 'cash-summary.report', 'payable-reconciliation', `Cash Summary payout reconciliation checked for ${site} on ${date}`))
  },
  getArCheck<T = unknown>(site: string, date: string) {
    return cashSummaryApi.getArCheck<T>({ site, date }, read(permissions.report, 'cash-summary.report', 'receivable-reconciliation', `Cash Summary accounts receivable reconciliation checked for ${site} on ${date}`))
  },
  getVoidedDetails<T = unknown>(site: string, date: string) {
    return cashSummaryApi.getVoidedTransactionDetails<T>({ site, date }, read(permissions.report, 'cash-summary.report', 'voided-transaction', `Voided transaction details viewed for ${site} on ${date}`))
  },
  getOverShort<T = unknown>(site: string, from: string, to: string) {
    return cashSummaryApi.getOverShort<T>({ site, from, to }, read(permissions.overShort, 'cash-summary.over-short', 'cash-over-short', `Cash over/short report viewed for ${site} from ${from} to ${to}`))
  },
  getDashboardOverShort<T = unknown>(site: string) {
    return cashSummaryApi.getOverShort<T>({ site }, read('dashboard', 'dashboard.accounting', 'cash-over-short', `Cash over/short dashboard viewed for ${site}`))
  },
  getDashboardPayablesComparison<T = unknown>(site: string) {
    return cashSummaryApi.getPayablesComparison<T>({ site }, read('dashboard', 'dashboard.accounting', 'payables-comparison', `Payables comparison dashboard viewed for ${site}`))
  },
  getInfoNetReport<T = unknown>(site: string, from: string, to: string) {
    return cashSummaryApi.getTaxExemptReport<T>({ site, from, to }, read('accounting.infonetReport', 'infonet-report', 'infonet-tax-report', `InfoNet tax report viewed for ${site} from ${from} to ${to}`))
  },
  getSafesheetBalances<T = unknown>(site: string, from: string, to: string) {
    return safesheetsApi.getDailyBalances<T>(site, from, to, read(permissions.overShort, 'cash-summary.over-short', 'safesheet-balance', `Safesheet daily balances used for Cash Summary over/short report for ${site} from ${from} to ${to}`))
  },
  uploadImage(file: File, site: string, date: string, purpose: 'pinpad' | 'lottery' | 'datawave') {
    const permission = purpose === 'pinpad' ? permissions.form : permissions.lottery
    return filesApi.upload(file, { ...mutate(permission, `cash-summary.${purpose}`, 'create', 'cash-summary-image', `${purpose} image upload requested for ${site} on ${date}`), auth: false })
  },
}
