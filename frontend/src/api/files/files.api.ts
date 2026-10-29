import { cdnClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

export type UploadResult = {
  filename?: string
  fileInfo?: { filename?: string }
}

export const filesApi = {
  async upload(file: File, options: RequestOptions): Promise<UploadResult> {
    const form = new FormData()
    form.append('file', file)
    return (await cdnClient.post('/upload', form, requestConfig(options))).data
  },
}
