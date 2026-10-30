import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }))
vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { payablesService } from '../payables.service'

describe('Payables API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.values(mocks).forEach(mock => mock.mockResolvedValue({ data: {} }))
  })

  it('annotates site and date-range list reads', async () => {
    await payablesService.list(
      { location: 'location-1', from: '2026-10-01', to: '2026-10-31' },
      { site: 'Rankin', from: '2026-10-01', to: '2026-10-31' },
    )
    expect(mocks.get).toHaveBeenCalledWith('/payables', expect.objectContaining({
      params: { location: 'location-1', from: '2026-10-01', to: '2026-10-31' },
      headers: expect.objectContaining({
        'X-Required-Permission': 'payables',
        'X-Action-Source': 'payables.list',
        'X-Action-Message': 'Payables viewed for Rankin from 2026-10-01 to 2026-10-31',
      }),
    }))
  })

  it('reuses Locations and records readable offline creation intent', async () => {
    mocks.get.mockResolvedValueOnce({ data: [{ _id: 'location-1', stationName: 'Rankin' }] })
    await payablesService.resolveLocationAndCreate({
      vendorName: 'Shell Canada', location: 'Rankin', amount: 123.45, date: '2026-10-30', images: [],
    })
    expect(mocks.get.mock.calls[0][0]).toBe('/locations')
    expect(mocks.post).toHaveBeenCalledWith('/payables', expect.objectContaining({ location: 'location-1' }), expect.objectContaining({
      headers: expect.objectContaining({
        'X-Action-Source': 'payables.offline-sync',
        'X-Action-Message': expect.stringContaining('Shell Canada'),
      }),
    }))
  })

  it('annotates invoice completion, date changes, and deletion', async () => {
    const payable = { _id: 'payable-1', vendorName: 'Vendor A', amount: 50, location: { stationName: 'Rankin' } }
    await payablesService.update(payable, { requestInvoice: false }, 'Requested invoice uploaded')
    await payablesService.remove(payable)
    expect(mocks.put.mock.calls[0][2].headers['X-Action-Message']).toContain('Requested invoice uploaded')
    expect(mocks.delete.mock.calls[0][1].headers).toEqual(expect.objectContaining({
      'X-Action-Type': 'delete', 'X-Action-Source': 'payables.list',
    }))
  })

  it('prevents active Payables code from reintroducing direct backend calls', () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url))
    const src = path.resolve(testDir, '../../..')
    for (const relative of [
      'routes/_navbarLayout/payables/index.tsx',
      'routes/_navbarLayout/payables/list.tsx',
      'routes/_navbarLayout/payables/review.tsx',
      'lib/utils.ts',
    ]) {
      const source = fs.readFileSync(path.join(src, relative), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      expect(source).not.toMatch(/["'`]\/api\/payables/)
    }
  })
})
