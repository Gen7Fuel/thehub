import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveCachedLocations, getCachedLocations, prefetchLocations } from '../locationsCache'

const sampleLocations = [
  { _id: '1', stationName: 'Rankin', csoCode: '001', timezone: 'America/Toronto' },
  { _id: '2', stationName: 'Sarnia', csoCode: '002', timezone: 'America/Toronto' },
]

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
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
  it('caches the response body on a successful fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleLocations),
    }))

    prefetchLocations()
    // fetch + .then chain resolve on microtasks — flush them
    await new Promise((r) => setTimeout(r, 0))

    expect(getCachedLocations()).toEqual(sampleLocations)
  })

  it('leaves any existing cache untouched when the fetch fails (offline)', async () => {
    saveCachedLocations(sampleLocations)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network Error')))

    prefetchLocations()
    await new Promise((r) => setTimeout(r, 0))

    expect(getCachedLocations()).toEqual(sampleLocations)
  })

  it('does not throw when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    expect(() => prefetchLocations()).not.toThrow()
    await new Promise((r) => setTimeout(r, 0))
  })
})
