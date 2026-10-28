export interface DateRangeReportInput {
  stationName: string
  startDate: string
  endDate: string
}

export interface EndOfDayReportInput extends DateRangeReportInput {
  includeIndividualReports: boolean
  includeChickenDelight: boolean
}

export interface ArCustomerReportInput extends DateRangeReportInput {
  includeArPaidReport: boolean
}

export interface ReportRequestResult {
  success?: boolean
  message?: string
  [key: string]: unknown
}

