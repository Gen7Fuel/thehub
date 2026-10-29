import type { AxiosRequestConfig } from 'axios'
import type { RequestOptions } from './types'

const HEADER_LIMITS = {
  message: 500,
  source: 100,
  resourceType: 80,
  accessGroupId: 160,
} as const

const cleanHeaderValue = (value: string, maxLength: number) =>
  value.replace(/[\r\n]+/g, ' ').trim().slice(0, maxLength)

export function requestConfig(options: RequestOptions = {}): AxiosRequestConfig {
  const headers: Record<string, string> = {}

  if (options.permission) headers['X-Required-Permission'] = options.permission
  if (options.accessGroupId) {
    headers['X-Action-Group-Id'] = cleanHeaderValue(
      options.accessGroupId,
      HEADER_LIMITS.accessGroupId,
    )
  }

  if (options.actionContext) {
    headers['X-Action-Type'] = options.actionContext.action
    headers['X-Action-Resource'] = cleanHeaderValue(
      options.actionContext.resourceType,
      HEADER_LIMITS.resourceType,
    )
    headers['X-Action-Source'] = cleanHeaderValue(
      options.actionContext.source,
      HEADER_LIMITS.source,
    )
    headers['X-Action-Message'] = cleanHeaderValue(
      options.actionContext.message,
      HEADER_LIMITS.message,
    )
  }

  return {
    headers,
    signal: options.signal,
    authRequired: options.auth !== false,
  } as AxiosRequestConfig
}
