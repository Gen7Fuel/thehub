import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

// ─── Hoisted mutable state ─────────────────────────────────────────────────────

const { mockNavigate, mockUseSearch, mockUseLoaderData, mockUser } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseSearch: vi.fn().mockReturnValue({ site: '', type: 'WO' }),
  mockUseLoaderData: vi.fn().mockReturnValue({ data: [], accessDenied: false }),
  mockUser: { email: 'test@example.com', location: 'Rankin', access: { writeOff: { create: true, requests: true } } },
}))

// ─── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (config: any) => ({
      ...config,
      fullPath: '/_navbarLayout/write-off/create',
      id: '/_navbarLayout/write-off/create',
      useSearch: mockUseSearch,
      useLoaderData: mockUseLoaderData,
    }),
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

vi.mock('@/components/custom/sitePicker', () => ({
  SitePicker: ({ onValueChange, value }: any) => (
    <button data-testid="site-picker" onClick={() => onValueChange('Rankin')}>
      {value || 'Pick a site'}
    </button>
  ),
}))

vi.mock('@/components/custom/datePicker', () => ({
  DatePicker: ({ date, setDate }: any) => (
    <button data-testid="date-picker" onClick={() => setDate(new Date('2026-04-01'))}>
      {date ? String(date) : 'Pick date'}
    </button>
  ),
}))

vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: { lists: ['WO-RANKIN-001'] } }),
  },
}))

// ─── Component imports (after mocks) ────────────────────────────────────────

import { Route as CreateRoute, REASONS, REASON_COLORS } from '../write-off/create'
import { Route as RequestsRoute, getStatusStyles } from '../write-off/requests'
import { Route as IndexRoute } from '../write-off/index'

// ─── Helpers ────────────────────────────────────────────────────────────────

const renderWithSuspense = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <React.Suspense fallback={null}>{children}</React.Suspense>
    ),
  })

const CreateComponent = (CreateRoute as any).component as React.ComponentType
const RequestsComponent = (RequestsRoute as any).component as React.ComponentType
const IndexComponent = (IndexRoute as any).component as React.ComponentType

// ─── Tests: REASONS and REASON_COLORS exports ──────────────────────────────

describe('Write-Off create — exported constants', () => {
  it('exports all 9 reasons', () => {
    expect(REASONS).toHaveLength(9)
    expect(REASONS).toContain('Breakage')
    expect(REASONS).toContain('Spoilage')
    expect(REASONS).toContain('Store Use')
    expect(REASONS).toContain('Deli')
    expect(REASONS).toContain('Stolen')
    expect(REASONS).toContain('Damaged')
    expect(REASONS).toContain('Expired')
    expect(REASONS).toContain('Donation')
    expect(REASONS).toContain('About to Expire')
  })

  it('exports REASON_COLORS for all reasons plus Bistro', () => {
    for (const reason of REASONS) {
      expect(REASON_COLORS[reason]).toBeDefined()
    }
    expect(REASON_COLORS['Bistro']).toBeDefined()
  })
})

// ─── Tests: getStatusStyles export ──────────────────────────────────────────

describe('Write-Off requests — getStatusStyles', () => {
  it('returns green styles for Complete', () => {
    expect(getStatusStyles('Complete')).toContain('green')
  })

  it('returns orange styles for Partial', () => {
    expect(getStatusStyles('Partial')).toContain('orange')
  })

  it('returns slate styles for Incomplete', () => {
    expect(getStatusStyles('Incomplete')).toContain('slate')
  })

  it('returns a fallback for unknown status', () => {
    expect(getStatusStyles('Unknown')).toBeDefined()
  })
})

// ─── Tests: Index redirect component ────────────────────────────────────────

