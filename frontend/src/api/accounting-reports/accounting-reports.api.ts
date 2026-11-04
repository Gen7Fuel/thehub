import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
import type {
  ArCustomerReportInput,
  DateRangeReportInput,
  EndOfDayReportInput,
  ReportRequestResult,
  SageAccountMap,
  SageExportReportInput,
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

  async getSageAccountMap(site: string, options: RequestOptions): Promise<SageAccountMap | null> {
    return (await apiClient.get('/sage-account-maps', {
      ...requestConfig(options),
      params: { site },
    })).data
  },

  async createSageAccountMap(input: Omit<SageAccountMap, '_id'>, options: RequestOptions): Promise<SageAccountMap> {
    return (await apiClient.post('/sage-account-maps', input, requestConfig(options))).data
  },

  async updateSageAccountMap(id: string, input: Pick<SageAccountMap, 'depositAccName' | 'depositAccountNumber' | 'glaccount'>, options: RequestOptions): Promise<SageAccountMap> {
    return (await apiClient.put(`/sage-account-maps/${id}`, input, requestConfig(options))).data
  },

  async requestSageExport(input: SageExportReportInput, options: RequestOptions): Promise<ReportRequestResult> {
    return (await apiClient.post('/accounting-reports/sage-export', input, requestConfig(options))).data
  },
}

