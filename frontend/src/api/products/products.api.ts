import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'

export const productsApi = {
  async list<T = unknown[]>(options: RequestOptions): Promise<T> {
    return (await apiClient.get('/products', requestConfig(options))).data
  },
}