describe('Write-Off index — permission-based redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders null (no visible content)', async () => {
    const { container } = renderWithSuspense(<IndexComponent />)
    await waitFor(
      () => expect(mockNavigate).toHaveBeenCalled(),
      { timeout: 5000 }
    )
    expect(container.innerHTML).toBe('')
  })

  it('navigates to /write-off/create when user has create permission', async () => {
    renderWithSuspense(<IndexComponent />)
    await waitFor(
      () => expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/write-off/create' })
      ),
      { timeout: 5000 }
    )
  })

  it('navigates to /write-off/requests when user only has requests permission', async () => {
    mockUser.access = { writeOff: { create: false, requests: true } } as any
    renderWithSuspense(<IndexComponent />)
    await waitFor(
      () => expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/write-off/requests' })
      ),
      { timeout: 5000 }
    )
    // Restore
    mockUser.access = { writeOff: { create: true, requests: true } } as any
  })

  it('navigates to /no-access when user has no permissions', async () => {
    mockUser.access = { writeOff: { create: false, requests: false } } as any
    renderWithSuspense(<IndexComponent />)
    await waitFor(
      () => expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/no-access' })
      ),
      { timeout: 5000 }
    )
    // Restore
    mockUser.access = { writeOff: { create: true, requests: true } } as any
  })

  it('passes site from user.location in search params', async () => {
    renderWithSuspense(<IndexComponent />)
    await waitFor(
      () => expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ search: { site: 'Rankin' } })
      ),
      { timeout: 5000 }
    )
  })
})

// ─── Tests: Create component ────────────────────────────────────────────────

