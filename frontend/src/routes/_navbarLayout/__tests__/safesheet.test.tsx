import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import type { SafesheetEntry } from '@/lib/safesheetUtils'

// ─── Hoisted mutable mocks ────────────────────────────────────────────────────
// vi.hoisted runs before vi.mock factories, letting us share mutable references.

const { mockUseSearch, mockNavigate } = vi.hoisted(() => ({
  mockUseSearch: vi.fn().mockReturnValue({ site: '', from: '2026-03-01', to: '2026-03-10' }),
  mockNavigate: vi.fn(),
}))

const mockSafesheetService = vi.hoisted(() => ({
  get: vi.fn(),
  addEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
  uploadPhoto: vi.fn(),
}))

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => ({
    ...config,
    fullPath: '/_navbarLayout/safesheet',
    useSearch: mockUseSearch,
  }),
  useNavigate: () => mockNavigate,
}))

// Mock auth — default user has NO safesheet permissions
const mockUserBase = {
  id: 'user-1',
  email: 'test@example.com',
  location: 'Rankin',
  access: {
    accounting: {
      safesheet: {
        value: true,
        deleteEntry: false,
        setAssignedDate: false,
      },
    },
  },
}

const mockUseAuth = vi.fn().mockReturnValue({ user: mockUserBase })

vi.mock('@/context/SiteContext', () => ({
  useSite: () => ({ selectedSite: '', setSelectedSite: vi.fn() }),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

// Keep page tests focused on UI behavior while the API contract is covered by
// the safesheet service tests. These adapters preserve the existing fetch-based
// assertions without letting the route call Axios during the test.
vi.mock('@/api/safesheets/safesheets.service', () => ({ safesheetService: mockSafesheetService }))

// Bypass password dialog — immediately call onSuccess so hasAccess becomes true
vi.mock('@/components/custom/PasswordProtection', () => ({
  PasswordProtection: ({ onSuccess }: { onSuccess: () => void; isOpen: boolean; onCancel: () => void; userLocation: string }) => {
    React.useEffect(() => {
      onSuccess()
    }, [])
    return null
  },
}))

vi.mock('@/components/custom/sitePicker', () => ({
  SitePicker: ({ value, onValueChange }: any) => (
    <select data-testid="site-picker" value={value} onChange={(e) => onValueChange(e.target.value)}>
      <option value="">Pick a site</option>
      <option value="TestSite">TestSite</option>
    </select>
  ),
}))

vi.mock('@/components/custom/datePickerWithRange', () => ({
  DatePickerWithRange: () => <div data-testid="date-picker" />,
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: any) => (
    <input
      type="checkbox"
      data-testid="sort-switch"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  ),
}))

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: any) => (
    <button onClick={() => onSelect(new Date(2026, 2, 11))}>Assign March 11</button>
  ),
}))

vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>()
  return {
    ...actual,
    getStartAndEndOfToday: () => ({ start: new Date('2026-03-10'), end: new Date('2026-03-10') }),
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeMockSheet = (entries: Partial<SafesheetEntry>[] = []) => ({
  _id: 'sheet-1',
  site: 'TestSite',
  initialBalance: 0,
  entries: entries.map((e, i) => ({
    _id: `entry-${i}`,
    date: '2026-03-10T10:00:00.000Z',
    description: `Entry ${i}`,
    cashIn: 0,
    cashExpenseOut: 0,
    cashDepositBank: 0,
    cashOnHandSafe: 0,
    ...e,
  })),
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-10T00:00:00.000Z',
})

const createFetchMock = (sheet: ReturnType<typeof makeMockSheet>) =>
  vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(sheet),
  } as any)

