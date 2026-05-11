import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ─── Hoisted mutable state ─────────────────────────────────────────────────────

const { mockNavigate, mockUseLoaderData, mockUseSearch } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseLoaderData: vi.fn().mockReturnValue({ site: '', date: '2026-03-15', data: null }),
  mockUseSearch: vi.fn().mockReturnValue({ site: '', date: '2026-03-15' }),
}))

// ─── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (config: any) => ({
      ...config,
      fullPath: '/_navbarLayout/cash-rec',
      id: '/_navbarLayout/cash-rec/',
      useSearch: mockUseSearch,
      useLoaderData: mockUseLoaderData,
    }),
    useNavigate: () => mockNavigate,
    useLoaderData: () => mockUseLoaderData(),
    useSearch: () => mockUseSearch(),
    Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  }
})

vi.mock('@/context/SiteContext', () => ({
  useSite: () => ({ selectedSite: '', setSelectedSite: vi.fn() }),
}))

vi.mock('@/components/custom/sitePicker', () => ({
  SitePicker: ({ onValueChange, value }: any) => (
    <button data-testid="site-picker" onClick={() => onValueChange('TestSite')}>
      {value || 'Pick a site'}
    </button>
  ),
}))

vi.mock('@/components/custom/datePicker', () => ({
  DatePicker: ({ date }: any) => (
    <div data-testid="date-picker">{date ? String(date) : 'no date'}</div>
  ),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, title }: any) => (
    <button onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  ),
}))

// ─── Component imports (after mocks) ──────────────────────────────────────────

import { Route as BankRoute } from '../cash-rec/bank'
import { Route as ReportRoute } from '../cash-rec/index'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const renderWithSuspense = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <React.Suspense fallback={null}>{children}</React.Suspense>
    ),
  })

const BankUpload = (BankRoute as any).component as React.ComponentType
const CashRecReport = (ReportRoute as any).component as React.ComponentType

// jsdom's File does not implement Blob.prototype.text() — polyfill it for each file
const makeFile = (content: string, name: string): File => {
  const file = new File([content], name, { type: 'text/plain' })
  Object.defineProperty(file, 'text', {
    value: () => Promise.resolve(content),
    configurable: true,
  })
  return file
}

// Minimal TTX file content with correct tab-delimited header that parseTtx can parse
const minimalTtx = [
  'Date\tDescription\tDebits\tCredits\tBalance',
  '26/03/15\tBalance Forward\t\t\t1000.00',
  '26/03/15\tNight Deposit\t\t500.00\t1500.00',
].join('\n')

// TTX with a GBL debit and a misc debit
const richTtx = [
  'Date\tDescription\tDebits\tCredits\tBalance',
  '26/03/15\tBalance Forward\t\t\t2000.00',
  '26/03/15\tNight Deposit\t\t800.00\t2800.00',
  '26/03/15\tTransfer To\t500.00\t\t2300.00',
  '26/03/15\tGBL Fuel Charges\t75.00\t\t2225.00',
  '26/03/15\tMisc Service Fee\t30.00\t\t2195.00',
  '26/03/16\tTNS Credit\t\t100.00\t2295.00',
].join('\n')

// Shared zero-value cash summary totals for report tests
const emptyTotals = {
  canadian_cash_collected: 0, item_sales: 0, cash_back: 0, loyalty: 0,
  cpl_bulloch: 0, exempted_tax: 0, report_canadian_cash: 0, payouts: 0,
  fuelSales: 0, dealGroupCplDiscounts: 0, fuelPriceOverrides: 0, parsedItemSales: 0,
  depositTotal: 0, pennyRounding: 0, totalSales: 0, afdCredit: 0, afdDebit: 0,
  afdGiftCard: 0, kioskCredit: 0, kioskDebit: 0, kioskGiftCard: 0, totalPos: 0,
  arIncurred: 0, grandTotal: 0, missedCpl: 0, couponsAccepted: 0, giftCertificates: 0,
  canadianCash: 0, cashOnHand: 0, parsedCashBack: 0, parsedPayouts: 0,
  safedropsCount: 0, safedropsAmount: 0,
}

