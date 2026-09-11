import { describe, it, expect, beforeEach, vi } from 'vitest'
import { syncScheduledInstances } from '../cron_jobs/itemBkSanitizationCron.js'

describe('syncScheduledInstances Protocol', () => {
  let mockTrx
  const todayDateStr = '2026-09-11'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── 1. Item Removal Scenarios ──────────────────────────────────────────

  describe('Item Removal & Future Count Purging', () => {
    it('deletes soft-deleted items from future uncompleted instances', async () => {
      const removedCount = 3

      // Mock knex chain: trx('cycle_count_items').whereIn(...)...del()
      const delMock = vi.fn().mockResolvedValue(removedCount)
      const andWhereMock = vi.fn().mockReturnValue({ del: delMock })
      const whereInSecondMock = vi.fn().mockReturnValue({ andWhere: andWhereMock })
      const whereInFirstMock = vi.fn().mockReturnValue({ whereIn: whereInSecondMock })

      mockTrx = vi.fn().mockReturnValue({ whereIn: whereInFirstMock })

      const removedIds = [101, 102]
      await syncScheduledInstances(mockTrx, [], removedIds, todayDateStr)

      expect(mockTrx).toHaveBeenCalledWith('cycle_count_items')
      expect(whereInFirstMock).toHaveBeenCalledWith('product_id', removedIds)
      expect(delMock).toHaveBeenCalled()
    })

    it('skips deletion logic when removedItemIds array is empty', async () => {
      mockTrx = vi.fn()
      await syncScheduledInstances(mockTrx, [], [], todayDateStr)
      expect(mockTrx).not.toHaveBeenCalled()
    })
  })

  // ─── 2. Item Addition & Group Sync Scenarios ────────────────────────────

  describe('New Item Synchronization against Scheduled Instances', () => {
    it('attaches newly added items to future instances matching group filter criteria', async () => {
      const newlyInsertedItems = [
        { id: 501, site: 'SITE_A', category_id: 10, department_id: 'DEP_1' },
        { id: 502, site: 'SITE_A', category_id: 20, department_id: 'DEP_2' }, // Won't match filter
      ]

      const mockFutureInstances = [
        {
          instance_id: 1,
          site_mongo_id: 'SITE_A',
          group_id: 99,
          filter_column: 'category_id',
        },
      ]

      const mockGroupValues = [
        { group_id: 99, value: '10' }, // Only category_id = 10 qualifies
      ]

      // Setup Knex query responses for the sequential calls inside the helper
      const ignoreMock = vi.fn().mockResolvedValue(true)
      const onConflictMock = vi.fn().mockReturnValue({ ignore: ignoreMock })
      const insertMock = vi.fn().mockReturnValue({ onConflict: onConflictMock })

      mockTrx = vi.fn((tableName) => {
        if (tableName === 'cycle_count_instance as cci') {
          return {
            join: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            whereIn: vi.fn().mockReturnThis(),
            whereNotNull: vi.fn().mockReturnThis(),
            select: vi.fn().mockResolvedValue(mockFutureInstances),
          }
        }
        if (tableName === 'cycle_count_group_values') {
          return {
            whereIn: vi.fn().mockReturnThis(),
            select: vi.fn().mockResolvedValue(mockGroupValues),
          }
        }
        if (tableName === 'cycle_count_items') {
          return { insert: insertMock }
        }
        return {}
      })

      await syncScheduledInstances(mockTrx, newlyInsertedItems, [], todayDateStr)

      // Verify that ONLY item 501 (category_id = 10) was scheduled for instance 1
      expect(insertMock).toHaveBeenCalledWith([
        {
          instance_id: 1,
          product_id: 501,
          foh: null,
          boh: null,
          count_completed: false,
          priority: false,
        },
      ])
      expect(onConflictMock).toHaveBeenCalledWith(['instance_id', 'product_id'])
      expect(ignoreMock).toHaveBeenCalled()
    })

    it('does nothing if no future scheduled instances exist for the updated sites', async () => {
      const newlyInsertedItems = [{ id: 501, site: 'SITE_B', category_id: 10 }]

      mockTrx = vi.fn((tableName) => {
        if (tableName === 'cycle_count_instance as cci') {
          return {
            join: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            whereIn: vi.fn().mockReturnThis(),
            whereNotNull: vi.fn().mockReturnThis(),
            select: vi.fn().mockResolvedValue([]), // No future instances
          }
        }
        return {}
      })

      await syncScheduledInstances(mockTrx, newlyInsertedItems, [], todayDateStr)

      // Expect no calls to cycle_count_items
      expect(mockTrx).not.toHaveBeenCalledWith('cycle_count_items')
    })
  })
})