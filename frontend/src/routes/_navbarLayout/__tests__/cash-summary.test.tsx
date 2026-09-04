import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockNavigate, mockUseLoaderData, mockUseSearch, mockUseAuth, mockUseSite } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseLoaderData: vi.fn().mockReturnValue({}),
  mockUseSearch: vi.fn().mockReturnValue({ site: 'Rankin', date: '2026-03-10' }),
  mockUseAuth: vi.fn().mockReturnValue({
    user: {
      id: 'user-1',
      location: 'Rankin',
      access: {
        accounting: {
          cashSummary: {
            form: true,
            list: true,
            report: { value: true, viewShiftReport: true, unlockShift: true },
          },
        },
      },
    },
  }),
  mockUseSite: vi.fn().mockReturnValue({ selectedSite: '', setSelectedSite: vi.fn() }),
}))

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
  useSite: () => mockUseSite(),
}))

vi.mock('@/components/custom/sitePicker', () => ({
  SitePicker: ({ onValueChange, value }: any) => (
    <button data-testid="site-picker" type="button" onClick={() => onValueChange('TestSite')}>
      {value || 'Pick a site'}
    </button>
  ),
}))

vi.mock('@/components/custom/datePicker', () => ({
  DatePicker: ({ date, setDate }: any) => {
    const value = date
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      : ''
    return (
      <input
        data-testid="date-picker"
        type="date"
        value={value}
        onChange={(e) => {
          if (!e.target.value) return
          const [y, m, d] = e.target.value.split('-').map(Number)
          setDate?.(new Date(y, m - 1, d, 0, 0, 0, 0))
        }}
        readOnly={!setDate}
      />
    )
  },
}))

vi.mock('@/components/custom/LotteryComparisionTable', () => ({
  LotteryComparisonTable: () => <div data-testid="lottery-table" />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, asChild, ...props }: any) =>
    asChild && React.isValidElement(children)
      ? React.cloneElement(children, props)
      : <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <>{children}</>,
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, disabled, onCheckedChange }: any) => (
    <button
      aria-pressed={checked}
      disabled={disabled}
      type="button"
      onClick={() => onCheckedChange?.(!checked)}
    >
      switch
    </button>
  ),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('lucide-react', () => {
  const Icon = (props: any) => <svg data-testid="icon" {...props} />
  return {
    AlertCircle: Icon,
    AlertTriangle: Icon,
    ArrowRight: Icon,
    Calendar: Icon,
    CheckCircle2: Icon,
    ChevronDown: Icon,
    ChevronRight: Icon,
    HelpCircle: Icon,
    Image: Icon,
    ImagePlus: Icon,
    Info: Icon,
    Lock: Icon,
    Trash2: Icon,
  }
})

import { Route as IndexRoute } from '../cash-summary/index'
import { Route as FormRoute } from '../cash-summary/form'
import { Route as ListRoute } from '../cash-summary/list'
import { Route as ReportRoute } from '../cash-summary/report'

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

const okResponse = (data: any) => ({
  status: 200,
  ok: true,
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
})

type TestShift = {
  _id: string
  site: string
  shift_number: string
  date: string
  canadian_cash_collected?: number
  exempted_tax?: number
  reviewed?: boolean
}

const sampleShift: TestShift = {
  _id: 'shift-1',
  site: 'Rankin',
  shift_number: '10001',
  date: '2026-03-10T00:00:00.000Z',
  canadian_cash_collected: 500,
  exempted_tax: 12.5,
  reviewed: false,
}

const sampleDailySummary = {
  date: '2026-03-10',
  shift_numbers: ['10001', '10002'],
  canadian_cash_collected: 500,
  item_sales: 250,
  cash_back: 20,
  loyalty: 10,
  cpl_bulloch: 5,
  exempted_tax: 12.5,
  allReviewed: false,
  isSubmitted: false,
}

