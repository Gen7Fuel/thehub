import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ─── Hoisted mutable state ─────────────────────────────────────────────────────

const { mockNavigate, mockUseLoaderData, mockUseSearch, mockUseAuth } = vi.hoisted(() => {
  const mockUseAuth = vi.fn().mockReturnValue({
    user: {
      id: 'user-1',
      site: 'Rankin',
      access: {
        accounting: {
          cashSummary: {
            form: true,
            report: { value: true },
          },
        },
      },
    },
  })

  return {
    mockNavigate: vi.fn(),
    mockUseLoaderData: vi.fn().mockReturnValue({ existing: null, accessDenied: false }),
    mockUseSearch: vi.fn().mockReturnValue({ site: 'Rankin', id: undefined }),
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
      fullPath: '/_navbarLayout/cash-summary',
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

vi.mock('@/lib/constants', () => ({
  domain: 'http://localhost:5000',
}))

vi.mock('@/components/custom/sitePicker', () => ({
  SitePicker: ({ onValueChange, value }: any) => (
    <button data-testid="site-picker" onClick={() => onValueChange('TestSite')}>
      {value || 'Pick a site'}
    </button>
  ),
}))

vi.mock('@/components/custom/LotteryComparisionTable', () => ({
  LotteryComparisonTable: () => <div data-testid="lottery-table" />,
}))

// ─── Component imports (after mocks) ─────────────────────────────────────────

import { Route as IndexRoute } from '../cash-summary/index'
import { Route as FormRoute } from '../cash-summary/form'
import { Route as ListRoute } from '../cash-summary/list'
import { Route as ReportRoute } from '../cash-summary/report'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const renderWithSuspense = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <React.Suspense fallback={null}>{children}</React.Suspense>
    ),
  })

const CashSummaryIndex = (IndexRoute as any).component as React.ComponentType
const CashSummaryForm = (FormRoute as any).component as React.ComponentType
const CashSummaryList = (ListRoute as any).component as React.ComponentType
const CashSummaryReport = (ReportRoute as any).component as React.ComponentType

const makeOkFetch = (data: any) =>
  vi.fn().mockResolvedValue({ status: 200, ok: true, json: () => Promise.resolve(data) })

const sampleSummary = {
  _id: 'sum-1',
  site: 'Rankin',
  shift_number: 'SFT-001',
  date: '2026-03-10T00:00:00.000Z',
  canadian_cash_collected: 500,
  item_sales: 250,
  createdAt: '2026-03-10T08:00:00.000Z',
  updatedAt: '2026-03-10T08:00:00.000Z',
}

// ─── Cash Summary Index — index.tsx ───────────────────────────────────────────

describe('Cash Summary Index — index.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to /cash-summary/form when user has form access', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        access: { accounting: { cashSummary: { form: true } } },
      },
    })
    renderWithSuspense(<CashSummaryIndex />)
    await waitFor(
      () => expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/cash-summary/form' })
      ),
      { timeout: 5000 }
    )
  })

  it('redirects to /cash-summary/report when user has report access but not form', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        access: { accounting: { cashSummary: { form: false, report: { value: true } } } },
      },
    })
    renderWithSuspense(<CashSummaryIndex />)
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/cash-summary/report' })
      )
    )
  })

  it('redirects to /no-access when user has no cash summary access', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        access: { accounting: { cashSummary: { form: false, report: { value: false } } } },
      },
    })
    renderWithSuspense(<CashSummaryIndex />)
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/no-access' })
    )
  })
})

// ─── Cash Summary Form — form.tsx ─────────────────────────────────────────────

describe('Cash Summary Form — form.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    global.fetch = makeOkFetch({})
    mockUseLoaderData.mockReturnValue({ existing: null, accessDenied: false })
    mockUseSearch.mockReturnValue({ site: 'Rankin', id: undefined })
    mockUseAuth.mockReturnValue({ user: { id: 'user-1', site: 'Rankin', access: {} } })
  })

  it('renders the SitePicker', async () => {
    renderWithSuspense(<CashSummaryForm />)
    await waitFor(
      () => expect(screen.getByTestId('site-picker')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders the "New Cash Summary" heading when no id is set', async () => {
    renderWithSuspense(<CashSummaryForm />)
    await waitFor(() =>
      expect(screen.getByText(/new cash summary/i)).toBeInTheDocument()
    )
  })

  it('renders the "Shift Number *" field', async () => {
    renderWithSuspense(<CashSummaryForm />)
    await waitFor(() =>
      expect(screen.getByText(/shift number \*/i)).toBeInTheDocument()
    )
  })

  it('renders the "Date *" field', async () => {
    renderWithSuspense(<CashSummaryForm />)
    await waitFor(() => expect(screen.getByText(/^Date \*$/i)).toBeInTheDocument())
  })

  it('renders the "Save" submit button when creating a new entry', async () => {
    renderWithSuspense(<CashSummaryForm />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
    )
  })

  it('shows a validation error when the form is submitted without a shift number', async () => {
    global.fetch = vi.fn() // should not be called
    renderWithSuspense(<CashSummaryForm />)

    const saveBtn = await waitFor(() => screen.getByRole('button', { name: /^save$/i }))
    // Use fireEvent.submit on the form to bypass HTML5 required-field validation
    fireEvent.submit(saveBtn.closest('form')!)

    await waitFor(() =>
      expect(screen.getByText(/shift number required/i)).toBeInTheDocument()
    )
  })

  it('navigates to /no-access when the POST returns 403', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 403, ok: false, json: () => Promise.resolve({}) })
    renderWithSuspense(<CashSummaryForm />)

    const saveBtn = await waitFor(() => screen.getByRole('button', { name: /^save$/i }))

    // Set a shift number so validation passes and the POST is actually sent
    const shiftInput = screen.getAllByRole('textbox')[0]
    fireEvent.change(shiftInput, { target: { value: 'SFT-001' } })
    fireEvent.click(saveBtn)

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/no-access' })
    )
  })

  it('shows "Edit Cash Summary" heading when an existing record is loaded', async () => {
    mockUseSearch.mockReturnValue({ site: 'Rankin', id: 'sum-1' })
    mockUseLoaderData.mockReturnValue({
      existing: {
        _id: 'sum-1',
        shift_number: 'SFT-001',
        date: '2026-03-10T00:00:00.000Z',
        canadian_cash_collected: 500,
      },
      accessDenied: false,
    })
    renderWithSuspense(<CashSummaryForm />)
    await waitFor(() =>
      expect(screen.getByText(/edit cash summary/i)).toBeInTheDocument()
    )
  })

  it('navigates to /no-access when accessDenied is true', async () => {
    mockUseLoaderData.mockReturnValue({ existing: null, accessDenied: true })
    renderWithSuspense(<CashSummaryForm />)
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/no-access' })
    )
  })
})

