import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveCachedArCustomers, getCachedArCustomers } from '../arCustomersCache'

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
