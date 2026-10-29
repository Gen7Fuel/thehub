import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }))
vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { atmService } from '../atm.service'

describe('atmService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('annotates filtered ATM history reads', async () => {
    mocks.get.mockResolvedValue({ data: [] })
    await atmService.list({ stationName: 'Rankin', startDate: '2026-10-01', endDate: '2026-10-02' })
    expect(mocks.get.mock.calls[0][1]).toEqual(expect.objectContaining({
      params: expect.objectContaining({ stationName: 'Rankin' }),
      headers: expect.objectContaining({
        'X-Required-Permission': 'accounting.atm',
        'X-Action-Type': 'read',
        'X-Action-Source': 'accounting.atm',
        'X-Action-Message': 'ATM records viewed for Rankin',
      }),
    }))
  })

  it('annotates ATM record creation', async () => {
    mocks.post.mockResolvedValue({ data: { _id: 'atm-1' } })
    await atmService.create({ date: '2026-10-28', amount: 500, source: 'safe', image: 'receipt.jpg', stationName: 'Rankin' })
    expect(mocks.post.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Action-Type': 'create',
      'X-Action-Resource': 'atm-record',
      'X-Action-Message': 'ATM fill record creation requested for Rankin',
    }))
  })
})

