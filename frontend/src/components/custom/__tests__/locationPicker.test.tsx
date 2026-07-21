import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockAxiosGet } = vi.hoisted(() => ({ mockAxiosGet: vi.fn() }))

vi.mock('axios', () => ({
  default: { get: mockAxiosGet },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { location: 'Rankin', access: { site_access: { Rankin: true } } } }),
}))

vi.mock('@/context/SiteContext', () => ({
  useSite: () => ({ selectedSite: '', setSelectedSite: vi.fn() }),
}))

import { LocationPicker } from '../locationPicker'

const renderPicker = (queryClient: QueryClient) =>
  render(
    <QueryClientProvider client={queryClient}>
      <LocationPicker setStationName={vi.fn()} value="stationName" />
    </QueryClientProvider>
  )

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

// Regression coverage: fetchLocations used to catch a failed request and
// always return getCachedLocations() — including an empty array when
// nothing had ever been cached. React Query then treated that empty array
// as a genuine success and froze it as "fresh" for the app's global 5-minute
// staleTime, silently blocking every retry mechanism (remount, reconnect,
// window refocus) until that window expired. This is exactly why a fresh
// offline load could get permanently stuck on "No stations available" even
// after connectivity returned, while `arCustomers` (plain useEffect, no
// staleTime) kept working — see the fix in locationPicker.tsx.
describe('LocationPicker — offline query caching', () => {
  it('surfaces a real error (not a frozen empty success) when the fetch fails and nothing is cached yet', async () => {
    mockAxiosGet.mockRejectedValue(new Error('Network Error'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    renderPicker(queryClient)

    await waitFor(() => {
      const state = queryClient.getQueryState(['locations'])
      expect(state?.status).toBe('error')
    })
  })

  it('succeeds with the cached list when the fetch fails but a previous fetch had populated the cache', async () => {
    const cached = [{ _id: '1', stationName: 'Rankin', csoCode: '001', timezone: 'America/Toronto' }]
    localStorage.setItem('cachedLocations', JSON.stringify(cached))
    mockAxiosGet.mockRejectedValue(new Error('Network Error'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    renderPicker(queryClient)

    await waitFor(() => {
      const state = queryClient.getQueryState(['locations'])
      expect(state?.status).toBe('success')
      expect(state?.data).toEqual(cached)
    })
  })

  it('succeeds and caches the response on a normal successful fetch', async () => {
    const fetched = [{ _id: '2', stationName: 'Sarnia', csoCode: '002', timezone: 'America/Toronto' }]
    mockAxiosGet.mockResolvedValue({ data: fetched })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    renderPicker(queryClient)

    await waitFor(() => {
      const state = queryClient.getQueryState(['locations'])
      expect(state?.status).toBe('success')
    })
    expect(JSON.parse(localStorage.getItem('cachedLocations') || 'null')).toEqual(fetched)
  })

  // Regression coverage: even with the error-vs-success fix above, the query
  // still started as `undefined`/isPending until fetchLocations() settled —
  // fine for a fetch that fails fast, but a fetch to a host that's reachable
  // at the network layer but not actually online (dead router, captive
  // portal) can hang far longer than a user will wait, with nothing to show
  // in the meantime despite a warm cache sitting right there. `initialData`
  // means the query has cached data synchronously on the very first render,
  // independent of whether/when the live fetch ever settles.
  it('has the cached data available immediately, synchronously on first render, even while the live fetch is still hung', () => {
    const cached = [{ _id: '3', stationName: 'Walpole', csoCode: '003', timezone: 'America/Toronto' }]
    localStorage.setItem('cachedLocations', JSON.stringify(cached))
    mockAxiosGet.mockReturnValue(new Promise(() => {})) // never resolves — simulates a hung request
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    renderPicker(queryClient)

    // No waitFor — this must be true immediately, before any microtask runs.
    const state = queryClient.getQueryState(['locations'])
    expect(state?.status).toBe('success')
    expect(state?.data).toEqual(cached)
    // Still marked stale (not trusted for the full 5-minute staleTime), so a
    // real background refetch attempt still happens.
    expect(state?.dataUpdatedAt).toBe(0)
  })
})
