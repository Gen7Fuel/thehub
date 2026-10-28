import { actionOptions } from '@/api/resources/action-options'
import { accountingReportsApi } from './accounting-reports.api'
import type { ArCustomerReportInput, DateRangeReportInput, EndOfDayReportInput } from './accounting-reports.types'

const reportOptions = (permission: string, source: string, resourceType: string, message: string) =>
  actionOptions(permission, source, 'read', resourceType, message)

const range = (input: DateRangeReportInput) => `${input.stationName} (${input.startDate} to ${input.endDate})`

export const accountingReportsService = {
  requestInfonet(formData: FormData, site: string) {
    return accountingReportsApi.requestInfonet(formData, reportOptions(
      'accounting.accountingReports.infonet',
      'accounting-reports.infonet',
      'accounting-report',
      `Infonet report generation requested for ${site}`,
    ))
  },

  requestEndOfDay(input: EndOfDayReportInput) {
    return accountingReportsApi.requestEndOfDay(input, reportOptions(
      'accounting.accountingReports.endOfDayReport',
      'accounting-reports.end-of-day',
      'accounting-report',
      `End of Day report generation requested for ${range(input)}`,
    ))
  },

  requestArCustomer(input: ArCustomerReportInput) {
    return accountingReportsApi.requestArCustomer(input, reportOptions(
      'accounting.accountingReports.arCustomerReport',
      'accounting-reports.ar-customer',
      'accounting-report',
      `A/R Customer report generation requested for ${range(input)}`,
    ))
  },

  requestApCustomer(input: DateRangeReportInput) {
    return accountingReportsApi.requestApCustomer(input, reportOptions(
      'accounting.accountingReports.apCustomerReport',
      'accounting-reports.ap-customer',
      'accounting-report',
      `A/P Customer report generation requested for ${range(input)}`,
    ))
  },
}
