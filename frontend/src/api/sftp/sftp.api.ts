import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

export type SftpFile = {
  name: string
  size: number
  modifyTime: number
  accessTime: number
  type: string
  path: string
}

export type SftpFileList = { files: SftpFile[] }

export const sftpApi = {
  async list<T = SftpFileList>(site: string, type: 'sft' | 'br', options: RequestOptions): Promise<T> {
    return (await apiClient.get('/sftp/receive', {
      ...requestConfig(options),
      params: { site, type },
    })).data
  },

  async get<T = { content?: string; metrics?: unknown }>(shift: string, site: string, type: 'sft' | 'br', options: RequestOptions): Promise<T> {
    return (await apiClient.get(`/sftp/receive/${encodeURIComponent(shift)}`, {
      ...requestConfig(options),
      params: { site, type },
    })).data
  },

  async shiftSummary<T = unknown>(options: RequestOptions): Promise<T> {
    return (await apiClient.get('/sftp/shift-summary', requestConfig(options))).data
  },
}
