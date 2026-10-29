import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  cdnPost: vi.fn(),
}))

vi.mock('@/api/core/clients', () => ({
  apiClient: { get: mocks.get, post: mocks.post, put: mocks.put },
  cdnClient: { post: mocks.cdnPost },
}))

import { cashSummaryService } from '../cash-summary.service'

describe('cashSummaryService request metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockResolvedValue({ data: {} })
    mocks.post.mockResolvedValue({ data: { saved: true } })
    mocks.put.mockResolvedValue({ data: { saved: true } })
    mocks.cdnPost.mockResolvedValue({ data: { id: 'image-1' } })
  })

  it('annotates form reads with the selected site and date', async () => {
    await cashSummaryService.getFormShifts('Rankin', '2026-10-28')

    expect(mocks.get).toHaveBeenCalledWith('/cash-summary/by-date', expect.objectContaining({
      params: { site: 'Rankin', date: '2026-10-28' },
      headers: expect.objectContaining({
        'X-Required-Permission': 'accounting.cashSummary.form',
        'X-Action-Type': 'read',
        'X-Action-Source': 'cash-summary.form',
        'X-Action-Resource': 'cash-summary-shift',
        'X-Action-Message': 'Cash Summary shifts opened for Rankin on 2026-10-28',
      }),
    }))
  })

  it('uses the shared Locations API with Cash Summary purpose metadata', async () => {
    await cashSummaryService.getLocationProfile('Rankin', 'cash-summary.report', 'accounting.cashSummary.report')

    expect(mocks.get).toHaveBeenCalledWith('/locations/name/Rankin', expect.objectContaining({
      headers: expect.objectContaining({
        'X-Required-Permission': 'accounting.cashSummary.report',
        'X-Action-Source': 'cash-summary.report',
        'X-Action-Resource': 'location',
        'X-Action-Message': 'Site configuration loaded for Rankin in Cash Summary',
      }),
    }))
  })

  it('uses the shared Safesheet API for over-short balances', async () => {
    await cashSummaryService.getSafesheetBalances('Rankin', '2026-10-01', '2026-10-28')

    expect(mocks.get).toHaveBeenCalledWith('/safesheets/site/Rankin/daily-balances', expect.objectContaining({
      params: { from: '2026-10-01', to: '2026-10-28' },
      headers: expect.objectContaining({
        'X-Required-Permission': 'accounting.cashSummary.overShortReport',
        'X-Action-Source': 'cash-summary.over-short',
        'X-Action-Resource': 'safesheet-balance',
      }),
    }))
  })

  it('annotates batch and report mutations independently', async () => {
    await cashSummaryService.saveFormShifts([{ shift_number: '10001' }], 'Rankin', '2026-10-28')
    await cashSummaryService.setSubmitted('Rankin', '2026-10-28', true)

    expect(mocks.post).toHaveBeenCalledWith('/cash-summary/batch', expect.any(Object), expect.objectContaining({
      headers: expect.objectContaining({
        'X-Action-Type': 'update',
        'X-Action-Source': 'cash-summary.form',
        'X-Action-Message': 'Cash Summary shift data save requested for Rankin on 2026-10-28',
      }),
    }))
    expect(mocks.put).toHaveBeenCalledWith('/cash-summary/report/submitted', expect.any(Object), expect.objectContaining({
      headers: expect.objectContaining({
        'X-Required-Permission': 'accounting.cashSummary.report.unlockShift',
        'X-Action-Source': 'cash-summary.report',
        'X-Action-Message': 'Cash Summary report submission requested for Rankin on 2026-10-28',
      }),
    }))
  })

  it('uses Lottery permission for lottery and datawave image uploads', async () => {
    const file = new File(['image'], 'lottery.jpg', { type: 'image/jpeg' })
    await cashSummaryService.uploadImage(file, 'Rankin', '2026-10-28', 'datawave')

    expect(mocks.cdnPost).toHaveBeenCalledWith('/upload', expect.any(FormData), expect.objectContaining({
      authRequired: false,
      headers: expect.objectContaining({
        'X-Required-Permission': 'accounting.cashSummary.lottery',
        'X-Action-Type': 'create',
        'X-Action-Source': 'cash-summary.datawave',
      }),
    }))
  })
})
