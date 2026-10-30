import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockListLocations } = vi.hoisted(() => ({
  mockListLocations: vi.fn(),
}))

vi.mock('@/api/locations/locations.api', () => ({
  locationsApi: { list: mockListLocations },
}))

import { saveCachedLocations, getCachedLocations, prefetchLocations } from '../locationsCache'

const sampleLocations = [
  { _id: '1', stationName: 'Rankin', csoCode: '001', timezone: 'America/Toronto' },
  { _id: '2', stationName: 'Sarnia', csoCode: '002', timezone: 'America/Toronto' },
]

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  mockListLocations.mockReset()
})

// ─── saveCachedLocations / getCachedLocations ─────────────────────────────────

describe('saveCachedLocations / getCachedLocations', () => {
  it('round-trips a saved list', () => {
    saveCachedLocations(sampleLocations)
    expect(getCachedLocations()).toEqual(sampleLocations)
  })

  it('returns an empty array when nothing has ever been cached', () => {
    expect(getCachedLocations()).toEqual([])
  })

  it('returns an empty array for corrupted JSON instead of throwing', () => {
    localStorage.setItem('cachedLocations', '{not valid json')
    expect(getCachedLocations()).toEqual([])
  })

  it('returns an empty array if the cached value is not an array', () => {
    localStorage.setItem('cachedLocations', JSON.stringify({ not: 'an array' }))
    expect(getCachedLocations()).toEqual([])
  })

  it('overwrites the previous cache on each save', () => {
    saveCachedLocations([sampleLocations[0]])
    saveCachedLocations(sampleLocations)
    expect(getCachedLocations()).toEqual(sampleLocations)
  })
})

// ─── prefetchLocations ─────────────────────────────────────────────────────────

describe('prefetchLocations', () => {
  it('caches the response body on a successful API request', async () => {
    mockListLocations.mockResolvedValue(sampleLocations)

    prefetchLocations()
    // API promise + .then chain resolve on microtasks — flush them
    await new Promise((r) => setTimeout(r, 0))

    expect(getCachedLocations()).toEqual(sampleLocations)
  })

  it('leaves any existing cache untouched when the fetch fails (offline)', async () => {
    saveCachedLocations(sampleLocations)
    mockListLocations.mockRejectedValue(new Error('Network Error'))

    prefetchLocations()
    await new Promise((r) => setTimeout(r, 0))

    expect(getCachedLocations()).toEqual(sampleLocations)
  })

  it('does not throw when the API request fails', async () => {
    mockListLocations.mockRejectedValue(new Error('Request failed'))

    expect(() => prefetchLocations()).not.toThrow()
    await new Promise((r) => setTimeout(r, 0))
  })

  // Regression coverage: without a bounded signal, a fetch to a host that's
  // reachable at the network layer but not actually online (dead router,
  // captive portal) can hang indefinitely instead of failing, so this
  // fire-and-forget prefetch would never get around to warming the cache at
  // all for that session.
  it('bounds the request with an abort signal, so a hung connection cannot block this indefinitely', async () => {
    mockListLocations.mockResolvedValue([])

    prefetchLocations()

    expect(mockListLocations).toHaveBeenCalledWith(expect.objectContaining({
      auth: false,
      signal: expect.any(AbortSignal),
    }))
    await new Promise((r) => setTimeout(r, 0))
  })

  it('deduplicates overlapping shell and StrictMode prefetches', async () => {
    let resolveRequest!: (value: typeof sampleLocations) => void
    mockListLocations.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve
    }))

    prefetchLocations()
    prefetchLocations()

    expect(mockListLocations).toHaveBeenCalledTimes(1)
    resolveRequest(sampleLocations)
    await new Promise((r) => setTimeout(r, 0))
  })
})
