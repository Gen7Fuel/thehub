export interface ATMRecord {
  _id: string
  date: string
  amount: number
  source: 'till' | 'safe'
  image: string | null
  stationName: string
  site?: string
  createdBy: string
  createdAt: string
}

export interface CreateATMRecordInput {
  date: string
  amount: number
  source: string
  image: string
  stationName: string
}

export interface ATMRecordFilters {
  stationName?: string
  startDate?: string
  endDate?: string
}

