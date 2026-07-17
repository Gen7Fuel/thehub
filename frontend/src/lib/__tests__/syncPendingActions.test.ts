import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockAxiosPost,
  mockGetPendingActionEntries,
  mockDeletePendingAction,
  mockUpdatePendingAction,
  mockSaveOrderRec,
  mockIsActuallyOnline,
} = vi.hoisted(() => ({
  mockAxiosPost: vi.fn(),
  mockGetPendingActionEntries: vi.fn(),
  mockDeletePendingAction: vi.fn().mockResolvedValue(undefined),
  mockUpdatePendingAction: vi.fn().mockResolvedValue(undefined),
  mockSaveOrderRec: vi.fn().mockResolvedValue(undefined),
  mockIsActuallyOnline: vi.fn().mockResolvedValue(true),
}))

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: mockAxiosPost,
    put: vi.fn(),
    patch: vi.fn(),
    isAxiosError: (err: any) => !!(err && err.isAxiosErr),
  },
  isAxiosError: (err: any) => !!(err && err.isAxiosErr),
}))

vi.mock('@/lib/orderRecIndexedDB', () => ({
  getPendingActionEntries: mockGetPendingActionEntries,
  deletePendingAction: mockDeletePendingAction,
  updatePendingAction: mockUpdatePendingAction,
  saveOrderRec: mockSaveOrderRec,
}))

vi.mock('@/lib/network', () => ({
  isActuallyOnline: mockIsActuallyOnline,
}))

import { syncPendingActions, triggerBackgroundSync } from '../utils'

const poAction = (overrides: Record<string, any> = {}) => ({
  type: 'CREATE_PURCHASE_ORDER',
  receipt: 'data:image/png;base64,abc',
  payload: { source: 'PO', customerName: 'Jane Doe', date: '2026-01-01', stationName: 'Rankin' },
  queuedAt: 1,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockIsActuallyOnline.mockResolvedValue(true)
  // Default: both the receipt upload and the PO create succeed.
  mockAxiosPost.mockImplementation((url: string) => {
    if (url.includes('upload-base64')) return Promise.resolve({ data: { filename: 'uploaded.jpg' } })
    return Promise.resolve({ status: 201, data: { _id: 'txn-1' } })
  })
})

describe('syncPendingActions — per-key delete, no blanket clear', () => {
  it('deletes a successfully-synced action individually by its key', async () => {
    mockGetPendingActionEntries
      .mockResolvedValueOnce([{ key: 1, action: poAction() }])
      .mockResolvedValueOnce([]) // next pass: nothing left, loop terminates

    await syncPendingActions()

    expect(mockAxiosPost).toHaveBeenCalledWith(
      '/api/purchase-orders',
      expect.objectContaining({ receipt: 'uploaded.jpg' }),
      expect.any(Object)
    )
    expect(mockDeletePendingAction).toHaveBeenCalledWith(1)
    expect(mockDeletePendingAction).toHaveBeenCalledTimes(1)
  })

  it('picks up an action added concurrently during a sync pass instead of losing it', async () => {
    // Simulates: item 1 exists at the start; item 2 gets queued by other
    // code (e.g. a second PO submitted) while item 1 is being processed.
    // A fresh read each pass means item 2 is picked up on the next pass
    // instead of being wiped by a blanket clear-the-whole-store call.
    mockGetPendingActionEntries
      .mockResolvedValueOnce([{ key: 1, action: poAction() }])
      .mockResolvedValueOnce([{ key: 2, action: poAction({ payload: { ...poAction().payload, customerName: 'Second' } }) }])
      .mockResolvedValueOnce([])

    await syncPendingActions()

    expect(mockDeletePendingAction).toHaveBeenCalledWith(1)
    expect(mockDeletePendingAction).toHaveBeenCalledWith(2)
    expect(mockAxiosPost.mock.calls.filter(([url]) => url === '/api/purchase-orders')).toHaveLength(2)
  })
})