const sampleReport = {
  site: 'Rankin',
  date: '2026-03-10',
  rows: [
    {
      _id: 'r1',
      shift_number: '10001',
      canadian_cash_collected: 500,
      report_canadian_cash: 475,
      payouts: 25,
    },
  ],
  totals: {
    count: 1,
    canadian_cash_collected: 500,
    item_sales: 250,
    cash_back: 20,
    loyalty: 10,
    cpl_bulloch: 5,
    exempted_tax: 12.5,
    report_canadian_cash: 475,
    payouts: 25,
    voidedTransactionsAmount: 0,
  },
  report: { notes: '', submitted: false },
  readiness: {
    canViewReport: true,
    shiftIssues: {
      hasShifts: true,
      missingCashShiftNumbers: [],
      unreviewedShiftNumbers: [],
    },
    lotteryIssue: { sellsLottery: false, hasLottery: false },
  },
}

const mockFormFetch = (shifts: TestShift[] = [sampleShift], extraLocation = {}) => {
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.startsWith('/api/locations')) {
      return Promise.resolve(okResponse({ sellsLottery: false, chickenDelightSection: false, ...extraLocation }))
    }
    if (url.startsWith('/api/cash-summary/by-date')) {
      return Promise.resolve(okResponse({ shifts, isSubmitted: false }))
    }
    if (url.startsWith('/api/cash-summary/batch')) {
      return Promise.resolve(okResponse({ ok: true }))
    }
    return Promise.resolve(okResponse({}))
  }) as any
}

const mockReportFetch = () => {
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.startsWith('/api/cash-summary/ar-check')) {
      return Promise.resolve(okResponse({ match: true, arIncurredTotal: 0, transactionsTotal: 0 }))
    }
    if (url.startsWith('/api/cash-summary/payouts-check')) {
      return Promise.resolve(okResponse({ match: true }))
    }
    if (url.startsWith('/api/cash-summary/lottery')) {
      return Promise.resolve(okResponse({ lottery: null, totals: null }))
    }
    return Promise.resolve(okResponse({ province: 'Ontario' }))
  }) as any
}

describe('Cash Summary Index - index.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to the form when user has form access', async () => {
    mockUseAuth.mockReturnValue({ user: { access: { accounting: { cashSummary: { form: true } } } } })
    renderWithSuspense(<CashSummaryIndex />)
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/cash-summary/form' })),
    )
  })

  it('redirects to the report when user has report access but no form access', async () => {
    mockUseAuth.mockReturnValue({
      user: { access: { accounting: { cashSummary: { form: false, report: { value: true } } } } },
    })
    renderWithSuspense(<CashSummaryIndex />)
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/cash-summary/report' })),
    )
  })

  it('redirects to /no-access when user has no cash summary access', async () => {
    mockUseAuth.mockReturnValue({
      user: { access: { accounting: { cashSummary: { form: false, report: { value: false } } } } },
    })
    renderWithSuspense(<CashSummaryIndex />)
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/no-access' }))
  })
})

