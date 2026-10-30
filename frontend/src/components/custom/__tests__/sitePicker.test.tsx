import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const { mockListLocations } = vi.hoisted(() => ({ mockListLocations: vi.fn() }))

vi.mock('@/api/locations/locations.api', () => ({
  locationsApi: { list: mockListLocations },
}))

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
  mockListLocations.mockReset()
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
    mockListLocations.mockReturnValue(new Promise(() => {}))

    render(<SitePicker />)

    expect(screen.queryByText('Loading locations...')).not.toBeInTheDocument()
  })

  it('shows the loading placeholder when there is no cache yet and the fetch is still pending', () => {
    mockListLocations.mockReturnValue(new Promise(() => {}))

    render(<SitePicker />)

    expect(screen.getByText('Loading locations...')).toBeInTheDocument()
  })

  it('updates the cache and clears the loading placeholder once the live fetch succeeds', async () => {
    mockListLocations.mockResolvedValue([{ _id: '2', stationName: 'Sarnia' }])

    render(<SitePicker />)
    expect(screen.getByText('Loading locations...')).toBeInTheDocument()

    await waitFor(() => expect(screen.queryByText('Loading locations...')).not.toBeInTheDocument())
    expect(JSON.parse(localStorage.getItem('cachedLocations') || 'null')).toEqual([{ _id: '2', stationName: 'Sarnia' }])
  })

  it('bounds the fetch with an abort signal, so a hung connection eventually gives up', () => {
    mockListLocations.mockReturnValue(new Promise(() => {}))

    render(<SitePicker />)

    expect(mockListLocations).toHaveBeenCalledWith(expect.objectContaining({
      signal: expect.any(AbortSignal),
    }))
  })
})
