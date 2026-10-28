import axios from 'axios'

export class ApiError extends Error {
  readonly status?: number
  readonly code?: string
  readonly details?: unknown
  readonly requestId?: string
  readonly cause: unknown

  constructor(error: unknown) {
    const response = axios.isAxiosError(error) ? error.response : undefined
    const data = response?.data as { message?: string; error?: string; details?: unknown } | undefined
    super(data?.message || data?.error || (error instanceof Error ? error.message : 'Request failed'))
    this.name = 'ApiError'
    this.status = response?.status
    this.code = axios.isAxiosError(error) ? error.code : undefined
    this.details = data?.details ?? data
    this.requestId = response?.headers?.['x-request-id']
    this.cause = error
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError
