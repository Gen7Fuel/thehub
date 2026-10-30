import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }))
vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { purchaseOrdersService } from '../purchase-orders.service'

describe('Purchase Orders API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.values(mocks).forEach((mock) => mock.mockResolvedValue({ data: {} }))
  })

  it('annotates list reads with site and date-range purpose', async () => {
    await purchaseOrdersService.list({ stationName: 'Rankin', startDate: '2026-10-01', endDate: '2026-10-30' })
    expect(mocks.get).toHaveBeenCalledWith('/purchase-orders', expect.objectContaining({
      params: { stationName: 'Rankin', startDate: '2026-10-01', endDate: '2026-10-30' },
      headers: expect.objectContaining({
        'X-Required-Permission': 'po',
        'X-Action-Source': 'po.list',
        'X-Action-Message': 'Purchase orders viewed for Rankin from 2026-10-01 to 2026-10-30',
      }),
    }))
  })

  it('uses readable online/offline mutation headers and the delete permission', async () => {
    const input = { stationName: 'Rankin', poNumber: '12345', customerName: 'Customer A', date: '2026-10-30' }
    await purchaseOrdersService.create(input, 'po.offline-sync')
    await purchaseOrdersService.remove({ _id: 'po-1', ...input })
    expect(mocks.post.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Action-Type': 'create', 'X-Action-Source': 'po.offline-sync',
      'X-Action-Message': expect.stringContaining('PO #12345'),
    }))
    expect(mocks.delete.mock.calls[0][1].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'po.delete', 'X-Action-Type': 'delete', 'X-Action-Source': 'po.list',
    }))
  })

  it('prevents PO pages and offline replay from reintroducing direct PO endpoints', () => {
    const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
    for (const relative of ['routes/_navbarLayout/po/index.tsx', 'routes/_navbarLayout/po/list.tsx', 'routes/_navbarLayout/po/signature.tsx', 'lib/utils.ts']) {
      const source = fs.readFileSync(path.join(src, relative), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(source).not.toMatch(/["'`]\/api\/purchase-orders/)
    }
  })
})