describe('syncPendingActions — retryable vs. permanent failure classification', () => {
  it('marks a 403 (permission denied) as permanently failed and does not retry it on a later call', async () => {
    const err403 = Object.assign(new Error('Forbidden'), {
      isAxiosErr: true,
      response: { status: 403, data: { message: 'Permission denied' } },
    })
    mockAxiosPost.mockImplementation((url: string) => {
      if (url.includes('upload-base64')) return Promise.resolve({ data: { filename: 'uploaded.jpg' } })
      return Promise.reject(err403)
    })
    mockGetPendingActionEntries
      .mockResolvedValueOnce([{ key: 5, action: poAction() }])
      .mockResolvedValueOnce([]) // failed entries are excluded from "actionable" on the next pass

    await syncPendingActions()

    expect(mockUpdatePendingAction).toHaveBeenCalledWith(5, expect.objectContaining({
      failed: true,
      failureReason: 'Permission denied',
    }))
    expect(mockDeletePendingAction).not.toHaveBeenCalled()

    // A later call sees the entry already marked failed — it must be
    // excluded from "actionable" and never retried.
    mockGetPendingActionEntries.mockReset()
    mockGetPendingActionEntries.mockResolvedValue([{ key: 5, action: poAction({ failed: true }) }])
    mockAxiosPost.mockClear()

    await syncPendingActions()

    expect(mockAxiosPost).not.toHaveBeenCalledWith('/api/purchase-orders', expect.any(Object), expect.any(Object))
  })

  it('marks a 409 (duplicate PO number) as permanently failed', async () => {
    const err409 = Object.assign(new Error('Conflict'), {
      isAxiosErr: true,
      response: { status: 409, data: { message: 'PO number already exists.' } },
    })
    mockAxiosPost.mockImplementation((url: string) => {
      if (url.includes('upload-base64')) return Promise.resolve({ data: { filename: 'uploaded.jpg' } })
      return Promise.reject(err409)
    })
    mockGetPendingActionEntries
      .mockResolvedValueOnce([{ key: 8, action: poAction() }])
      .mockResolvedValueOnce([])

    await syncPendingActions()

    expect(mockUpdatePendingAction).toHaveBeenCalledWith(8, expect.objectContaining({
      failed: true,
      failureReason: 'PO number already exists.',
    }))
  })

  it('leaves a network/timeout failure (no response at all) queued for retry', async () => {
    const networkErr = Object.assign(new Error('Network Error'), { isAxiosErr: true })
    mockAxiosPost.mockImplementation((url: string) => {
      if (url.includes('upload-base64')) return Promise.reject(networkErr)
      return Promise.resolve({ status: 201, data: {} })
    })
    mockGetPendingActionEntries.mockResolvedValue([{ key: 9, action: poAction() }])

    await syncPendingActions()

    expect(mockUpdatePendingAction).not.toHaveBeenCalled()
    expect(mockDeletePendingAction).not.toHaveBeenCalled()
  })

  it('leaves a 500 failure queued for retry, not marked permanently failed', async () => {
    const err500 = Object.assign(new Error('Server Error'), { isAxiosErr: true, response: { status: 500 } })
    mockAxiosPost.mockImplementation((url: string) => {
      if (url.includes('upload-base64')) return Promise.resolve({ data: { filename: 'uploaded.jpg' } })
      return Promise.reject(err500)
    })
    mockGetPendingActionEntries.mockResolvedValue([{ key: 3, action: poAction() }])

    await syncPendingActions()

    expect(mockUpdatePendingAction).not.toHaveBeenCalled()
    expect(mockDeletePendingAction).not.toHaveBeenCalled()
  })
})

describe('syncPendingActions — overlapping-call guard', () => {
  it('collapses a second concurrent call into a no-op instead of double-processing', async () => {
    let resolveEntries: (v: any) => void = () => {}
    const entriesPromise = new Promise((r) => { resolveEntries = r })
    mockGetPendingActionEntries.mockImplementation(() => entriesPromise)

    const p1 = syncPendingActions()
    const p2 = syncPendingActions() // should short-circuit immediately — syncInFlight is already true

    // p1's loop has its own internal 300ms delay before it calls
    // getPendingActionEntries() for the first time — wait for that to
    // actually happen before resolving, otherwise resolveEntries() would
    // still be the pre-assignment no-op and p1 would hang forever.
    await vi.waitFor(() => expect(mockGetPendingActionEntries).toHaveBeenCalled(), { timeout: 2000 })
    resolveEntries([])

    await Promise.all([p1, p2])

    expect(mockGetPendingActionEntries).toHaveBeenCalledTimes(1)
  }, 10000)
})

describe('triggerBackgroundSync', () => {
  it('does not attempt to sync when isActuallyOnline resolves false', async () => {
    mockIsActuallyOnline.mockResolvedValue(false)

    await triggerBackgroundSync()

    expect(mockGetPendingActionEntries).not.toHaveBeenCalled()
  })

  it('syncs when isActuallyOnline resolves true', async () => {
    mockIsActuallyOnline.mockResolvedValue(true)
    mockGetPendingActionEntries.mockResolvedValue([])

    await triggerBackgroundSync()

    expect(mockGetPendingActionEntries).toHaveBeenCalled()
  })
})