describe('Cash Summary Form - form.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockUseSearch.mockReturnValue({ site: 'Rankin', date: '2026-03-10' })
    mockUseSite.mockReturnValue({ selectedSite: '', setSelectedSite: vi.fn() })
    mockFormFetch()
  })

  it('renders site and date controls', async () => {
    renderWithSuspense(<CashSummaryForm />)
    await waitFor(() => expect(screen.getByTestId('site-picker')).toHaveTextContent('Rankin'))
    expect(screen.getByTestId('date-picker')).toHaveValue('2026-03-10')
  })

  it('renders loaded shifts in the batch form', async () => {
    renderWithSuspense(<CashSummaryForm />)
    await waitFor(() => expect(screen.getByText('Select Shift to Fill')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /shift #10001/i })).toBeInTheDocument()
    expect(screen.getByText(/editing details: shift #10001/i)).toBeInTheDocument()
    expect(screen.getByText(/canadian cash collected \*/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save all shifts data/i })).toBeInTheDocument()
  })

  it('shows the empty state when no pre-registered shifts are returned', async () => {
    mockFormFetch([])
    renderWithSuspense(<CashSummaryForm />)
    await waitFor(() =>
      expect(screen.getByText(/no pre-registered shifts found for this site on selected date/i)).toBeInTheDocument(),
    )
  })

  it('requires cash collected before batch submit', async () => {
    mockFormFetch([{ ...sampleShift, canadian_cash_collected: undefined }])
    renderWithSuspense(<CashSummaryForm />)
    const submit = await screen.findByRole('button', { name: /save all shifts data/i })
    fireEvent.click(submit)
    await waitFor(() =>
      expect(screen.getByText(/shift #10001: cash collected is required/i)).toBeInTheDocument(),
    )
  })

  it('submits all loaded shift forms and navigates to the report', async () => {
    renderWithSuspense(<CashSummaryForm />)
    const submit = await screen.findByRole('button', { name: /save all shifts data/i })
    fireEvent.click(submit)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/cash-summary/batch',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/cash-summary/report',
        search: { site: 'Rankin', date: '2026-03-10' },
      })
    })
  })

  it('locks submit when the day report is submitted', async () => {
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('/api/locations')) return Promise.resolve(okResponse({}))
      if (url.startsWith('/api/cash-summary/by-date')) {
        return Promise.resolve(okResponse({ shifts: [sampleShift], isSubmitted: true }))
      }
      return Promise.resolve(okResponse({}))
    }) as any

    renderWithSuspense(<CashSummaryForm />)
    await waitFor(() => expect(screen.getByText('Report Submitted')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /report submitted/i })).toBeDisabled()
  })
})

describe('Cash Summary List - list.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-02-10', to: '2026-03-10' })
    mockUseSite.mockReturnValue({ selectedSite: '', setSelectedSite: vi.fn() })
    mockUseLoaderData.mockReturnValue({ summaries: [sampleDailySummary], accessDenied: false })
  })

  it('renders filters and grouped daily cash summaries', async () => {
    renderWithSuspense(<CashSummaryList />)
    await waitFor(() => expect(screen.getByText(/daily cash summaries/i)).toBeInTheDocument())
    expect(screen.getByTestId('site-picker')).toHaveTextContent('Rankin')
    expect(screen.getAllByTestId('date-picker')[0]).toHaveValue('2026-02-10')
    expect(screen.getAllByTestId('date-picker')[1]).toHaveValue('2026-03-10')
    expect(screen.getByText('2026-03-10')).toBeInTheDocument()
    expect(screen.getByText('#10001')).toBeInTheDocument()
    expect(screen.getByText('#10002')).toBeInTheDocument()
    expect(screen.getByText(/pending attention/i)).toBeInTheDocument()
  })

  it('shows the no-site empty state', async () => {
    mockUseSearch.mockReturnValue({ site: '', from: '2026-02-10', to: '2026-03-10' })
    mockUseLoaderData.mockReturnValue({ summaries: [], accessDenied: false })
    renderWithSuspense(<CashSummaryList />)
    await waitFor(() =>
      expect(screen.getByText(/please select a site above to display cash summaries/i)).toBeInTheDocument(),
    )
  })

  it('shows the no-entries state for an empty date range', async () => {
    mockUseLoaderData.mockReturnValue({ summaries: [], accessDenied: false })
    renderWithSuspense(<CashSummaryList />)
    await waitFor(() => expect(screen.getByText(/no entries found for the selected date range/i)).toBeInTheDocument())
  })

  it('navigates to the form when an unlocked day row is clicked', async () => {
    renderWithSuspense(<CashSummaryList />)
    fireEvent.click(await screen.findByText('2026-03-10'))
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/cash-summary/form',
      search: { site: 'Rankin', date: '2026-03-10' },
    })
  })

  it('does not navigate from submitted rows', async () => {
    mockUseLoaderData.mockReturnValue({
      summaries: [{ ...sampleDailySummary, isSubmitted: true, allReviewed: true }],
      accessDenied: false,
    })
    renderWithSuspense(<CashSummaryList />)
    fireEvent.click(await screen.findByText('2026-03-10'))
    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: '/cash-summary/form' }),
    )
    expect(screen.getByText(/locked & submitted/i)).toBeInTheDocument()
  })

  it('navigates to /no-access when accessDenied is true', async () => {
    mockUseLoaderData.mockReturnValue({ summaries: [], accessDenied: true })
    renderWithSuspense(<CashSummaryList />)
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/no-access' }))
  })
})

