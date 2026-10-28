import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { aiCustomerService } from '../ai-customer.service'

describe('aiCustomerService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('adds voice-agent permission and purpose headers to scenario reads', async () => {
    mocks.get.mockResolvedValue({ data: { success: true, data: [] } })
    await aiCustomerService.listScenarios()
    expect(mocks.get).toHaveBeenCalledWith('/ai-customer/scenarios', expect.objectContaining({
      headers: expect.objectContaining({
        'X-Required-Permission': 'training.voiceAgent',
        'X-Action-Type': 'read',
        'X-Action-Source': 'ai-customer',
        'X-Action-Message': 'AI Customer training scenarios viewed',
      }),
    }))
  })
})

