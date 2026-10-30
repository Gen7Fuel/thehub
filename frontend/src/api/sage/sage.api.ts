import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

export const sageApi = {
  async exchangeToken<T>(code: string, options: RequestOptions): Promise<T> { return (await apiClient.post('/sage/token', { code }, requestConfig(options))).data },
}
