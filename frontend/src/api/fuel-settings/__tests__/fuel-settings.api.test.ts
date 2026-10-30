import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, post, put } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('@/api/core/clients', () => ({ apiClient: { get, post, put } }))

import { fuelSettingsService } from '../fuel-settings.service'

describe('Fuel Settings API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    get.mockResolvedValue({ data: [] })
    post.mockResolvedValue({ data: {} })
    put.mockResolvedValue({ data: {} })
  })

  it.each([
    ['supplier-discounts', 'fuelSettings.supplierDiscounts'],
    ['carrier-fcs', 'fuelSettings.fsc'],
    ['carrier-haulage', 'fuelSettings.haulage'],
    ['station-discounts', 'fuelSettings.stationDiscounts'],
  ] as const)('centralizes %s reads with purpose headers', async (resource, permission) => {
    await fuelSettingsService.list(resource)
    expect(get).toHaveBeenCalledWith(`/fuel-settings/${resource}`, expect.objectContaining({
      headers: expect.objectContaining({
        'X-Required-Permission': permission,
        'X-Action-Source': `fuel-settings.${resource}`,
      }),
    }))
  })

  it('describes next-month scheduled changes in the request message', async () => {
    await fuelSettingsService.updateBatch('carrier-fcs', {
      updates: [{ carrier: 'A' }],
      deletions: [],
      isImmediate: false,
    })
    expect(put).toHaveBeenCalledWith(
      '/fuel-settings/carrier-fcs/batch',
      expect.anything(),
      expect.objectContaining({ headers: expect.objectContaining({
        'X-Action-Message': expect.stringMatching(/scheduled for 1st of \w+ \d{4}/),
      }) }),
    )
  })

  it('uses the explicit station effective date in the request message', async () => {
    await fuelSettingsService.updateBatch('station-discounts', {
      updates: [{}], deletions: [], isImmediate: false, scheduleEffectiveDate: '2026-12-01',
    })
    expect(put).toHaveBeenCalledWith(
      '/fuel-settings/station-discounts/batch',
      expect.anything(),
      expect.objectContaining({ headers: expect.objectContaining({
        'X-Action-Message': expect.stringContaining('2026-12-01'),
      }) }),
    )
  })
})
