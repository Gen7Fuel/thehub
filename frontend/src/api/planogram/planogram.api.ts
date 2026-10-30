import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

export const planogramApi = {
  async get<T>(site: string, options: RequestOptions): Promise<T> { return (await apiClient.get('/planogram', { ...requestConfig(options), params: { site } })).data },
  async upload<T>(site: string, file: File, confirm: boolean, options: RequestOptions): Promise<T> {
    const form = new FormData(); form.append('file', file)
    return (await apiClient.post('/planogram', form, { ...requestConfig(options), params: { site, ...(confirm ? { confirm: true } : {}) } })).data
  },
}
