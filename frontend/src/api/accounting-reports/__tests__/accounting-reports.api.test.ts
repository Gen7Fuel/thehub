import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { accountingReportsService } from '../accounting-reports.service'

describe('accountingReportsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.post.mockResolvedValue({ data: { success: true } })
  })

  it('classifies report-generation POST requests as reads, not data changes', async () => {
    await accountingReportsService.requestEndOfDay({
      stationName: 'Rankin', startDate: '2026-10-01', endDate: '2026-10-02',
      includeIndividualReports: false, includeChickenDelight: false,
    })
    expect(mocks.post.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'accounting.accountingReports.endOfDayReport',
      'X-Action-Type': 'read',
      'X-Action-Resource': 'accounting-report',
      'X-Action-Source': 'accounting-reports.end-of-day',
      'X-Action-Message': 'End of Day report generation requested for Rankin (2026-10-01 to 2026-10-02)',
    }))
  })

  it('adds a clear purpose to multipart Infonet generation', async () => {
    await accountingReportsService.requestInfonet(new FormData(), 'Rankin')
    expect(mocks.post.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'accounting.accountingReports.infonet',
      'X-Action-Message': 'Infonet report generation requested for Rankin',
    }))
  })
})
