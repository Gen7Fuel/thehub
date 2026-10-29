export interface EventRecord {
  _id: string
  site: string
  title: string
  description?: string
  date: string
  type?: 'system' | 'manual'
  createdBy: {
    id: string
    firstName?: string
    lastName?: string
    email?: string
  }
  createdAt: string
  updatedAt: string
}

export interface EventListResponse {
  success: boolean
  data: EventRecord[]
}

export interface CreateEventInput {
  title: string
  description: string
  date: string
  site: string
}

export interface EventMutationResponse {
  success: boolean
  data?: EventRecord
  _id?: string
}
