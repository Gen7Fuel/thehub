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
    expect(mocks.post.mock.calls[0][1]).toHaveProperty('timeZone', Intl.DateTimeFormat().resolvedOptions().timeZone)
    expect(mocks.post.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'accounting.accountingReports.endOfDayReport',
      'X-Action-Type': 'read',
      'X-Action-Resource': 'accounting-report',
      'X-Action-Source': 'accounting-reports.end-of-day',
      'X-Action-Message': 'End of Day report generation requested for Rankin (2026-10-01 to 2026-10-02)',
    }))
  })

  it('adds a clear purpose to multipart Infonet generation', async () => {
    const form = new FormData()
    form.set('site', 'Rankin')
    await accountingReportsService.requestInfonet(form, 'Rankin')
    const sentForm = mocks.post.mock.calls[0][1] as FormData
    expect(sentForm.get('site')).toBe('Rankin')
    expect(sentForm.get('timeZone')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
    expect(mocks.post.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'accounting.accountingReports.infonet',
      'X-Action-Message': 'Infonet report generation requested for Rankin',
    }))
  })

  it('sends the browser timezone with both customer reports', async () => {
    const input = { stationName: 'Rankin', startDate: '2026-10-01', endDate: '2026-10-02' }
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    await accountingReportsService.requestArCustomer({ ...input, includeArPaidReport: true })
    await accountingReportsService.requestApCustomer(input)
    expect(mocks.post.mock.calls[0][1]).toEqual({ ...input, includeArPaidReport: true, timeZone })
    expect(mocks.post.mock.calls[1][1]).toEqual({ ...input, timeZone })
  })
})
