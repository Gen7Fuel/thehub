import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { location: 'Rankin', access: { site_access: { Rankin: true } } } }),
}))

vi.mock('@/context/SiteContext', () => ({
  useSite: () => ({ selectedSite: '', setSelectedSite: vi.fn() }),
}))

import { SitePicker } from '../sitePicker'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

// Regression coverage: SitePicker used to start with empty locations and
// loading=true unconditionally, only consulting the offline cache inside the
// fetch's catch block. A fetch to a host that's reachable but not actually
// online (dead router, captive portal — realistic on a tablet's Wi-Fi, unlike
// a clean disconnect) could hang indefinitely without ever reaching that
// catch block, leaving the picker stuck on "Loading locations..." forever
// even with a warm cache sitting right there in localStorage. Seeding initial
// state from the cache means the picker never depends on the live fetch
// settling at all — the "Loading locations..." placeholder (rendered
// unconditionally in the closed trigger, unlike the actual option list which
// is Radix-portal-mounted and only present once opened) is the reliable
// signal that this seeding worked.
describe('SitePicker — offline cache seeding', () => {
  it('does not show the loading placeholder when a cache already exists, even if the live fetch never resolves', () => {
    localStorage.setItem('cachedLocations', JSON.stringify([{ _id: '1', stationName: 'Rankin' }]))
    // A fetch that never resolves — simulates a hung request (dead
    // router/captive portal) rather than one that fails fast.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    render(<SitePicker />)

    expect(screen.queryByText('Loading locations...')).not.toBeInTheDocument()
  })

  it('shows the loading placeholder when there is no cache yet and the fetch is still pending', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    render(<SitePicker />)

    expect(screen.getByText('Loading locations...')).toBeInTheDocument()
  })

  it('updates the cache and clears the loading placeholder once the live fetch succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ _id: '2', stationName: 'Sarnia' }]),
    }))

    render(<SitePicker />)
    expect(screen.getByText('Loading locations...')).toBeInTheDocument()

    await waitFor(() => expect(screen.queryByText('Loading locations...')).not.toBeInTheDocument())
    expect(JSON.parse(localStorage.getItem('cachedLocations') || 'null')).toEqual([{ _id: '2', stationName: 'Sarnia' }])
  })

  it('bounds the fetch with an abort signal, so a hung connection eventually gives up', () => {
    const fetchSpy = vi.fn(() => new Promise(() => {}))
    vi.stubGlobal('fetch', fetchSpy)

    render(<SitePicker />)

    expect(fetchSpy).toHaveBeenCalledWith('/api/locations', expect.objectContaining({
      signal: expect.any(AbortSignal),
    }))
  })
})