describe('Write-Off create — component rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSearch.mockReturnValue({ site: 'Rankin' })
    localStorage.setItem('token', 'test-token')
  })

  it('renders the SitePicker', async () => {
    renderWithSuspense(<CreateComponent />)
    await waitFor(
      () => expect(screen.getByTestId('site-picker')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders the Add Item button', async () => {
    renderWithSuspense(<CreateComponent />)
    await waitFor(
      () => expect(screen.getByText('Add Item')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows "Write-Off List" heading', async () => {
    renderWithSuspense(<CreateComponent />)
    await waitFor(
      () => expect(screen.getByText('Write-Off List')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows empty state text when no items', async () => {
    renderWithSuspense(<CreateComponent />)
    await waitFor(
      () => expect(screen.getByText(/your write-off list is empty/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows "0 Items" badge initially', async () => {
    renderWithSuspense(<CreateComponent />)
    await waitFor(
      () => expect(screen.getByText('0 Items')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('opens add item dialog when Add Item is clicked', async () => {
    renderWithSuspense(<CreateComponent />)
    await waitFor(
      () => expect(screen.getByText('Add Item')).toBeInTheDocument(),
      { timeout: 5000 }
    )
    fireEvent.click(screen.getByText('Add Item'))
    await waitFor(
      () => expect(screen.getByText('Add Item for Write-Off')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows Regular Product and Bistro Item mode tabs in dialog', async () => {
    renderWithSuspense(<CreateComponent />)
    await waitFor(
      () => expect(screen.getByText('Add Item')).toBeInTheDocument(),
      { timeout: 5000 }
    )
    fireEvent.click(screen.getByText('Add Item'))
    await waitFor(() => {
      expect(screen.getByText('Regular Product')).toBeInTheDocument()
      expect(screen.getByText('Bistro Item')).toBeInTheDocument()
    })
  })

  it('shows Product Name and UPC Barcode fields in regular mode', async () => {
    renderWithSuspense(<CreateComponent />)
    await waitFor(
      () => expect(screen.getByText('Add Item')).toBeInTheDocument(),
      { timeout: 5000 }
    )
    fireEvent.click(screen.getByText('Add Item'))
    await waitFor(() => {
      expect(screen.getByText(/product name/i)).toBeInTheDocument()
      expect(screen.getByText(/upc barcode/i)).toBeInTheDocument()
    })
  })

  it('shows Qty and Reason fields in dialog', async () => {
    renderWithSuspense(<CreateComponent />)
    await waitFor(
      () => expect(screen.getByText('Add Item')).toBeInTheDocument(),
      { timeout: 5000 }
    )
    fireEvent.click(screen.getByText('Add Item'))
    await waitFor(() => {
      expect(screen.getByText('Qty')).toBeInTheDocument()
      expect(screen.getByText('Reason')).toBeInTheDocument()
    })
  })

  it('shows Write-Off Guidelines callout in regular mode', async () => {
    renderWithSuspense(<CreateComponent />)
    await waitFor(
      () => expect(screen.getByText('Add Item')).toBeInTheDocument(),
      { timeout: 5000 }
    )
    fireEvent.click(screen.getByText('Add Item'))
    await waitFor(
      () => expect(screen.getByText(/write-off guidelines/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('does not show unsaved progress warning when draft list is empty', async () => {
    renderWithSuspense(<CreateComponent />)
    await waitFor(
      () => expect(screen.getByText('Write-Off List')).toBeInTheDocument(),
      { timeout: 5000 }
    )
    expect(screen.queryByText(/unsaved progress/i)).not.toBeInTheDocument()
  })
})

// ─── Tests: Requests component ──────────────────────────────────────────────

describe('Write-Off requests — component rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSearch.mockReturnValue({ site: 'Rankin', type: 'WO' })
    mockUseLoaderData.mockReturnValue({ data: [], accessDenied: false })
  })

  it('renders the SitePicker', async () => {
    renderWithSuspense(<RequestsComponent />)
    await waitFor(
      () => expect(screen.getByTestId('site-picker')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders all three type tabs', async () => {
    renderWithSuspense(<RequestsComponent />)
    await waitFor(
      () => expect(screen.getByText('Write Off List')).toBeInTheDocument(),
      { timeout: 5000 }
    )
    expect(screen.getByText('About to Expire List')).toBeInTheDocument()
    expect(screen.getByText('Bistro Write-Off List')).toBeInTheDocument()
  })

  it('shows empty state for WO type when no data', async () => {
    renderWithSuspense(<RequestsComponent />)
    await waitFor(
      () => expect(screen.getByText(/no write-off items found/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows "0 WO Records" badge when no data', async () => {
    renderWithSuspense(<RequestsComponent />)
    await waitFor(
      () => expect(screen.getByText(/0 WO Records/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders list items when data is present', async () => {
    mockUseLoaderData.mockReturnValue({
      data: [
        {
          _id: '1',
          status: 'Incomplete',
          createdAt: '2026-03-15T10:00:00Z',
          items: [{ name: 'Item 1' }, { name: 'Item 2' }],
        },
      ],
      accessDenied: false,
    })

    renderWithSuspense(<RequestsComponent />)
    await waitFor(
      () => expect(screen.getByText(/2 Items to Review/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows status badge on list items', async () => {
    mockUseLoaderData.mockReturnValue({
      data: [
        { _id: '1', status: 'Incomplete', createdAt: '2026-03-15T10:00:00Z', items: [{ name: 'Item' }] },
      ],
      accessDenied: false,
    })

    renderWithSuspense(<RequestsComponent />)
    await waitFor(
      () => expect(screen.getByText('Incomplete')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('sorts items by status priority (Incomplete first)', async () => {
    mockUseLoaderData.mockReturnValue({
      data: [
        { _id: '1', status: 'Complete', createdAt: '2026-03-16T10:00:00Z', items: [{ name: 'A' }] },
        { _id: '2', status: 'Incomplete', createdAt: '2026-03-15T10:00:00Z', items: [{ name: 'B' }] },
      ],
      accessDenied: false,
    })

    renderWithSuspense(<RequestsComponent />)
    await waitFor(
      () => expect(screen.getByText('Incomplete')).toBeInTheDocument(),
      { timeout: 5000 }
    )

    const listItems = screen.getAllByRole('listitem')
    expect(listItems[0]).toHaveTextContent('Incomplete')
    expect(listItems[1]).toHaveTextContent('Complete')
  })

  it('shows record count badge', async () => {
    mockUseLoaderData.mockReturnValue({
      data: [
        { _id: '1', status: 'Incomplete', createdAt: '2026-03-15T10:00:00Z', items: [] },
        { _id: '2', status: 'Partial', createdAt: '2026-03-16T10:00:00Z', items: [] },
      ],
      accessDenied: false,
    })

    renderWithSuspense(<RequestsComponent />)
    await waitFor(
      () => expect(screen.getByText(/2 WO Records/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('navigates on access denied', async () => {
    mockUseLoaderData.mockReturnValue({ data: [], accessDenied: true })
    renderWithSuspense(<RequestsComponent />)
    await waitFor(
      () => expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/no-access' })
      ),
      { timeout: 5000 }
    )
  })
})
