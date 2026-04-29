import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ─── Hoisted mutable state ─────────────────────────────────────────────────────

const { mockNavigate, mockUseSearch, mockUseAuth, mockAxiosGet, mockAxiosDelete, mockSocket } =
  vi.hoisted(() => {
    const mockSocket = { on: vi.fn(), off: vi.fn(), emit: vi.fn() }
    return {
      mockNavigate: vi.fn(),
      mockUseSearch: vi.fn().mockReturnValue({ site: 'Rankin' }),
      mockUseAuth: vi.fn().mockReturnValue({
        user: {
          location: 'Rankin',
          access: { stationAudit: { checklist: true, template: true } },
        },
      }),
      mockAxiosGet: vi.fn(),
      mockAxiosDelete: vi.fn(),
      mockSocket,
    }
  })

// ─── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('axios', () => ({
  default: {
    get: mockAxiosGet,
    delete: mockAxiosDelete,
    post: vi.fn(),
    put: vi.fn(),
  },
}))

vi.mock('@/lib/websocket', () => ({
  getSocket: () => mockSocket,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (config: any) => ({
      ...config,
      useSearch: mockUseSearch,
      useLoaderData: vi.fn(),
    }),
    useNavigate: () => mockNavigate,
    Link: ({ children }: any) => <span>{children}</span>,
    Outlet: () => <div data-testid="outlet" />,
    useMatchRoute: () => () => false,
  }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/components/custom/sitePicker', () => ({
  SitePicker: ({ onValueChange, value }: any) => (
    <button data-testid="site-picker" onClick={() => onValueChange('TestSite')}>
      {value || 'Pick a site'}
    </button>
  ),
}))

vi.mock('@/components/custom/dashboard/auditCharts', () => ({
  AuditSummaryChart: () => <div data-testid="audit-chart" />,
}))

vi.mock('@/components/custom/OpenIssueCard', () => ({
  OpenIssueCard: ({ issue }: any) => (
    <div data-testid="open-issue-card">{issue.item}</div>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <>{children}</>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}))

// Mock the interface/open-issues module (imported by checklist/open-issues.tsx)
vi.mock('../interface/open-issues', () => ({
  STATUS_PRIORITY: { Created: 0, 'In Progress': 1, 'On Hold': 2, Resolved: 3 },
  statusFlow: {
    Created: ['In Progress', 'Resolved'],
    'In Progress': ['On Hold', 'Resolved'],
    'On Hold': ['In Progress', 'Resolved'],
  },
}))

// ─── Component imports (after mocks) ──────────────────────────────────────────

import { Route as ChecklistRoute } from '../checklist'
import { Route as ChecklistListRoute } from '../templates/checklist/list'
import { Route as SelectListRoute } from '../templates/select/list'
import { OpenIssuesPage } from '../checklist/open-issues'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const renderWithSuspense = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <React.Suspense fallback={null}>{children}</React.Suspense>
    ),
  })

const ChecklistLayout = (ChecklistRoute as any).component as React.ComponentType
const ChecklistList = (ChecklistListRoute as any).component as React.ComponentType
const SelectList = (SelectListRoute as any).component as React.ComponentType

const sampleTemplates = [
  { _id: 'tmpl-1', name: 'Daily Checklist', sites: ['Rankin'], description: 'Daily store audit' },
  { _id: 'tmpl-2', name: 'Weekly Safety', sites: ['Rankin'], description: 'Weekly safety audit' },
]

const sampleSelectTemplates = [
  { _id: 'sel-1', name: 'Category', description: 'Item categories', options: [{ text: 'Fuel' }, { text: 'Store' }] },
  { _id: 'sel-2', name: 'Assigned To', options: [{ text: 'Manager' }] },
]

