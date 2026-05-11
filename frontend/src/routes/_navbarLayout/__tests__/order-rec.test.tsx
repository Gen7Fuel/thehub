import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// ─── Hoisted mutable state ─────────────────────────────────────────────────────

const {
  mockNavigate,
  mockUseLoaderData,
  mockUseSearch,
  mockAxiosPost,
  mockUseAuth,
} = vi.hoisted(() => {
  const mockUseAuth = vi.fn().mockReturnValue({
    user: { id: 'user-1', location: 'Rankin', email: 'test@example.com' },
  })

  return {
    mockNavigate: vi.fn(),
    mockUseLoaderData: vi.fn().mockReturnValue({ data: [], accessDenied: false }),
    mockUseSearch: vi.fn().mockReturnValue({ site: 'Rankin' }),
    mockAxiosPost: vi.fn(),
    mockUseAuth,
  }
})

// ─── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (config: any) => ({
      ...config,
      fullPath: '/_navbarLayout/order-rec',
      useLoaderData: mockUseLoaderData,
      useSearch: mockUseSearch,
    }),
    useNavigate: () => mockNavigate,
    Link: ({ to, children }: any) => <a href={to}>{children}</a>,
  }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/context/SiteContext', () => ({
  useSite: () => ({ selectedSite: '', setSelectedSite: vi.fn() }),
}))

vi.mock('axios', () => ({
  default: {
    post: mockAxiosPost,
    isAxiosError: vi.fn(() => false),
  },
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

vi.mock('@/components/custom/vendorPicker', () => ({
  VendorPicker: ({ setVendor }: any) => (
    <button data-testid="vendor-picker" onClick={() => setVendor('vendor-1')}>
      Vendor
    </button>
  ),
  fetchVendors: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/components/custom/sitePicker', () => ({
  SitePicker: ({ onValueChange }: any) => (
    <button data-testid="site-picker" onClick={() => onValueChange('Rankin')}>
      Site
    </button>
  ),
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: [] }),
  }
})

vi.mock('react-dropzone', () => ({
  useDropzone: () => ({
    getRootProps: () => ({ 'data-testid': 'dropzone' }),
    getInputProps: () => ({ type: 'file', accept: '.csv' }),
    isDragActive: false,
  }),
}))

vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>()
  return {
    ...actual,
    getOrderRecStatusColor: () => '#ccc',
  }
})

// ─── Component imports (after mocks) ─────────────────────────────────────────

import { Route as IndexRoute } from '../order-rec/index'
import { Route as ListRoute } from '../order-rec/list'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const renderWithSuspense = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <React.Suspense fallback={null}>{children}</React.Suspense>
    ),
  })

const OrderRecUpload = (IndexRoute as any).component as React.ComponentType
const OrderRecList = (ListRoute as any).component as React.ComponentType

const sampleRec = {
  _id: 'rec-1',
  filename: 'OrderRec - Vendor A - 10th March 2026 - 1',
  site: 'Rankin',
  vendor: 'vendor-1',
  currentStatus: 'Created',
  completed: false,
  createdAt: '2026-03-10T12:00:00Z',
  email: 'test@example.com',
  categories: [{ number: '100', items: [] }],
}

// ─── Order Rec Upload (index.tsx) ─────────────────────────────────────────────

describe('Order Rec Upload — index.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
  })

  it('renders the "Order Reconciliation" heading', async () => {
    renderWithSuspense(<OrderRecUpload />)
    await waitFor(
      () => expect(screen.getByText(/order reconciliation/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders the location picker', async () => {
    renderWithSuspense(<OrderRecUpload />)
    await waitFor(
      () => expect(screen.getByTestId('location-picker')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders the vendor picker', async () => {
    renderWithSuspense(<OrderRecUpload />)
    await waitFor(() => expect(screen.getByTestId('vendor-picker')).toBeInTheDocument())
  })

  it('renders the "Include station supplies" checkbox', async () => {
    renderWithSuspense(<OrderRecUpload />)
    await waitFor(() =>
      expect(screen.getByLabelText(/include station supplies/i)).toBeInTheDocument()
    )
  })

  it('renders the dropzone area when no file is uploaded', async () => {
    renderWithSuspense(<OrderRecUpload />)
    await waitFor(() => expect(screen.getByTestId('dropzone')).toBeInTheDocument())
  })

  it('renders "Only CSV files are accepted" hint text', async () => {
    renderWithSuspense(<OrderRecUpload />)
    await waitFor(() =>
      expect(screen.getByText(/only csv files are accepted/i)).toBeInTheDocument()
    )
  })
})

// ─── Order Rec List (list.tsx) ────────────────────────────────────────────────

describe('Order Rec List — list.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseLoaderData.mockReturnValue({ data: [sampleRec], accessDenied: false })
    mockUseSearch.mockReturnValue({ site: 'Rankin' })
  })

  it('renders the "Order Recommendations" heading', async () => {
    renderWithSuspense(<OrderRecList />)
    await waitFor(
      () => expect(screen.getByText(/order recommendations/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders the SitePicker', async () => {
    renderWithSuspense(<OrderRecList />)
    await waitFor(() => expect(screen.getByTestId('site-picker')).toBeInTheDocument())
  })

  it('displays a loaded order rec filename', async () => {
    renderWithSuspense(<OrderRecList />)
    await waitFor(() =>
      expect(
        screen.getByText('OrderRec - Vendor A - 10th March 2026 - 1')
      ).toBeInTheDocument()
    )
  })

  it('shows "No order reconciliation files found" when data is empty', async () => {
    mockUseLoaderData.mockReturnValue({ data: [], accessDenied: false })
    renderWithSuspense(<OrderRecList />)
    await waitFor(() =>
      expect(
        screen.getByText(/no order reconciliation files found/i)
      ).toBeInTheDocument()
    )
  })

  it('navigates to /no-access when accessDenied is true', async () => {
    mockUseLoaderData.mockReturnValue({ data: [], accessDenied: true })
    renderWithSuspense(<OrderRecList />)
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/no-access' })
    )
  })

  it('shows "Incomplete" badge for a non-completed order rec', async () => {
    renderWithSuspense(<OrderRecList />)
    await waitFor(() => expect(screen.getByText('Incomplete')).toBeInTheDocument())
  })

  it('shows "Completed" badge for a completed order rec', async () => {
    mockUseLoaderData.mockReturnValue({
      data: [{ ...sampleRec, completed: true, currentStatus: 'Completed' }],
      accessDenied: false,
    })
    renderWithSuspense(<OrderRecList />)
    // Both the status chip and the completion badge show "Completed" — verify at least one exists
    await waitFor(() => expect(screen.getAllByText('Completed').length).toBeGreaterThan(0))
  })

  it('shows pagination controls when there are more than 4 items', async () => {
    const manyRecs = Array.from({ length: 5 }, (_, i) => ({
      ...sampleRec,
      _id: `rec-${i}`,
      filename: `OrderRec ${i}`,
    }))
    mockUseLoaderData.mockReturnValue({ data: manyRecs, accessDenied: false })
    renderWithSuspense(<OrderRecList />)
    await waitFor(() => expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument())
  })

  it('displays the number of categories for each order rec', async () => {
    renderWithSuspense(<OrderRecList />)
    await waitFor(() => expect(screen.getByText(/categories: 1/i)).toBeInTheDocument())
  })
})
