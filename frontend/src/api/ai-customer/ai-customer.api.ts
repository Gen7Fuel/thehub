import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
import type { AiCustomerScenario } from './ai-customer.types'

export const aiCustomerApi = {
  async listScenarios(options: RequestOptions): Promise<AiCustomerScenario[]> {
    const response = await apiClient.get('/ai-customer/scenarios', requestConfig(options))
    return response.data.data
  },
}