describe('Cash Summary Report - report.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockUseSearch.mockReturnValue({ site: 'Rankin', date: '2026-03-10' })
    mockUseLoaderData.mockReturnValue({
      report: sampleReport,
      error: null,
      accessDenied: false,
      isManitoba: false,
    })
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-1',
        access: {
          accounting: {
            cashSummary: {
              report: { value: true, viewShiftReport: true, unlockShift: true },
            },
          },
        },
      },
    })
    mockReportFetch()
  })

  it('renders filters and the cash summary report shell', async () => {
    renderWithSuspense(<CashSummaryReport />)
    await waitFor(() => expect(screen.getByText('Cash Summary Report')).toBeInTheDocument())
    expect(screen.getByTestId('site-picker')).toHaveTextContent('Rankin')
    expect(screen.getByTestId('date-picker')).toHaveValue('2026-03-10')
    expect(screen.getByText(/site:/i)).toBeInTheDocument()
  })

  it('shows standard totals and shift cards when report data is ready', async () => {
    renderWithSuspense(<CashSummaryReport />)
    await waitFor(() => expect(screen.getByText('Standard Totals')).toBeInTheDocument())
    expect(screen.getByText('Total Canadian Cash Counted')).toBeInTheDocument()
    expect(screen.getAllByText('500.00').length).toBeGreaterThan(0)
    expect(screen.getByText('Shifts')).toBeInTheDocument()
    expect(screen.getByText('10001')).toBeInTheDocument()
    expect(screen.getByText('Notes')).toBeInTheDocument()
  })

  it('shows the shift prerequisite overlay when shift review blocks the report', async () => {
    mockUseLoaderData.mockReturnValue({
      report: {
        ...sampleReport,
        readiness: {
          canViewReport: false,
          shiftIssues: {
            hasShifts: true,
            missingCashShiftNumbers: [],
            unreviewedShiftNumbers: ['10001'],
          },
          lotteryIssue: { sellsLottery: false, hasLottery: false },
        },
      },
      error: null,
      accessDenied: false,
      isManitoba: false,
    })
    renderWithSuspense(<CashSummaryReport />)
    await waitFor(() => expect(screen.getByText(/shift data needs review/i)).toBeInTheDocument())
    expect(screen.getByText(/shifts left to review/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /go to form/i }))
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/cash-summary/form',
      search: { site: 'Rankin', date: '2026-03-10' },
    })
  })

  it('shows the lottery prerequisite overlay when lottery data blocks the report', async () => {
    mockUseLoaderData.mockReturnValue({
      report: {
        ...sampleReport,
        readiness: {
          canViewReport: false,
          shiftIssues: {
            hasShifts: true,
            missingCashShiftNumbers: [],
            unreviewedShiftNumbers: [],
          },
          lotteryIssue: { sellsLottery: true, hasLottery: false },
        },
      },
      error: null,
      accessDenied: false,
      isManitoba: false,
    })
    renderWithSuspense(<CashSummaryReport />)
    await waitFor(() => expect(screen.getByText(/lottery data is missing/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /go to lottery/i }))
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/cash-summary/lottery',
      search: { site: 'Rankin', date: '2026-03-10' },
    })
  })

  it('navigates to /no-access when accessDenied is true', async () => {
    mockUseLoaderData.mockReturnValue({ report: null, error: null, accessDenied: true, isManitoba: false })
    renderWithSuspense(<CashSummaryReport />)
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/no-access' }))
  })
})
