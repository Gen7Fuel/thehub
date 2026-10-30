import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { dashboardService } from '../dashboard.service'

describe('dashboardService request metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockResolvedValue({ data: {} })
  })

  it('annotates the dashboard order-rec and safesheet reads', async () => {
    await dashboardService.getOrderRecRange({ site: 'Rankin', startDate: '2026-10-01', endDate: '2026-10-28' })
    await dashboardService.getOrderRecs('Rankin', '2026-10-20', '2026-10-26')
    await dashboardService.getSafeBalances('Rankin', '2026-10-01', '2026-10-21')

    expect(mocks.get).toHaveBeenNthCalledWith(1, '/order-rec/range', expect.objectContaining({
      params: { site: 'Rankin', startDate: '2026-10-01', endDate: '2026-10-28' },
      headers: expect.objectContaining({
        'X-Required-Permission': 'dashboard',
        'X-Action-Source': 'dashboard.order-recs',
        'X-Action-Resource': 'order-rec',
      }),
    }))
    expect(mocks.get).toHaveBeenNthCalledWith(2, '/order-rec', expect.objectContaining({
      params: { site: 'Rankin', startDate: '2026-10-20', endDate: '2026-10-26' },
      headers: expect.objectContaining({ 'X-Action-Source': 'dashboard.order-recs' }),
    }))
    expect(mocks.get).toHaveBeenNthCalledWith(3, '/safesheets/site/Rankin/daily-balances', expect.objectContaining({
      params: { from: '2026-10-01', to: '2026-10-21' },
      headers: expect.objectContaining({
        'X-Action-Source': 'dashboard.safesheet',
        'X-Action-Resource': 'safesheet-balance',
      }),
    }))
  })

  it('uses shared site, vendor, and SQL APIs with dashboard purposes', async () => {
    await dashboardService.getLocation('Rankin')
    await dashboardService.getVendors('Rankin')
    await dashboardService.getVendor('vendor-1')
    await dashboardService.getSqlAllData({ csoCode: 'CSO-1', site: 'Rankin', startDate: '2026-10-01', endDate: '2026-10-28' })

    expect(mocks.get).toHaveBeenNthCalledWith(1, '/locations/name/Rankin', expect.objectContaining({
      headers: expect.objectContaining({ 'X-Action-Source': 'dashboard.site', 'X-Action-Resource': 'location' }),
    }))
    expect(mocks.get).toHaveBeenNthCalledWith(2, '/vendors', expect.objectContaining({
      params: { location: 'Rankin' },
      headers: expect.objectContaining({ 'X-Action-Source': 'dashboard.vendors' }),
    }))
    expect(mocks.get).toHaveBeenNthCalledWith(3, '/vendors/vendor-1', expect.objectContaining({
      headers: expect.objectContaining({ 'X-Action-Source': 'dashboard.vendors' }),
    }))
    expect(mocks.get).toHaveBeenNthCalledWith(4, '/sql/all-data', expect.objectContaining({
      params: { csoCode: 'CSO-1', site: 'Rankin', startDate: '2026-10-01', endDate: '2026-10-28' },
      headers: expect.objectContaining({
        'X-Action-Source': 'dashboard.sql',
        'X-Action-Resource': 'dashboard-data',
      }),
    }))
  })

  it('annotates dashboard cash-summary reads without changing their permissions', async () => {
    const { cashSummaryService } = await import('@/api/cash-summary/cash-summary.service')

    await cashSummaryService.getDashboardOverShort('Rankin')
    await cashSummaryService.getDashboardPayablesComparison('Rankin')

    expect(mocks.get).toHaveBeenNthCalledWith(1, '/cash-summary/over-short', expect.objectContaining({
      params: { site: 'Rankin' },
      headers: expect.objectContaining({
        'X-Required-Permission': 'dashboard',
        'X-Action-Source': 'dashboard.accounting',
      }),
    }))
    expect(mocks.get).toHaveBeenNthCalledWith(2, '/cash-summary/payables-comparison', expect.objectContaining({
      params: { site: 'Rankin' },
      headers: expect.objectContaining({ 'X-Action-Source': 'dashboard.accounting' }),
    }))
  })
})
