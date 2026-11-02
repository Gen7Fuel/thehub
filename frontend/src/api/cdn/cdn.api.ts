import { cdnClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

export const cdnApi = {
  async downloadImage(url: string) {
    return (await cdnClient.get<Blob>(url, {
      ...requestConfig({ auth: false }), baseURL: '', responseType: 'blob',
    })).data
  },
  async upload(input: FormData, options: RequestOptions) {
    return (await cdnClient.post<{ filename: string }>('/upload', input, requestConfig(options))).data
  },
  async uploadBase64(base64Data: string | null, fileName: string, options: RequestOptions) {
    return (await cdnClient.post('/upload-base64', { base64Data, fileName }, {
      ...requestConfig(options), timeout: 60000,
    })).data
  },
}