// ─── Import component after mocks are declared ────────────────────────────────
// Dynamic import ensures the module is initialised with mocks already in place.
const { default: SafesheetRoute } = await import('../safesheet')

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SafesheetRoute component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockNavigate.mockReset()
    mockUseAuth.mockReturnValue({ user: mockUserBase })
    mockUseSearch.mockReturnValue({ site: '', from: '2026-03-01', to: '2026-03-10' })
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue({}) } as any)
    mockSafesheetService.get.mockImplementation(async (site: string, from: string, to: string, sortAssigned: boolean) => {
      const response = await fetch(`/api/safesheets/site/${encodeURIComponent(site)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&sortAssigned=${sortAssigned ? 'true' : 'false'}`, { headers: {} })
      if (!response.ok) throw new Error('Failed to fetch safesheet')
      return response.json()
    })
    mockSafesheetService.addEntry.mockImplementation(async (site: string, input: unknown) => {
      const response = await fetch(`/api/safesheets/site/${encodeURIComponent(site)}/entries`, { method: 'POST', body: JSON.stringify(input) })
      if (!response.ok) throw new Error('Failed to add entry')
      return response.json()
    })
    mockSafesheetService.updateEntry.mockImplementation(async (site: string, entryId: string, input: unknown) => {
      const response = await fetch(`/api/safesheets/site/${encodeURIComponent(site)}/entries/${entryId}`, { method: 'PUT', body: JSON.stringify(input) })
      if (!response.ok) throw new Error('Failed to update entry')
      return response.json()
    })
    mockSafesheetService.deleteEntry.mockImplementation(async (site: string, entryId: string) => {
      const response = await fetch(`/api/safesheets/site/${encodeURIComponent(site)}/entries/${entryId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete entry')
      return response.json()
    })
  })

  it('refreshes sorted rows and balances after changing a deposit assigned date', async () => {
    const before = makeMockSheet([
      { description: 'Daily Deposit', cashIn: 3395.70, cashOnHandSafe: 31291.66 },
      { description: 'Bank Deposit', cashDepositBank: 765.65, cashOnHandSafe: 30526.01 },
      { description: 'Payout - Sams', date: '2026-03-11T10:00:00Z', cashExpenseOut: 19964, cashOnHandSafe: 10562.01 },
    ])
    // The range starts with an existing balance from earlier transactions.
    before.initialBalance = 0
    const after = {
      ...before,
      entries: [
        before.entries[0],
        { ...before.entries[2], cashOnHandSafe: 11327.66 },
        { ...before.entries[1], assignedDate: '2026-03-11', cashOnHandSafe: 10562.01 },
      ],
    }
    let assigned = false
    const fetchMock = vi.fn().mockImplementation(async (_url, init) => {
      if (init?.method === 'PUT') assigned = true
      return { ok: true, status: 200, json: async () => assigned ? after : before }
    })
    global.fetch = fetchMock
    mockUseSearch.mockReturnValue({ site: 'TestSite', from: '2026-03-10', to: '2026-03-12' })
    mockUseAuth.mockReturnValue({ user: {
      ...mockUserBase,
      access: { accounting: { safesheet: { value: true, setAssignedDate: true } } },
    } })
    render(<SafesheetRoute />)
    await screen.findByText('Bank Deposit')
    fireEvent.click(screen.getByTestId('sort-switch'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('sortAssigned=true'), expect.any(Object),
    ))
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
    const depositRow = screen.getByText('Bank Deposit').closest('tr')!
    const calendarButton = within(depositRow).getAllByRole('button').find(
      (button) => button.querySelector('.lucide-calendar-days'),
    )!
    fireEvent.click(calendarButton)
    fireEvent.click(await screen.findByRole('button', { name: 'Assign March 11' }))
    await waitFor(() => {
      const payoutRow = screen.getByText('Payout - Sams').closest('tr')!
      expect(within(payoutRow).getByText('11,327.66')).toBeInTheDocument()
    })
    const updateIndex = fetchMock.mock.calls.findIndex((call) => call[1]?.method === 'PUT')
    expect(fetchMock.mock.calls[updateIndex + 1][0]).toContain('sortAssigned=true')
    expect(fetchMock.mock.calls[updateIndex][1].body).toBe(JSON.stringify({ assignedDate: '2026-03-11' }))
    const rows = screen.getAllByRole('row')
    expect(rows.indexOf(screen.getByText('Payout - Sams').closest('tr')!)).toBeLessThan(
      rows.indexOf(screen.getByText('Bank Deposit').closest('tr')!),
    )
  })

  // ── Smoke test ───────────────────────────────────────────────────────────────

  it('renders without crashing', () => {
    render(<SafesheetRoute />)
    // PasswordProtection is mocked to immediately grant access; site picker should be present
    expect(screen.getByTestId('site-picker')).toBeInTheDocument()
  })

  // ── Empty site ───────────────────────────────────────────────────────────────

  it('shows "Please select a site" when no site is selected', async () => {
    mockUseSearch.mockReturnValue({ site: '', from: '2026-03-01', to: '2026-03-10' })
    render(<SafesheetRoute />)
    expect(await screen.findByText(/please select a site/i)).toBeInTheDocument()
  })

  // ── Fetch on site + range ────────────────────────────────────────────────────

  it('calls the safesheet API with the correct URL when site is set', async () => {
    const sheet = makeMockSheet()
    global.fetch = createFetchMock(sheet)
    mockUseSearch.mockReturnValue({ site: 'TestSite', from: '2026-03-01', to: '2026-03-10' })

    render(<SafesheetRoute />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/safesheets/site/TestSite'),
        expect.any(Object),
      )
    })
  })

  // ── Delete button permission ──────────────────────────────────────────────────

  it('does NOT show the delete button when user lacks deleteEntry permission', async () => {
    const sheet = makeMockSheet([{ cashIn: 100 }])
    global.fetch = createFetchMock(sheet)
    mockUseSearch.mockReturnValue({ site: 'TestSite', from: '2026-03-01', to: '2026-03-10' })
    // User without deleteEntry (default mockUserBase)
    mockUseAuth.mockReturnValue({
      user: {
        ...mockUserBase,
        access: { accounting: { safesheet: { value: true, deleteEntry: false, setAssignedDate: false } } },
      },
    })

    render(<SafesheetRoute />)

    // Wait for the table to load
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    await screen.findByText('Entry 0')

    const deleteButtons = screen.queryAllByRole('button', { name: /delete/i })
    // The Trash2 button has no visible label, so query by aria or use a different selector.
    // The button wrapping Trash2 has class containing 'border-red-400'; check it's absent.
    // We'll use the button's accessible name derived from the icon title attribute if any,
    // but since Lucide icons don't add titles by default, we test by querying all buttons
    // and checking none has the red-border delete class:
    const buttons = screen.getAllByRole('button')
    const deleteBtn = buttons.find((btn) => btn.className.includes('border-red-400'))
    expect(deleteBtn).toBeUndefined()
    expect(deleteButtons).toHaveLength(0)
  })

  it('shows the delete button when user has deleteEntry permission', async () => {
    const sheet = makeMockSheet([{ cashIn: 100 }])
    global.fetch = createFetchMock(sheet)
    mockUseSearch.mockReturnValue({ site: 'TestSite', from: '2026-03-01', to: '2026-03-10' })
    mockUseAuth.mockReturnValue({
      user: {
        ...mockUserBase,
        access: { accounting: { safesheet: { value: true, deleteEntry: true, setAssignedDate: false } } },
      },
    })

    render(<SafesheetRoute />)

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    await screen.findByText('Entry 0')

    const buttons = screen.getAllByRole('button')
    const deleteBtn = buttons.find((btn) => btn.className.includes('border-red-400'))
    expect(deleteBtn).toBeDefined()
  })

  // ── Calendar button permission ────────────────────────────────────────────────

  it('does NOT show the calendar button when user lacks setAssignedDate permission', async () => {
    const sheet = makeMockSheet([{ cashDepositBank: 100 }])
    global.fetch = createFetchMock(sheet)
    mockUseSearch.mockReturnValue({ site: 'TestSite', from: '2026-03-01', to: '2026-03-10' })
    mockUseAuth.mockReturnValue({
      user: {
        ...mockUserBase,
        access: { accounting: { safesheet: { value: true, deleteEntry: false, setAssignedDate: false } } },
      },
    })

    render(<SafesheetRoute />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    await screen.findByText('Entry 0')

    // Both the camera and calendar buttons use border-blue-500.
    // Without setAssignedDate permission only the camera button (1) should render.
    const buttons = screen.getAllByRole('button')
    const blueButtons = buttons.filter((btn) => btn.className.includes('border-blue-500'))
    expect(blueButtons).toHaveLength(1) // camera only, no calendar
  })

  it('shows the calendar button when user has setAssignedDate permission and entry has cashDepositBank', async () => {
    const sheet = makeMockSheet([{ cashDepositBank: 100 }])
    global.fetch = createFetchMock(sheet)
    mockUseSearch.mockReturnValue({ site: 'TestSite', from: '2026-03-01', to: '2026-03-10' })
    mockUseAuth.mockReturnValue({
      user: {
        ...mockUserBase,
        access: { accounting: { safesheet: { value: true, deleteEntry: false, setAssignedDate: true } } },
      },
    })

    render(<SafesheetRoute />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    await screen.findByText('Entry 0')

    const buttons = screen.getAllByRole('button')
    const calendarBtn = buttons.find((btn) => btn.className.includes('border-blue-500'))
    expect(calendarBtn).toBeDefined()
  })

  // ── Delete dialog flow ────────────────────────────────────────────────────────

  it('opens the delete confirmation dialog when the delete button is clicked', async () => {
    const sheet = makeMockSheet([{ cashIn: 100, description: 'Cash sale' }])
    global.fetch = createFetchMock(sheet)
    mockUseSearch.mockReturnValue({ site: 'TestSite', from: '2026-03-01', to: '2026-03-10' })
    mockUseAuth.mockReturnValue({
      user: {
        ...mockUserBase,
        access: { accounting: { safesheet: { value: true, deleteEntry: true, setAssignedDate: false } } },
      },
    })

    render(<SafesheetRoute />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    await screen.findByText('Cash sale')

    const buttons = screen.getAllByRole('button')
    const deleteBtn = buttons.find((btn) => btn.className.includes('border-red-400'))!
    fireEvent.click(deleteBtn)

    // Dialog should now be open with the entry details
    expect(await screen.findByText(/delete entry/i)).toBeInTheDocument()
    // 'Cash sale' appears in both the table row and the dialog
    expect(screen.getAllByText('Cash sale').length).toBeGreaterThanOrEqual(2)
  })

  it('calls DELETE API when the confirm delete button is clicked', async () => {
    const sheet = makeMockSheet([{ cashIn: 100, description: 'Cash sale' }])
    const fetchMock = createFetchMock(sheet)
    global.fetch = fetchMock
    mockUseSearch.mockReturnValue({ site: 'TestSite', from: '2026-03-01', to: '2026-03-10' })
    mockUseAuth.mockReturnValue({
      user: {
        ...mockUserBase,
        access: { accounting: { safesheet: { value: true, deleteEntry: true, setAssignedDate: false } } },
      },
    })

    render(<SafesheetRoute />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    await screen.findByText('Cash sale')

    // Click the delete button for the row
    const buttons = screen.getAllByRole('button')
    const deleteBtn = buttons.find((btn) => btn.className.includes('border-red-400'))!
    fireEvent.click(deleteBtn)

    // Wait for dialog
    await screen.findByText(/delete entry/i)

    // Click the "Delete" confirm button in the dialog (variant="destructive")
    const confirmBtn = screen.getByRole('button', { name: /^delete$/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      const deleteCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: any[]) => call[1]?.method === 'DELETE',
      )
      expect(deleteCalls.length).toBeGreaterThan(0)
      expect(deleteCalls[0][0]).toContain('/api/safesheets/site/TestSite/entries/entry-0')
    })
  })
})