// ─── Cash Summary List — list.tsx ─────────────────────────────────────────────

describe('Cash Summary List — list.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseLoaderData.mockReturnValue({ summaries: [sampleSummary], accessDenied: false })
    mockUseSearch.mockReturnValue({ site: 'Rankin' })
  })

  it('renders the SitePicker', async () => {
    renderWithSuspense(<CashSummaryList />)
    await waitFor(
      () => expect(screen.getByTestId('site-picker')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders the "Cash Summaries" heading', async () => {
    renderWithSuspense(<CashSummaryList />)
    await waitFor(() =>
      expect(screen.getByText(/cash summaries/i)).toBeInTheDocument()
    )
  })

  it('shows "Select a site to view entries" when no site is selected', async () => {
    mockUseSearch.mockReturnValue({ site: '' })
    mockUseLoaderData.mockReturnValue({ summaries: [], accessDenied: false })
    renderWithSuspense(<CashSummaryList />)
    await waitFor(() =>
      expect(screen.getByText(/select a site to view entries/i)).toBeInTheDocument()
    )
  })

  it('shows "No summaries found" when the site is set but data is empty', async () => {
    mockUseLoaderData.mockReturnValue({ summaries: [], accessDenied: false })
    renderWithSuspense(<CashSummaryList />)
    await waitFor(() =>
      expect(screen.getByText(/no summaries found for this site/i)).toBeInTheDocument()
    )
  })

  it('displays the shift number when summaries data is present', async () => {
    renderWithSuspense(<CashSummaryList />)
    await waitFor(() =>
      expect(screen.getByText('SFT-001')).toBeInTheDocument()
    )
  })

  it('displays the table column headers', async () => {
    renderWithSuspense(<CashSummaryList />)
    await waitFor(() => {
      expect(screen.getByText('Shift')).toBeInTheDocument()
      expect(screen.getByText('Canadian Cash')).toBeInTheDocument()
    })
  })

  it('navigates to /no-access when accessDenied is true', async () => {
    mockUseLoaderData.mockReturnValue({ summaries: [], accessDenied: true })
    renderWithSuspense(<CashSummaryList />)
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/no-access' })
    )
  })
})

// ─── Cash Summary Report — report.tsx ─────────────────────────────────────────

describe('Cash Summary Report — report.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    global.fetch = makeOkFetch({})
    mockUseSearch.mockReturnValue({ site: 'Rankin', date: '2026-03-10' })
    mockUseLoaderData.mockReturnValue({ report: null, error: null, accessDenied: false })
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', site: 'Rankin', access: { accounting: { cashSummary: { report: { value: true } } } } },
    })
  })

  it('renders the SitePicker', async () => {
    renderWithSuspense(<CashSummaryReport />)
    await waitFor(
      () => expect(screen.getByTestId('site-picker')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders the Date input with the current date value', async () => {
    renderWithSuspense(<CashSummaryReport />)
    // The date input is pre-populated from the search param '2026-03-10'
    await waitFor(() =>
      expect(screen.getByDisplayValue('2026-03-10')).toBeInTheDocument()
    )
  })

  it('navigates to /no-access when accessDenied is true', async () => {
    mockUseLoaderData.mockReturnValue({ report: null, error: null, accessDenied: true })
    renderWithSuspense(<CashSummaryReport />)
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/no-access' })
    )
  })

  it('shows report data when a report is returned', async () => {
    mockUseLoaderData.mockReturnValue({
      report: {
        site: 'Rankin',
        date: '2026-03-10',
        rows: [
          { _id: 'r1', shift_number: 'SFT-001', canadian_cash_collected: 500 },
        ],
        totals: {
          count: 1,
          canadian_cash_collected: 500,
          item_sales: 0,
          cash_back: 0,
          loyalty: 0,
          cpl_bulloch: 0,
          exempted_tax: 0,
          report_canadian_cash: 0,
          payouts: 0,
        },
        report: { notes: '', submitted: false },
      },
      error: null,
      accessDenied: false,
    })
    renderWithSuspense(<CashSummaryReport />)
    await waitFor(() =>
      expect(screen.getByText('SFT-001')).toBeInTheDocument()
    )
  })
})
