import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { fuelPricingService } from '../fuel-pricing.service'

describe('Fuel Pricing API contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const mock of Object.values(mocks)) mock.mockResolvedValue({ data: {} })
  })

  it('distinguishes dashboard, desktop, and mobile reads', async () => {
    await fuelPricingService.getMatrix('20261029')
    await fuelPricingService.getCurrent('location-1', 'Rankin', 'fuel-pricing.desktop')
    await fuelPricingService.getLogs('location-2', 'Sarnia', 'fuel-pricing.mobile')

    expect(mocks.get.mock.calls[0]).toEqual([
      '/fuel-pricing',
      expect.objectContaining({
        params: { date: '20261029' },
        headers: expect.objectContaining({
          'X-Required-Permission': 'fuelPricing',
          'X-Action-Source': 'fuel-pricing.dashboard',
          'X-Action-Message': 'Fuel pricing dashboard viewed for 20261029',
        }),
      }),
    ])
    expect(mocks.get.mock.calls[1][1].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'fuelPricing.setFuelPrice',
      'X-Action-Source': 'fuel-pricing.desktop',
      'X-Action-Message': 'Current fuel prices viewed for Rankin',
    }))
    expect(mocks.get.mock.calls[2][1].headers).toEqual(expect.objectContaining({
      'X-Action-Source': 'fuel-pricing.mobile',
      'X-Action-Message': 'Fuel price history viewed for Sarnia',
    }))
  })

  it('annotates live and scheduled price mutations with readable purposes', async () => {
    await fuelPricingService.publish({
      locationId: 'location-1',
      stationName: 'Rankin',
      prices: { REG: 1.599 },
      isScheduled: false,
      scheduledDateTime: null,
    }, 'fuel-pricing.mobile')
    await fuelPricingService.updateSchedule({
      locationId: 'location-1',
      prices: { REG: 1.609 },
      scheduledDateTime: '2026-10-30T08:00',
    }, 'Rankin', 'fuel-pricing.desktop')
    await fuelPricingService.cancelSchedule('location-1', 'Rankin', 'fuel-pricing.desktop')

    expect(mocks.post.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Action-Type': 'update',
      'X-Action-Resource': 'fuel-price',
      'X-Action-Source': 'fuel-pricing.mobile',
      'X-Action-Message': 'Fuel price update for Rankin requested for immediate publishing',
    }))
    expect(mocks.put.mock.calls[0][2].headers['X-Action-Message'])
      .toBe('Scheduled fuel prices updated for Rankin at 2026-10-30T08:00')
    expect(mocks.delete.mock.calls[0][1].headers).toEqual(expect.objectContaining({
      'X-Action-Type': 'delete',
      'X-Action-Message': 'Scheduled fuel price update cancelled for Rankin',
    }))
  })

  it('centralizes verification and ticker requests without frontend-only permissions', async () => {
    await fuelPricingService.checkPendingVerification()
    await fuelPricingService.verifyPriceReceipt(
      { locationId: 'location-1', filename: 'bulloch.jpg' },
      'Rankin',
    )
    await fuelPricingService.getTicker()

    expect(mocks.get.mock.calls[0][0]).toBe('/fuel-pricing/check-pending-verification')
    expect(mocks.get.mock.calls[0][1].headers).not.toHaveProperty('X-Required-Permission')
    expect(mocks.put.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Action-Source': 'fuel-pricing.verification',
      'X-Action-Message': 'Fuel price receipt verification submitted for Rankin',
    }))
    expect(mocks.put.mock.calls[0][2].headers).not.toHaveProperty('X-Required-Permission')

    const configs = [
      ...mocks.get.mock.calls.map((call) => call[1]),
      ...mocks.put.mock.calls.map((call) => call[2]),
    ]
    for (const config of configs) {
      expect(config.headers['X-Required-Permission'] || '').not.toMatch(/\.value$/)
    }
  })

  it('prevents Fuel Pricing UI and its shared hook from reintroducing direct HTTP calls', () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url))
    const frontendRoot = path.resolve(testDir, '../../..')
    const targets = [
      path.join(frontendRoot, 'hooks/useFuelPricing.ts'),
      path.join(frontendRoot, 'routes/_navbarLayout/fuel-pricing.tsx'),
      path.join(frontendRoot, 'routes/_navbarLayout/fuel-pricing-mobile.tsx'),
      path.join(frontendRoot, 'routes/_navbarLayout/fuel-pricing/pricing/index.tsx'),
      path.join(frontendRoot, 'components/custom/FuelPriceTicker.tsx'),
    ]

    for (const file of targets) {
      const source = fs.readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      expect(source, path.relative(frontendRoot, file)).not.toMatch(/axios\.(get|post|put|patch|delete)\s*\(/)
      expect(source, path.relative(frontendRoot, file)).not.toMatch(/\bfetch\s*\(/)
      expect(source, path.relative(frontendRoot, file)).not.toMatch(/["'`]\/api\/fuel-pricing/)
    }
  })
})