const makeLoaderData = (overrides: any = {}) => ({
  site: 'Rankin',
  date: '2026-03-15',
  data: {
    kardpoll: null,
    bank: null,
    cashSummary: {
      site: 'Rankin',
      date: '2026-03-15',
      shiftCount: 2,
      unsettledPrepays: 0,
      handheldDebit: 0,
      totals: emptyTotals,
    },
    totalReceivablesAmount: 0,
    bankRec: 0,
    bankRecDay: 0,
    balanceCheck: 0,
    ...overrides,
  },
})

// Helper: simulate uploading a file via the hidden file input
const uploadFile = (file: File) => {
  const input = document.getElementById('ttx-input') as HTMLInputElement
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  fireEvent.change(input)
}

// ─── Bank Upload — bank.tsx ────────────────────────────────────────────────────

describe('Bank Upload — bank.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSearch.mockReturnValue({ site: '' })
    localStorage.setItem('token', 'test-token')
  })

  it('renders the drag-and-drop zone', async () => {
    renderWithSuspense(<BankUpload />)
    await waitFor(
      () => expect(screen.getByText(/drag and drop your \.ttx file/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders the hidden file input with the correct accept attribute', async () => {
    renderWithSuspense(<BankUpload />)
    await waitFor(() => expect(document.getElementById('ttx-input')).toBeInTheDocument(), { timeout: 5000 })
    const input = document.getElementById('ttx-input') as HTMLInputElement
    expect(input.accept).toBe('.ttx,.txt')
  })

  it('shows an error for a non-.ttx / non-.txt file', async () => {
    renderWithSuspense(<BankUpload />)
    await waitFor(() => expect(document.getElementById('ttx-input')).toBeInTheDocument(), { timeout: 5000 })

    uploadFile(new File(['data'], 'report.pdf', { type: 'application/pdf' }))

    await waitFor(() =>
      expect(screen.getByText(/please upload a \.ttx file/i)).toBeInTheDocument()
    )
  })

  it('does not show an error for a .txt file extension', async () => {
    renderWithSuspense(<BankUpload />)
    await waitFor(() => expect(document.getElementById('ttx-input')).toBeInTheDocument(), { timeout: 5000 })

    uploadFile(makeFile(minimalTtx, 'statement.txt'))

    // After a valid upload, error should NOT be the "wrong type" message
    await waitFor(() =>
      expect(screen.queryByText(/please upload a \.ttx file/i)).toBeNull()
    )
  })

  it('shows the Statement Date label after a valid TTX upload', async () => {
    renderWithSuspense(<BankUpload />)
    await waitFor(() => expect(document.getElementById('ttx-input')).toBeInTheDocument(), { timeout: 5000 })

    uploadFile(makeFile(minimalTtx, 'statement.ttx'))

    await waitFor(() =>
      expect(screen.getByText(/statement date/i)).toBeInTheDocument()
    )
  })

  it('shows the Balance Forward value from the parsed TTX', async () => {
    renderWithSuspense(<BankUpload />)
    await waitFor(() => expect(document.getElementById('ttx-input')).toBeInTheDocument(), { timeout: 5000 })

    uploadFile(makeFile(minimalTtx, 'statement.ttx'))

    await waitFor(() =>
      expect(screen.getByText('Balance Forward')).toBeInTheDocument()
    )
  })

  it('shows the merchant fees input after a valid TTX upload', async () => {
    renderWithSuspense(<BankUpload />)
    await waitFor(() => expect(document.getElementById('ttx-input')).toBeInTheDocument(), { timeout: 5000 })

    uploadFile(makeFile(minimalTtx, 'statement.ttx'))

    await waitFor(() =>
      expect(screen.getByPlaceholderText(/e\.g\. 12\.34/i)).toBeInTheDocument()
    )
  })

  it('shows a merchant fees validation error for non-numeric input', async () => {
    renderWithSuspense(<BankUpload />)
    await waitFor(() => expect(document.getElementById('ttx-input')).toBeInTheDocument(), { timeout: 5000 })

    uploadFile(makeFile(minimalTtx, 'statement.ttx'))
    await waitFor(() => screen.getByPlaceholderText(/e\.g\. 12\.34/i))

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 12\.34/i), { target: { value: 'abc' } })

    await waitFor(() =>
      expect(screen.getByText(/enter a number/i)).toBeInTheDocument()
    )
  })

  it('accepts zero as a valid merchant fees value', async () => {
    renderWithSuspense(<BankUpload />)
    await waitFor(() => expect(document.getElementById('ttx-input')).toBeInTheDocument(), { timeout: 5000 })

    uploadFile(makeFile(minimalTtx, 'statement.ttx'))
    await waitFor(() => screen.getByPlaceholderText(/e\.g\. 12\.34/i))

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 12\.34/i), { target: { value: '0' } })

    await waitFor(() =>
      expect(screen.queryByText(/enter a number/i)).not.toBeInTheDocument()
    )
  })

  it('does not show the Capture button when merchant fees are empty', async () => {
    mockUseSearch.mockReturnValue({ site: 'Rankin' })
    renderWithSuspense(<BankUpload />)
    await waitFor(() => expect(document.getElementById('ttx-input')).toBeInTheDocument(), { timeout: 5000 })

    uploadFile(makeFile(minimalTtx, 'statement.ttx'))
    await waitFor(() => screen.getByPlaceholderText(/e\.g\. 12\.34/i))

    // No merchant fees entered → Capture should not render
    expect(screen.queryByRole('button', { name: /capture/i })).toBeNull()
  })

  it('does not show the Capture button when site is missing even with valid fees', async () => {
    mockUseSearch.mockReturnValue({ site: '' })
    renderWithSuspense(<BankUpload />)
    await waitFor(() => expect(document.getElementById('ttx-input')).toBeInTheDocument(), { timeout: 5000 })

    uploadFile(makeFile(minimalTtx, 'statement.ttx'))
    await waitFor(() => screen.getByPlaceholderText(/e\.g\. 12\.34/i))

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 12\.34/i), { target: { value: '12.50' } })

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /capture/i })).toBeNull()
    )
  })

  it('shows the Capture button when site, valid TTX, and valid merchant fees are all present', async () => {
    mockUseSearch.mockReturnValue({ site: 'Rankin' })
    renderWithSuspense(<BankUpload />)
    await waitFor(() => expect(document.getElementById('ttx-input')).toBeInTheDocument(), { timeout: 5000 })

    uploadFile(makeFile(minimalTtx, 'statement.ttx'))
    await waitFor(() => screen.getByPlaceholderText(/e\.g\. 12\.34/i))

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 12\.34/i), { target: { value: '12.50' } })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /capture/i })).toBeInTheDocument()
    )
  })

  it('calls POST /api/cash-rec/bank-statement when Capture is clicked', async () => {
    mockUseSearch.mockReturnValue({ site: 'Rankin' })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ saved: true, upserted: true }),
    })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    renderWithSuspense(<BankUpload />)
    await waitFor(() => expect(document.getElementById('ttx-input')).toBeInTheDocument(), { timeout: 5000 })

    uploadFile(makeFile(minimalTtx, 'statement.ttx'))
    await waitFor(() => screen.getByPlaceholderText(/e\.g\. 12\.34/i))

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 12\.34/i), { target: { value: '12.50' } })
    const captureBtn = await waitFor(() => screen.getByRole('button', { name: /capture/i }))
    fireEvent.click(captureBtn)

    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls
      expect(calls.some((c: any[]) => c[0] === '/api/cash-rec/bank-statement')).toBe(true)
    })

    alertSpy.mockRestore()
  })

  it('sends the correct site and date in the Capture payload', async () => {
    mockUseSearch.mockReturnValue({ site: 'Rankin' })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ saved: true, upserted: true }),
    })

    renderWithSuspense(<BankUpload />)
    await waitFor(() => expect(document.getElementById('ttx-input')).toBeInTheDocument(), { timeout: 5000 })

    uploadFile(makeFile(minimalTtx, 'statement.ttx'))
    await waitFor(() => screen.getByPlaceholderText(/e\.g\. 12\.34/i))

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 12\.34/i), { target: { value: '9.99' } })
    const captureBtn = await waitFor(() => screen.getByRole('button', { name: /capture/i }))
    fireEvent.click(captureBtn)

    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls
      const bankCall = calls.find((c: any[]) => c[0] === '/api/cash-rec/bank-statement')
      expect(bankCall).toBeTruthy()
      const payload = JSON.parse(bankCall[1].body)
      expect(payload.site).toBe('Rankin')
      expect(payload.date).toBe('2026-03-15')
      expect(payload.merchantFees).toBe(9.99)
    })

    alertSpy.mockRestore()
  })

  it('shows GBL Debits section from a TTX containing GBL transactions', async () => {
    renderWithSuspense(<BankUpload />)
    await waitFor(() => expect(document.getElementById('ttx-input')).toBeInTheDocument(), { timeout: 5000 })

    uploadFile(makeFile(richTtx, 'statement.ttx'))

    await waitFor(() =>
      expect(screen.getByText('GBL Debits')).toBeInTheDocument()
    )
  })

  it('shows Misc Debits section', async () => {
    renderWithSuspense(<BankUpload />)
    await waitFor(() => expect(document.getElementById('ttx-input')).toBeInTheDocument(), { timeout: 5000 })

    uploadFile(makeFile(richTtx, 'statement.ttx'))

    await waitFor(() =>
      expect(screen.getByText(/misc debits/i)).toBeInTheDocument()
    )
  })

  it('shows Misc Credits section', async () => {
    renderWithSuspense(<BankUpload />)
    await waitFor(() => expect(document.getElementById('ttx-input')).toBeInTheDocument(), { timeout: 5000 })

    uploadFile(makeFile(richTtx, 'statement.ttx'))

    await waitFor(() =>
      expect(screen.getByText(/misc credits/i)).toBeInTheDocument()
    )
  })
})

