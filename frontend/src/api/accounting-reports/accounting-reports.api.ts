import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
import type {
  ArCustomerReportInput,
  DateRangeReportInput,
  EndOfDayReportInput,
  ReportRequestResult,
} from './accounting-reports.types'

export const accountingReportsApi = {
  async requestInfonet(formData: FormData, options: RequestOptions): Promise<ReportRequestResult> {
    return (await apiClient.post('/accounting-reports/infonet-reports', formData, requestConfig(options))).data
  },

  async requestEndOfDay(input: EndOfDayReportInput, options: RequestOptions): Promise<ReportRequestResult> {
    return (await apiClient.post('/accounting-reports/eod-reports/cumulative', input, requestConfig(options))).data
  },

  async requestArCustomer(input: ArCustomerReportInput, options: RequestOptions): Promise<ReportRequestResult> {
    return (await apiClient.post('/accounting-reports/ar-customer-report', input, requestConfig(options))).data
  },

  async requestApCustomer(input: DateRangeReportInput, options: RequestOptions): Promise<ReportRequestResult> {
    return (await apiClient.post('/accounting-reports/ap-customer-report', input, requestConfig(options))).data
  },
}

