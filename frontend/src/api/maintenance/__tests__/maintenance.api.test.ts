import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }))
vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))
import { maintenanceApi } from '../maintenance.service'

describe('maintenanceApi', () => {
  beforeEach(() => vi.clearAllMocks())
  it('distinguishes starting maintenance from editing it', async () => {
    mocks.put.mockResolvedValue({ data: {} })
    await maintenanceApi.update('1', { status: 'ongoing' }, 'Database upgrade', 'start')
    expect(mocks.put.mock.calls[0][2].headers).toEqual(expect.objectContaining({ 'X-Required-Permission': 'settings.maintenance', 'X-Action-Source': 'settings.maintenance', 'X-Action-Message': 'Maintenance Database upgrade start requested' }))
  })
  it('annotates user notifications separately', async () => {
    mocks.post.mockResolvedValue({ data: {} })
    await maintenanceApi.notify('1', 'Database upgrade')
    expect(mocks.post.mock.calls[0][2].headers['X-Action-Message']).toBe('User notification requested for maintenance Database upgrade')
  })
})
