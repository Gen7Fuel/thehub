import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const { mockNavigate, mockUseLoaderData, mockUseSearch, mockUseAuth, mockUseSite, mockUseQuery } = vi.hoisted(() => {
  const mockUseAuth = vi.fn().mockReturnValue({
    user: { id: 'user-1', location: 'Rankin' },
  })

  return {
    mockNavigate: vi.fn(),
    mockUseLoaderData: vi.fn().mockReturnValue({}),
    mockUseSearch: vi.fn().mockReturnValue({ site: 'Rankin', category: '' }),
    mockUseAuth,
    mockUseSite: vi.fn().mockReturnValue({ selectedSite: 'Rankin', setSelectedSite: vi.fn() }),
    mockUseQuery: vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      isSuccess: false,
      isFetching: false,
      refetch: vi.fn(),
    }),
  }
})

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (config: any) => ({
      ...config,
      fullPath: '/_navbarLayout/cycle-count',
      useLoaderData: mockUseLoaderData,
      useSearch: mockUseSearch,
    }),
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/cycle-count/manage/schedule' }),
    Link: ({ to, children }: any) => <a href={to}>{children}</a>,
  }
})

vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/context/SiteContext', () => ({
  useSite: () => mockUseSite(),
}))

vi.mock('@/lib/websocket', () => ({
  getSocket: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    id: 'mock-socket-id',
  }),
}))

vi.mock('@/lib/constants', () => ({
  domain: 'http://localhost:5000',
}))

vi.mock('@/components/custom/locationPicker', () => ({
  LocationPicker: ({ setStationName }: any) => (
    <button data-testid="location-picker" onClick={() => setStationName('TestSite')}>
      Location
    </button>
  ),
}))

vi.mock('@/components/custom/datePicker', () => ({
  DatePicker: () => <button data-testid="date-picker">Date</button>,
}))

vi.mock('@/components/custom/sitePicker', () => ({
  SitePicker: ({ onValueChange }: any) => (
    <button data-testid="site-picker" onClick={() => onValueChange('Rankin')}>
      Site
    </button>
  ),
}))

vi.mock('@/components/custom/CycleCountTableGroup', () => ({
  default: ({ items }: any) => (
    <div data-testid="cycle-count-table-group">
      {items.map((item: any) => (
        <div key={item.entryId || item._id || item.id}>{item.name}</div>
      ))}
    </div>
  ),
}))

vi.mock('@/components/custom/TableWithInputs', () => ({
  default: ({ items }: any) => (
    <div data-testid="table-with-inputs">
      {items.map((item: any) => (
        <div key={item._id}>{item.name}</div>
      ))}
    </div>
  ),
}))

vi.mock('@/components/custom/PasswordProtection', () => ({
  PasswordProtection: ({ isOpen, onSuccess }: any) =>
    isOpen ? (
      <div data-testid="password-dialog">
        Password Required
        <button onClick={onSuccess}>Unlock</button>
      </div>
    ) : null,
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => mockUseQuery(options),
  useMutation: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  }),
  useQueryClient: vi.fn().mockReturnValue({
    prefetchQuery: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
}))

vi.mock('@/queries/inventory', () => ({
  inventoryQueries: {
    partial: vi.fn((site: string) => ({ queryKey: ['inventory', 'partial', site], queryFn: vi.fn() })),
    full: vi.fn((site: string) => ({ queryKey: ['inventory', 'full', site], queryFn: vi.fn() })),
    categories: vi.fn((site: string) => ({ queryKey: ['inventory', 'categories', site], queryFn: vi.fn() })),
  },
}))

vi.mock('react-barcode', () => ({
  default: () => <svg data-testid="barcode" />,
}))

vi.mock('xlsx', () => ({
  utils: { json_to_sheet: vi.fn(), book_new: vi.fn(), book_append_sheet: vi.fn() },
  writeFile: vi.fn(),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: any) => open ? <>{children}</> : null,
  DialogContent: ({ children }: any) => <div data-testid="mock-dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}))

import { Route as IndexRoute } from '../cycle-count/index'
import { Route as ReportRoute } from '../cycle-count/report'
import { Route as InventoryRoute } from '../cycle-count/inventory'
import { Route as GroupNewRoute } from '../cycle-count/manage/group/new'
import { Route as ScheduleNewRoute } from '../cycle-count/manage/schedule/new'
import { Route as ItemBkRoute } from '../cycle-count/manage/item-bk'

const renderWithSuspense = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <React.Suspense fallback={null}>{children}</React.Suspense>
    ),
  })

const getRouteComponent = (route: any) => (route.component || route.options?.component) as React.ComponentType

const CycleCountIndex = getRouteComponent(IndexRoute)
const ReportPage = getRouteComponent(ReportRoute)
const InventoryPage = getRouteComponent(InventoryRoute)
const GroupNewPage = getRouteComponent(GroupNewRoute)
const ScheduleNewPage = getRouteComponent(ScheduleNewRoute)
const ItemBkPage = getRouteComponent(ItemBkRoute)