const sampleIssues = [
  {
    _id: 'issue-1',
    item: 'Check fuel pump pressure',
    category: 'Fuel',
    currentIssueStatus: 'Created',
    issueRaised: true,
  },
  {
    _id: 'issue-2',
    item: 'Inspect fire extinguisher',
    category: 'Safety',
    currentIssueStatus: 'In Progress',
    issueRaised: true,
  },
]

// ─── Checklist Layout — checklist.tsx ─────────────────────────────────────────

describe('Checklist Layout — checklist.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockUseSearch.mockReturnValue({ site: 'Rankin' })
    mockUseAuth.mockReturnValue({
      user: { location: 'Rankin', access: {} },
    })
    mockAxiosGet.mockResolvedValue({ data: [] })
  })

  it('does not show the SitePicker while templates are being fetched', () => {
    mockAxiosGet.mockReturnValue(new Promise(() => {}))
    renderWithSuspense(<ChecklistLayout />)
    expect(screen.queryByTestId('site-picker')).not.toBeInTheDocument()
  })

  it('renders the SitePicker after templates load', async () => {
    renderWithSuspense(<ChecklistLayout />)
    await waitFor(
      () => expect(screen.getByTestId('site-picker')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows "Select Checklist" carousel label when no template is active', async () => {
    renderWithSuspense(<ChecklistLayout />)
    await waitFor(() => expect(screen.getByText('Select Checklist')).toBeInTheDocument(), { timeout: 5000 })
  })

  it('does not show Open Issues button when there are no open issues', async () => {
    mockAxiosGet.mockResolvedValue({ data: [] }) // no issues
    renderWithSuspense(<ChecklistLayout />)
    await waitFor(() => expect(screen.queryByText(/open issues/i)).not.toBeInTheDocument(), { timeout: 5000 })
  })

  // it('shows Open Issues button with count when issues exist', async () => {
  //   mockAxiosGet.mockImplementation((url: string) => {
  //     if (url.includes('open-issues')) return Promise.resolve({ data: { items: sampleIssues } })
  //     return Promise.resolve({ data: [] })
  //   })
  //   renderWithSuspense(<ChecklistLayout />)
  //   await waitFor(
  //     () => expect(screen.getByText(/open issues \(2\)/i)).toBeInTheDocument(),
  //     { timeout: 5000 }
  //   )
  // })

  it('shows error message when template fetch fails', async () => {
    mockAxiosGet.mockRejectedValue({ response: { status: 500 } })
    renderWithSuspense(<ChecklistLayout />)
    await waitFor(
      () => expect(screen.getByText(/failed to load audit templates/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('navigates to /no-access when template fetch returns 403', async () => {
    mockAxiosGet.mockRejectedValue({ response: { status: 403 } })
    renderWithSuspense(<ChecklistLayout />)
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/no-access' })
    )
  })

  it('navigates to set site using user location when no site in search params', async () => {
    mockUseSearch.mockReturnValue({ site: undefined })
    mockUseAuth.mockReturnValue({ user: { location: 'Couchiching', access: {} } })
    renderWithSuspense(<ChecklistLayout />)
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ search: { site: 'Couchiching' } })
      )
    )
  })

  it('renders the Outlet', async () => {
    renderWithSuspense(<ChecklistLayout />)
    await waitFor(() => expect(screen.getByTestId('outlet')).toBeInTheDocument(), { timeout: 5000 })
  })
})

// ─── Checklist Templates List — templates/checklist/list.tsx ──────────────────

