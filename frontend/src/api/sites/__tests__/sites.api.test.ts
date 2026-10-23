import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('@/api/core/clients', () => ({
  apiClient: mocks,
}))

import { sitesApi } from '../sites.service'

describe('sitesApi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the protected Settings endpoint and annotates list reads', async () => {
    mocks.get.mockResolvedValue({ data: [] })

    await sitesApi.list()

    expect(mocks.get).toHaveBeenCalledWith(
      '/locations/settings',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Required-Permission': 'settings',
          'X-Action-Type': 'read',
          'X-Action-Source': 'settings.sites',
          'X-Action-Message': 'Site list viewed in Settings',
        }),
      }),
    )
  })

  it('gives register updates their exact business purpose', async () => {
    mocks.put.mockResolvedValue({ data: { location: { _id: 'site-1' } } })

    await sitesApi.update('site-1', { stationName: 'Rankin', registers: [] }, 'registers')

    expect(mocks.put).toHaveBeenCalledWith(
      '/locations/site-1',
      expect.any(Object),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Action-Message': 'Register configuration update requested for Rankin',
        }),
      }),
    )
  })

  it('annotates site access assignment as a bulk-capable mutation', async () => {
    mocks.post.mockResolvedValue({ data: { success: true } })

    await sitesApi.assignUsers('site-1', 'Rankin', ['user-1', 'user-2'])

    expect(mocks.post).toHaveBeenCalledWith(
      '/locations/site-1/assign-users',
      { stationName: 'Rankin', userIds: ['user-1', 'user-2'] },
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Action-Resource': 'site-access',
          'X-Action-Type': 'update',
        }),
      }),
    )
  })
})
