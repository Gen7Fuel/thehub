import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }))
vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))
import { quickCustomersApi } from '../quick-customers.service'

describe('quickCustomersApi', () => {
  beforeEach(() => vi.clearAllMocks())
  it('annotates site-specific reads', async () => {
    mocks.get.mockResolvedValue({ data: [] })
    await quickCustomersApi.list('Rankin')
    expect(mocks.get.mock.calls[0][1].headers).toEqual(expect.objectContaining({ 'X-Required-Permission': 'po.manageQuickCustomers', 'X-Action-Source': 'settings.quick-customers', 'X-Action-Message': 'Quick Customers viewed for Rankin' }))
  })
  it('does not expose a fleet card number in action metadata', async () => {
    mocks.put.mockResolvedValue({ data: {} })
    await quickCustomersApi.updateFleetCard({ _id: '1', name: 'Customer', fleetCardNumber: '', label: '', order: 0 }, 'Rankin', '1234567890123456')
    expect(JSON.stringify(mocks.put.mock.calls[0][2].headers)).not.toContain('1234567890123456')
  })
})
