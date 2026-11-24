import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { addDays, format } from 'date-fns'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Route } from '../workspace'

const { getStationProjection, listWorkspace } = vi.hoisted(() => ({
  getStationProjection: vi.fn(async () => ({ tanks: [] })),
  listWorkspace: vi.fn(async () => []),
}))

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@/api/fuel-management/fuel-grades.service', () => ({
  fuelGradeOptionsQuery: { queryKey: ['fuel-grades', 'options'], queryFn: async () => [] },
}))
vi.mock('@/api/fuel-management/fuel-racks.service', () => ({
  fuelRacksService: { list: async () => [] },
}))
vi.mock('@/api/fuel-management/fuel-station-tanks.service', () => ({
  fuelStationTanksService: {
    listLocations: async () => [{
      _id: 'station-1', stationName: 'Station One', tankCount: 1, timezone: 'America/Toronto',
    }],
    getStationProjection,
  },
}))
vi.mock('@/api/fuel-management/fuel-orders.service', () => ({
  buildFuelOrderAccessGroupId: () => 'test-group',
  fuelOrdersService: { listWorkspace },
}))

const rootRoute = createRootRoute()
const layout = createRoute({ id: '_navbarLayout', getParentRoute: () => rootRoute })
const workspace = Route.update({
  id: '/fuel-management/workspace',
  path: '/fuel-management/workspace',
  getParentRoute: () => layout,
} as Parameters<typeof Route.update>[0])
const routeTree = rootRoute.addChildren([layout.addChildren([workspace])])

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

function renderWorkspace(url: string) {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [url] }) })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    router,
    ...render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>),
  }
}

it('writes the selected date to the URL and reloads that date for tanks and orders', async () => {
  const start = format(addDays(new Date(), -10), 'yyyy-MM-dd')
  const selected = format(addDays(new Date(), -11), 'yyyy-MM-dd')
  const view = renderWorkspace(`/fuel-management/workspace?date=${start}`)
  fireEvent.click(await screen.findByRole('button', { name: 'Previous day' }))
  await waitFor(() => expect(view.router.state.location.searchStr).toBe(`?date=${selected}`))
  const url = view.router.state.location.href
  view.unmount()

  getStationProjection.mockClear()
  listWorkspace.mockClear()
  renderWorkspace(url)
  await waitFor(() => {
    expect(getStationProjection.mock.calls.map(call => call.slice(0, 2))).toContainEqual(['station-1', selected])
    expect(listWorkspace.mock.calls.map(call => call.slice(0, 2))).toContainEqual(['station-1', selected])
  })
})

it('falls back to today when the URL has an invalid calendar date', async () => {
  getStationProjection.mockClear()
  renderWorkspace('/fuel-management/workspace?date=2026-02-30')
  await waitFor(() => {
    expect(getStationProjection.mock.calls.map(call => call.slice(0, 2)))
      .toContainEqual(['station-1', format(new Date(), 'yyyy-MM-dd')])
  })
})
