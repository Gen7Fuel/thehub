import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { writeOffService } from '../write-off.service'

describe('writeOffService request metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockResolvedValue({ data: [] })
    mocks.post.mockResolvedValue({ data: { items: [], lists: [] } })
    mocks.put.mockResolvedValue({ data: { items: [] } })
    mocks.patch.mockResolvedValue({ data: { items: [] } })
    mocks.delete.mockResolvedValue({ data: { items: [] } })
  })

  it('annotates draft reads and mutations with the create purpose', async () => {
    await writeOffService.getWorkList('Rankin')
    await writeOffService.addWorkListItem('Rankin', { name: 'Milk', upc_barcode: '123', qty: 1 })
    await writeOffService.updateWorkListItem('Rankin', 'cart-item-1', 'qty', 2)
    await writeOffService.removeWorkListItem('Rankin', 'cart-item-1')
    await writeOffService.clearWorkList('Rankin')

    expect(mocks.get.mock.calls[0][1].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'writeOff.create',
      'X-Action-Source': 'write-off.create',
      'X-Action-Message': 'Write-off draft list viewed for Rankin',
    }))
    expect(mocks.post.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Action-Type': 'create',
      'X-Action-Resource': 'write-off-cart-item',
    }))
    expect(mocks.put.mock.calls[0][2].headers['X-Action-Type']).toBe('update')
    expect(mocks.delete.mock.calls[0][1].headers['X-Action-Type']).toBe('delete')
  })

  it('describes request review and detail mutations', async () => {
    await writeOffService.list('Rankin', 'WO', '2026-10-01', '2026-10-31')
    await writeOffService.get('write-off-1')
    await writeOffService.addComment('write-off-1', 'item-1', { initials: 'DJ', author: 'Daksh', text: 'Checked' })
    await writeOffService.updateItemDetails('write-off-1', 'item-1', { qty: 2, reason: 'Damaged' })
    await writeOffService.updateItemCompleted('write-off-1', 'item-1', true)
    await writeOffService.finalize('write-off-1', 'WO')
    await writeOffService.updateMissingUpc('write-off-1', 'item-1', '999')
    await writeOffService.resubmitMissing('write-off-1')

    expect(mocks.get.mock.calls[0][1].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'writeOff.requests',
      'X-Action-Source': 'write-off.requests',
      'X-Action-Message': 'Write-off WO requests viewed for Rankin from 2026-10-01 to 2026-10-31',
    }))
    expect(mocks.post.mock.calls[0][2].headers['X-Action-Source']).toBe('write-off.detail')
    expect(mocks.patch.mock.calls[2][2].headers).toEqual(expect.objectContaining({
      'X-Action-Type': 'approve',
      'X-Required-Permission': 'writeOff.requests',
    }))
    expect(mocks.patch.mock.calls[3][2].headers['X-Required-Permission']).toBe('writeOff.requests.list.updateMissingItemsUpc')
    expect(mocks.patch.mock.calls[4][2].headers['X-Required-Permission']).toBe('writeOff.requests.list.pushMissingItems')
  })
})
