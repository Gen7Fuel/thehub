import type { RequestOptions } from '@/api/core/types'
import { sftpApi } from './sftp.api'

const read = (source: string, resourceType: string, message: string, signal?: AbortSignal): RequestOptions => ({
  signal,
  actionContext: { action: 'read', resourceType, source, message },
})

export const sftpService = {
  listFiles<T = { files: unknown[] }>(site: string, type: 'sft' | 'br', signal?: AbortSignal) {
    return sftpApi.list<T>(site, type, read('sftp.files', 'sftp-file', `SFTP ${type.toUpperCase()} files viewed for ${site}`, signal))
  },

  getFile<T = { content?: string; metrics?: unknown }>(shift: string, site: string, type: 'sft' | 'br', signal?: AbortSignal) {
    return sftpApi.get<T>(shift, site, type, read('sftp.file-viewer', 'sftp-file', `SFTP ${type.toUpperCase()} shift ${shift} viewed for ${site}`, signal))
  },

  getShiftSummary<T = unknown>(signal?: AbortSignal) {
    return sftpApi.shiftSummary<T>(read('sftp.shift-summary', 'sftp-shift-summary', 'SFTP shift summary viewed', signal))
  },
}
