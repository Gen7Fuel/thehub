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

export interface SageExportReportInput {
  stationName: string
  date: string
}

export interface SageExportReportResult {
  success: boolean
  message: string
  filename: string
  csv: string
  headers: string[]
  rows: string[][]
}

export interface ReportRequestResult {
  success?: boolean
  message?: string
  [key: string]: unknown
}

export const SAGE_MAPPING_FIELDS = [
  "Fuel Sales",
  "CPL Discounts",
  "Store Sales",
  "Cash Counted",
  "GC Redemption",
  "On Account",
  "Cash Ov/Sh",
  "Payouts",
] as const

export type SageMappingField = typeof SAGE_MAPPING_FIELDS[number]

export interface SageGlAccount {
  accName: string
  accNo: string
  mappingField: SageMappingField
}

export interface SageAccountMap {
  _id: string
  site: string
  depositAccName: string
  depositAccountNumber: string
  glaccount: SageGlAccount[]
}

