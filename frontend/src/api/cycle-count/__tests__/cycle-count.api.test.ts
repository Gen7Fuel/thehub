import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { cycleCountService } from '../cycle-count.service'

describe('cycleCountService request metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockResolvedValue({ data: {} })
    mocks.post.mockResolvedValue({ data: { success: true } })
    mocks.put.mockResolvedValue({ data: { success: true } })
    mocks.delete.mockResolvedValue({ data: { success: true } })
  })

  it('annotates live count reads and PostgreSQL item updates', async () => {
    await cycleCountService.getDailyItems('Rankin')
    await cycleCountService.saveItem({ entryId: '451', field: 'foh', value: 12, site: 'Rankin' })

    expect(mocks.get).toHaveBeenCalledWith('/cycle-count/daily-items-v2', expect.objectContaining({
      params: { site: 'Rankin' },
      headers: expect.objectContaining({
        'X-Required-Permission': 'cycleCount',
        'X-Action-Source': 'cycle-count.count',
        'X-Action-Message': 'Cycle Count opened for Rankin',
      }),
    }))
    expect(mocks.post).toHaveBeenCalledWith('/cycle-count/save-item-v2', expect.objectContaining({ entryId: '451' }), expect.objectContaining({
      headers: expect.objectContaining({
        'X-Action-Type': 'update',
        'X-Action-Resource': 'cycle-count-item',
        'X-Action-Message': 'Cycle Count FOH update requested for item 451',
      }),
    }))
  })

  it('distinguishes report reads, notes, recounts, and finalization', async () => {
    await cycleCountService.getDailyReport('Rankin', '2026-10-29')
    await cycleCountService.addInstanceNote(81, 'Count verified')
    await cycleCountService.updateManagerCount(902, { manager_foh: 4 })
    await cycleCountService.finalize('Rankin', '2026-10-29', 'cycle-count.report')

    expect(mocks.get.mock.calls[0][1].headers).toEqual(expect.objectContaining({
      'X-Action-Source': 'cycle-count.report',
      'X-Action-Message': 'Cycle Count report viewed for Rankin on 2026-10-29',
    }))
    expect(mocks.post.mock.calls[0][2].headers['X-Action-Resource']).toBe('cycle-count-note')
    expect(mocks.put.mock.calls[0][2].headers['X-Action-Message']).toBe('Manager recount update requested for Cycle Count item 902')
    expect(mocks.post.mock.calls[1][2].headers['X-Action-Message']).toBe('Cycle Count finalization and inventory sync requested for Rankin for 2026-10-29')
  })

  it('annotates schedule and group administration with manage permission', async () => {
    await cycleCountService.createSchedule({ site: 'Rankin', date: '2026-11-01', day: 'Sunday' })
    await cycleCountService.createGroup({ name: 'Beverages', filter_column: 'category_id', values: ['10'] })
    await cycleCountService.deleteGroup(7, 'Beverages')

    expect(mocks.post.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'cycleCount.manageCount',
      'X-Action-Source': 'cycle-count.manage.schedule',
      'X-Action-Resource': 'cycle-count-instance',
    }))
    expect(mocks.post.mock.calls[1][2].headers['X-Action-Source']).toBe('cycle-count.manage.groups')
    expect(mocks.delete.mock.calls[0][1].headers).toEqual(expect.objectContaining({
      'X-Action-Type': 'delete',
      'X-Action-Message': 'Cycle Count group deletion requested for Beverages',
    }))
  })

  it('keeps shared consumers on the same resource API with their own purpose', async () => {
    await cycleCountService.lookupItem('001234', 'Rankin')
    await cycleCountService.searchItemsForWriteOff('Rankin', 'chips')
    await cycleCountService.getDashboardDailyCounts('Rankin', '2026-10-01', '2026-10-29')

    expect(mocks.get.mock.calls[0][1].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'cycleCount.lookup',
      'X-Action-Source': 'order-rec.scan',
    }))
    expect(mocks.get.mock.calls[1][1].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'writeOff.create',
      'X-Action-Source': 'write-off.create',
    }))
    expect(mocks.get.mock.calls[2][1].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'dashboard',
      'X-Action-Source': 'dashboard.cycle-count',
    }))
  })

  it('sends bulk schedule removals in the DELETE body', async () => {
    await cycleCountService.removeScheduleItems(18, [101, 102])

    expect(mocks.delete).toHaveBeenCalledWith('/cycle-count/schedules/details/18/items', expect.objectContaining({
      data: { productIds: [101, 102] },
      headers: expect.objectContaining({
        'X-Action-Type': 'delete',
        'X-Action-Source': 'cycle-count.manage.schedule',
      }),
    }))
  })
})
