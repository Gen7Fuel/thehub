import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveCachedArCustomers, getCachedArCustomers, prefetchArCustomers } from '../arCustomersCache'

const sampleCustomers = [
  { _id: '1', name: 'Acme Trucking' },
  { _id: '2', name: 'Three fires development corporation' },
]

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

// ─── saveCachedArCustomers / getCachedArCustomers ─────────────────────────────

describe('saveCachedArCustomers / getCachedArCustomers', () => {
  it('round-trips a saved list', () => {
    saveCachedArCustomers(sampleCustomers)
    expect(getCachedArCustomers()).toEqual(sampleCustomers)
  })

  it('returns an empty array when nothing has ever been cached', () => {
    expect(getCachedArCustomers()).toEqual([])
  })

  it('returns an empty array for corrupted JSON instead of throwing', () => {
    localStorage.setItem('po_cachedArCustomers', '{not valid json')
    expect(getCachedArCustomers()).toEqual([])
  })

  it('returns an empty array if the cached value is not an array', () => {
    localStorage.setItem('po_cachedArCustomers', JSON.stringify({ not: 'an array' }))
    expect(getCachedArCustomers()).toEqual([])
  })
})

// ─── prefetchArCustomers ────────────────────────────────────────────────────────

describe('prefetchArCustomers', () => {
  it('does nothing when there is no auth token yet (pre-login)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    prefetchArCustomers()
    await new Promise((r) => setTimeout(r, 0))

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(getCachedArCustomers()).toEqual([])
  })

  it('caches the response body on a successful fetch once logged in', async () => {
    localStorage.setItem('token', 'test-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleCustomers),
    }))

    prefetchArCustomers()
    await new Promise((r) => setTimeout(r, 0))

    expect(getCachedArCustomers()).toEqual(sampleCustomers)
  })

  it('leaves any existing cache untouched when the fetch fails (offline)', async () => {
    localStorage.setItem('token', 'test-token')
    saveCachedArCustomers(sampleCustomers)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network Error')))

    prefetchArCustomers()
    await new Promise((r) => setTimeout(r, 0))

    expect(getCachedArCustomers()).toEqual(sampleCustomers)
  })
})
