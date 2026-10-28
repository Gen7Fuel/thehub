import { actionOptions } from '@/api/resources/action-options'
import { aiCustomerApi } from './ai-customer.api'

export const aiCustomerService = {
  listScenarios() {
    return aiCustomerApi.listScenarios(actionOptions(
      'training.voiceAgent',
      'ai-customer',
      'read',
      'ai-customer-scenario',
      'AI Customer training scenarios viewed',
    ))
  },
}