// ─── Cash Rec Report — cash-rec/index.tsx ─────────────────────────────────────

describe('Cash Rec Report — index.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseLoaderData.mockReturnValue({ site: '', date: '2026-03-15', data: null })
    mockUseSearch.mockReturnValue({ site: '', date: '2026-03-15' })
  })

  it('renders the SitePicker', async () => {
    renderWithSuspense(<CashRecReport />)
    await waitFor(
      () => expect(screen.getByTestId('site-picker')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders the DatePicker', async () => {
    renderWithSuspense(<CashRecReport />)
    await waitFor(
      () => expect(screen.getByTestId('date-picker')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows "Pick a site to view report." when no site is selected', async () => {
    renderWithSuspense(<CashRecReport />)
    await waitFor(
      () => expect(screen.getByText(/pick a site to view report/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('does not show the report when data is null', async () => {
    mockUseLoaderData.mockReturnValue({ site: 'Rankin', date: '2026-03-15', data: null })
    mockUseSearch.mockReturnValue({ site: 'Rankin', date: '2026-03-15' })
    renderWithSuspense(<CashRecReport />)
    await waitFor(
      () => expect(screen.queryByText(/sales summary/i)).toBeNull(),
      { timeout: 5000 }
    )
  })

  it('shows the Sales Summary section when site and data are present', async () => {
    mockUseLoaderData.mockReturnValue(makeLoaderData())
    mockUseSearch.mockReturnValue({ site: 'Rankin', date: '2026-03-15' })
    renderWithSuspense(<CashRecReport />)
    await waitFor(
      () => expect(screen.getByText(/sales summary/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows the Deduction Summary section when site and data are present', async () => {
    mockUseLoaderData.mockReturnValue(makeLoaderData())
    mockUseSearch.mockReturnValue({ site: 'Rankin', date: '2026-03-15' })
    renderWithSuspense(<CashRecReport />)
    await waitFor(
      () => expect(screen.getByText(/deduction summary/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows the Export PDF button when site and data are present', async () => {
    mockUseLoaderData.mockReturnValue(makeLoaderData())
    mockUseSearch.mockReturnValue({ site: 'Rankin', date: '2026-03-15' })
    renderWithSuspense(<CashRecReport />)
    await waitFor(
      () => expect(screen.getByText(/export pdf/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows Kardpoll Sales row in Sales Summary', async () => {
    mockUseLoaderData.mockReturnValue(makeLoaderData({
      kardpoll: { site: 'Rankin', date: '2026-03-15', litresSold: 1000, sales: 1500, ar: 300 },
    }))
    mockUseSearch.mockReturnValue({ site: 'Rankin', date: '2026-03-15' })
    renderWithSuspense(<CashRecReport />)
    await waitFor(
      () => expect(screen.getByText(/kardpoll sales/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows Bank Rec row in Deduction Summary', async () => {
    mockUseLoaderData.mockReturnValue(makeLoaderData({ bankRec: -12.50 }))
    mockUseSearch.mockReturnValue({ site: 'Rankin', date: '2026-03-15' })
    renderWithSuspense(<CashRecReport />)
    await waitFor(
      () => expect(screen.getByText(/bank rec/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows the AR Transactions section when kardpollEntriesRows are present', async () => {
    mockUseLoaderData.mockReturnValue(makeLoaderData({
      kardpollEntriesRows: [
        { customer: 'ACME Corp', card: '123456789012', amount: 250, quantity: 100, price_per_litre: 2.50 },
      ],
    }))
    mockUseSearch.mockReturnValue({ site: 'Rankin', date: '2026-03-15' })
    renderWithSuspense(<CashRecReport />)
    await waitFor(
      () => expect(screen.getByText('ACME Corp')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows the receivables customer when receivablesRows are present', async () => {
    mockUseLoaderData.mockReturnValue(makeLoaderData({
      receivablesRows: [
        { amount: 150, customerName: 'Beta Fleet', poNumber: 'PO-001' },
      ],
      totalReceivablesAmount: 150,
    }))
    mockUseSearch.mockReturnValue({ site: 'Rankin', date: '2026-03-15' })
    renderWithSuspense(<CashRecReport />)
    await waitFor(
      () => expect(screen.getByText('Beta Fleet')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows the payables section when payablesRows are present', async () => {
    mockUseLoaderData.mockReturnValue(makeLoaderData({
      payablesRows: [
        {
          amount: 80,
          paymentMethod: 'till',
          vendorName: 'Ace Supplier',
          location: { name: 'Rankin' },
        },
      ],
    }))
    mockUseSearch.mockReturnValue({ site: 'Rankin', date: '2026-03-15' })
    renderWithSuspense(<CashRecReport />)
    await waitFor(
      () => expect(screen.getByText('Ace Supplier')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows the bank statement details when bank data is present', async () => {
    mockUseLoaderData.mockReturnValue(makeLoaderData({
      bank: {
        site: 'Rankin',
        date: '2026-03-16',
        balanceForward: 1000,
        nightDeposit: 500,
        transferTo: 0,
        endingBalance: 1500,
        miscDebits: [],
        miscCredits: [],
        gblDebits: [],
        gblCredits: [],
        merchantFees: 12.50,
      },
      bankStmtTrans: 987.50,
    }))
    mockUseSearch.mockReturnValue({ site: 'Rankin', date: '2026-03-15' })
    renderWithSuspense(<CashRecReport />)
    await waitFor(
      () => expect(screen.getByText(/opening balance/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })
})
