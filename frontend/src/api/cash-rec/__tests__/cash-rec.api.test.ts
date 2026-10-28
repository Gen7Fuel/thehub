import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}))

vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { cashRecService } from '../cash-rec.service'

describe('cashRecService request metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockResolvedValue({ data: [] })
    mocks.post.mockResolvedValue({ data: { saved: true } })
    mocks.patch.mockResolvedValue({ data: { saved: true } })
  })

  it('annotates the main reconciliation report with site and date', async () => {
    await cashRecService.getReport('Rankin', '2026-10-28')

    expect(mocks.get.mock.calls[0][0]).toBe('/cash-rec/entries')
    expect(mocks.get.mock.calls[0][1]).toEqual(expect.objectContaining({
      params: { site: 'Rankin', date: '2026-10-28' },
      headers: expect.objectContaining({
        'X-Required-Permission': 'accounting.cashRec',
        'X-Action-Type': 'read',
        'X-Action-Source': 'cash-rec.report',
        'X-Action-Resource': 'cash-reconciliation',
        'X-Action-Message': 'Cash reconciliation report viewed for Rankin on 2026-10-28',
      }),
    }))
  })

  it('uses the shared Purchase Orders endpoint with a Cash Rec purpose', async () => {
    await cashRecService.listReceivables('Rankin', '2026-10-27', '2026-10-28')

    expect(mocks.get.mock.calls[0][0]).toBe('/purchase-orders')
    expect(mocks.get.mock.calls[0][1]).toEqual(expect.objectContaining({
      params: { stationName: 'Rankin', startDate: '2026-10-27', endDate: '2026-10-28' },
      headers: expect.objectContaining({
        'X-Action-Source': 'cash-rec.receivables',
        'X-Action-Resource': 'purchase-order',
        'X-Action-Message': 'Cash reconciliation receivables viewed for Rankin from 2026-10-27 to 2026-10-28',
      }),
    }))
  })

  it('annotates bank captures and merchant-fee updates separately', async () => {
    await cashRecService.saveBankStatement({ site: 'Rankin', date: '2026-10-28' })
    await cashRecService.updateMerchantFees({ site: 'Rankin', date: '2026-10-27', merchantFees: 12.5 })

    expect(mocks.post.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Action-Type': 'create',
      'X-Action-Source': 'cash-rec.bank',
      'X-Action-Message': 'Bank statement capture requested for Rankin on 2026-10-28',
    }))
    expect(mocks.patch.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Action-Type': 'update',
      'X-Action-Source': 'cash-rec.report',
      'X-Action-Message': 'Merchant fee update requested for Rankin on 2026-10-27',
    }))
  })

  it('annotates Kardpoll uploads without placing file data in headers', async () => {
    const formData = new FormData()
    formData.append('site', 'Rankin')
    await cashRecService.uploadKardpollExcel(formData, 'Rankin')

    expect(mocks.post.mock.calls[0][0]).toBe('/cash-rec/parse-kardpoll-excel')
    expect(mocks.post.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Action-Type': 'update',
      'X-Action-Source': 'cash-rec.kardpoll',
      'X-Action-Resource': 'kardpoll-report',
      'X-Action-Message': 'Kardpoll report upload requested for Rankin',
    }))
  })
})