const makeOkFetch = (data: any) =>
  vi.fn().mockResolvedValue({ status: 200, ok: true, json: () => Promise.resolve(data) })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('token', 'test-token')
  sessionStorage.clear()
  mockUseAuth.mockReturnValue({ user: { id: 'user-1', location: 'Rankin' } })
  mockUseSite.mockReturnValue({ selectedSite: 'Rankin', setSelectedSite: vi.fn() })
  mockUseQuery.mockReturnValue({
    data: undefined,
    isLoading: false,
    isSuccess: false,
    isFetching: false,
    refetch: vi.fn(),
  })
  global.fetch = makeOkFetch({ items: [] })
})

describe('Cycle Count Index - active count page', () => {
  it('renders the new count page instead of redirecting', async () => {
    renderWithSuspense(<CycleCountIndex />)

    await waitFor(() => expect(screen.getByText(/cycle count/i)).toBeInTheDocument())
    expect(mockNavigate).not.toHaveBeenCalledWith({ to: '/cycle-count/count' })
  })

  it('renders the LocationPicker and count action buttons', async () => {
    renderWithSuspense(<CycleCountIndex />)

    await waitFor(() => expect(screen.getByTestId('location-picker')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /expand all/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /collapse all/i })).toBeInTheDocument()
  })

  it('shows the tablet loading state while daily items are loading', async () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}))

    renderWithSuspense(<CycleCountIndex />)

    await waitFor(() => expect(screen.getByText(/loading tablet view/i)).toBeInTheDocument())
  })

  it('navigates to /no-access when daily items returns 403', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 403, ok: false, json: () => Promise.resolve({}) })

    renderWithSuspense(<CycleCountIndex />)

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/no-access' }))
  })
})

describe('Cycle Count Report - report.tsx', () => {
  it('shows password protection before report access is granted', async () => {
    renderWithSuspense(<ReportPage />)

    await waitFor(() => expect(screen.getByTestId('password-dialog')).toBeInTheDocument())
  })

  it('renders the new analytics report after access is granted', async () => {
    renderWithSuspense(<ReportPage />)

    fireEvent.click(await screen.findByRole('button', { name: /unlock/i }))

    await waitFor(() => expect(screen.getByText(/cycle count analytics/i)).toBeInTheDocument())
    expect(screen.getByTestId('date-picker')).toBeInTheDocument()
    expect(screen.getByTestId('location-picker')).toBeInTheDocument()
    expect(screen.getByText(/reconciled core matrix/i)).toBeInTheDocument()
    expect(screen.getByText(/incomplete counts/i)).toBeInTheDocument()
  })
})

describe('Cycle Count Manage - group pages', () => {
  it('renders the create group form', async () => {
    mockUseQuery.mockImplementation((options: any) => {
      if (options?.queryKey?.[0] === 'filterable-columns') {
        return { data: ['vendor_name', 'category_id', 'department', 'grade'], isLoading: false, refetch: vi.fn() }
      }
      return { data: { values: [], isCategory: false }, isLoading: false, refetch: vi.fn() }
    })

    renderWithSuspense(<GroupNewPage />)

    await waitFor(() => expect(screen.getByText(/create cycle count group/i)).toBeInTheDocument())
    expect(screen.getByLabelText(/group name/i)).toBeInTheDocument()
    expect(screen.getByText(/selected filtering rules/i)).toBeInTheDocument()
  })
})

describe('Cycle Count Manage - schedule pages', () => {
  it('renders the create schedule form', async () => {
    mockUseQuery.mockReturnValue({
      data: { groups: [{ id: 1, name: 'Beverages', filter_column: 'category_id', allowedValues: ['10'] }] },
      isLoading: false,
      refetch: vi.fn(),
    })

    renderWithSuspense(<ScheduleNewPage />)

    await waitFor(() => expect(screen.getByText(/create inventory schedule/i)).toBeInTheDocument())
    expect(screen.getByText(/drafting configuration node/i)).toBeInTheDocument()
    expect(screen.getByText(/target count date/i)).toBeInTheDocument()
  })
})

describe('Cycle Count Manage - item book', () => {
  it('renders the item book toolbar and empty state', async () => {
    global.fetch = makeOkFetch({ items: [] })

    renderWithSuspense(<ItemBkPage />)

    await waitFor(() => expect(screen.getByPlaceholderText(/search description or upc/i)).toBeInTheDocument())
    expect(screen.getByText(/filters/i)).toBeInTheDocument()
    expect(screen.getByText(/export excel/i)).toBeInTheDocument()
    expect(screen.getByText(/no matching items found/i)).toBeInTheDocument()
  })
})

describe('Cycle Count Inventory - inventory.tsx', () => {
  it('shows the password dialog when no session access has been granted', async () => {
    renderWithSuspense(<InventoryPage />)
    await waitFor(
      () => expect(screen.getByTestId('password-dialog')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders the inventory card title after access is granted via sessionStorage', async () => {
    sessionStorage.setItem('inventory_access', 'true')
    renderWithSuspense(<InventoryPage />)
    await waitFor(() =>
      expect(screen.getAllByText(/current inventory/i).length).toBeGreaterThan(0)
    )
  })
})

// Retired pages intentionally left without active coverage while production testing continues:
// - ../cycle-count/count-old
// - ../cycle-count/report-old
// - ../cycle-count/lookup