describe('Checklist Templates List — templates/checklist/list.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockAxiosGet.mockResolvedValue({ data: sampleTemplates })
  })

  it('does not show the table while templates are loading', () => {
    mockAxiosGet.mockReturnValue(new Promise(() => {}))
    renderWithSuspense(<ChecklistList />)
    expect(screen.queryByText(/audit checklist templates/i)).not.toBeInTheDocument()
  })

  it('renders the "Audit Checklist Templates" heading', async () => {
    renderWithSuspense(<ChecklistList />)
    await waitFor(
      () => expect(screen.getByText(/audit checklist templates/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders template names and descriptions', async () => {
    renderWithSuspense(<ChecklistList />)
    await waitFor(() => expect(screen.getByText('Daily Checklist')).toBeInTheDocument(), { timeout: 5000 })
    expect(screen.getByText('Weekly Safety')).toBeInTheDocument()
    expect(screen.getByText('Daily store audit')).toBeInTheDocument()
  })

  it('shows "No audit templates found" when list is empty', async () => {
    mockAxiosGet.mockResolvedValue({ data: [] })
    renderWithSuspense(<ChecklistList />)
    await waitFor(
      () => expect(screen.getByText(/no audit templates found/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows error message when fetch fails', async () => {
    mockAxiosGet.mockRejectedValue({ response: { status: 500 } })
    renderWithSuspense(<ChecklistList />)
    await waitFor(
      () => expect(screen.getByText(/failed to load audit templates/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('navigates to /no-access when fetch returns 403', async () => {
    mockAxiosGet.mockRejectedValue({ response: { status: 403 } })
    renderWithSuspense(<ChecklistList />)
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/no-access' })
    )
  })

  it('navigates to edit page when edit button is clicked', async () => {
    renderWithSuspense(<ChecklistList />)
    const editButtons = await waitFor(
      () => screen.getAllByTitle('Edit'),
      { timeout: 5000 }
    )
    fireEvent.click(editButtons[0])
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/audit/templates/checklist/tmpl-1' })
    )
  })

  it('calls delete API and removes template from list when delete is confirmed', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    mockAxiosDelete.mockResolvedValue({ status: 200 })
    renderWithSuspense(<ChecklistList />)

    const deleteButtons = await waitFor(
      () => screen.getAllByTitle('Delete'),
      { timeout: 5000 }
    )
    fireEvent.click(deleteButtons[0])

    await waitFor(() => expect(mockAxiosDelete).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText('Daily Checklist')).not.toBeInTheDocument())
  })

  it('does not call delete API when delete is cancelled', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
    renderWithSuspense(<ChecklistList />)

    const deleteButtons = await waitFor(
      () => screen.getAllByTitle('Delete'),
      { timeout: 5000 }
    )
    fireEvent.click(deleteButtons[0])
    expect(mockAxiosDelete).not.toHaveBeenCalled()
  })

  it('navigates to /no-access when delete returns 403', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    mockAxiosDelete.mockRejectedValue({ response: { status: 403 } })
    renderWithSuspense(<ChecklistList />)

    const deleteButtons = await waitFor(
      () => screen.getAllByTitle('Delete'),
      { timeout: 5000 }
    )
    fireEvent.click(deleteButtons[0])
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/no-access' })
    )
  })
})

// ─── Select Templates List — templates/select/list.tsx ────────────────────────

describe('Select Templates List — templates/select/list.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockAxiosGet.mockResolvedValue({ data: sampleSelectTemplates })
  })

  it('does not show the list while templates are loading', () => {
    mockAxiosGet.mockReturnValue(new Promise(() => {}))
    renderWithSuspense(<SelectList />)
    expect(screen.queryByText(/select templates/i)).not.toBeInTheDocument()
  })

  it('renders the "Select Templates" heading', async () => {
    renderWithSuspense(<SelectList />)
    await waitFor(
      () => expect(screen.getByText(/select templates/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders template names', async () => {
    renderWithSuspense(<SelectList />)
    await waitFor(() => expect(screen.getByText('Category')).toBeInTheDocument(), { timeout: 5000 })
    expect(screen.getByText('Assigned To')).toBeInTheDocument()
  })

  it('renders template options', async () => {
    renderWithSuspense(<SelectList />)
    await waitFor(() => expect(screen.getByText('Fuel')).toBeInTheDocument(), { timeout: 5000 })
    expect(screen.getByText('Store')).toBeInTheDocument()
    expect(screen.getByText('Manager')).toBeInTheDocument()
  })

  it('shows template description when present', async () => {
    renderWithSuspense(<SelectList />)
    await waitFor(
      () => expect(screen.getByText('Item categories')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows "No select templates found" when list is empty', async () => {
    mockAxiosGet.mockResolvedValue({ data: [] })
    renderWithSuspense(<SelectList />)
    await waitFor(
      () => expect(screen.getByText(/no select templates found/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows error message when fetch fails', async () => {
    mockAxiosGet.mockRejectedValue({ response: { status: 500 } })
    renderWithSuspense(<SelectList />)
    await waitFor(
      () => expect(screen.getByText(/failed to load select templates/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('navigates to /no-access when fetch returns 403', async () => {
    mockAxiosGet.mockRejectedValue({ response: { status: 403 } })
    renderWithSuspense(<SelectList />)
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/no-access' })
    )
  })

  it('navigates to edit page when edit button is clicked', async () => {
    renderWithSuspense(<SelectList />)
    const editButtons = await waitFor(
      () => screen.getAllByTitle('Edit'),
      { timeout: 5000 }
    )
    fireEvent.click(editButtons[0])
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/audit/templates/select/sel-1' })
    )
  })

  it('calls delete API and removes template when delete is confirmed', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    mockAxiosDelete.mockResolvedValue({ status: 200 })
    renderWithSuspense(<SelectList />)

    const deleteButtons = await waitFor(
      () => screen.getAllByTitle('Delete'),
      { timeout: 5000 }
    )
    fireEvent.click(deleteButtons[0])

    await waitFor(() => expect(mockAxiosDelete).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText('Category')).not.toBeInTheDocument())
  })
})

// ─── Checklist Open Issues — checklist/open-issues.tsx ────────────────────────

describe('Checklist Open Issues — checklist/open-issues.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockUseSearch.mockReturnValue({ site: 'Rankin' })
    mockUseAuth.mockReturnValue({ user: { location: 'Rankin', access: {} } })
  })

  it('shows Loading... while fetching issues', () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}))
    renderWithSuspense(<OpenIssuesPage />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows "No open issues found" when the list is empty', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    })
    renderWithSuspense(<OpenIssuesPage />)
    await waitFor(
      () => expect(screen.getByText(/no open issues found/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders an OpenIssueCard for each issue', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ items: sampleIssues }),
    })
    renderWithSuspense(<OpenIssuesPage />)
    await waitFor(
      () => expect(screen.getAllByTestId('open-issue-card')).toHaveLength(2),
      { timeout: 5000 }
    )
    expect(screen.getByText('Check fuel pump pressure')).toBeInTheDocument()
    expect(screen.getByText('Inspect fire extinguisher')).toBeInTheDocument()
  })

  it('handles flat array response (not wrapped in items)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve(sampleIssues), // flat array
    })
    renderWithSuspense(<OpenIssuesPage />)
    await waitFor(
      () => expect(screen.getAllByTestId('open-issue-card')).toHaveLength(2),
      { timeout: 5000 }
    )
  })

  it('navigates to /no-access when fetch returns 403', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 403,
      ok: false,
      json: () => Promise.resolve({}),
    })
    renderWithSuspense(<OpenIssuesPage />)
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/no-access' })
    )
  })

  it('renders category legend chips for each unique category', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ items: sampleIssues }),
    })
    renderWithSuspense(<OpenIssuesPage />)
    await waitFor(
      () => {
        expect(screen.getByText('Fuel')).toBeInTheDocument()
        expect(screen.getByText('Safety')).toBeInTheDocument()
      },
      { timeout: 5000 }
    )
  })

  it('does not fetch when no site is in search params', () => {
    mockUseSearch.mockReturnValue({ site: undefined })
    mockUseAuth.mockReturnValue({ user: { location: undefined, access: {} } })
    global.fetch = vi.fn()
    renderWithSuspense(<OpenIssuesPage />)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
