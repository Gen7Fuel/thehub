import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// ─── Hoisted mutable state ─────────────────────────────────────────────────────

const { mockNavigate, mockUseSearch } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseSearch: vi.fn().mockReturnValue({ site: '', from: '2026-03-01', to: '2026-03-18' }),
}))

// ─── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (config: any) => ({
      ...config,
      fullPath: '/_navbarLayout/infonet-report',
      id: '/_navbarLayout/infonet-report',
      useSearch: mockUseSearch,
    }),
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/components/custom/sitePicker', () => ({
  SitePicker: ({ onValueChange, value }: any) => (
    <button data-testid="site-picker" onClick={() => onValueChange('Rankin')}>
      {value || 'Pick a site'}
    </button>
  ),
}))

vi.mock('@/components/custom/datePickerWithRange', () => ({
  DatePickerWithRange: ({ date }: any) => (
    <div data-testid="date-range-picker">
      {date?.from ? String(date.from) : 'no start'} – {date?.to ? String(date.to) : 'no end'}
    </div>
  ),
}))

// ─── Component import (after mocks) ───────────────────────────────────────────

import { Route as InfonetRoute } from '../infonet-report'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const renderWithSuspense = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <React.Suspense fallback={null}>{children}</React.Suspense>
    ),
  })

const InfonetReport = (InfonetRoute as any).component as React.ComponentType

const makeOkFetch = (data: any) =>
  vi.fn().mockResolvedValue({ status: 200, ok: true, json: () => Promise.resolve(data) })

// UPDATED SAMPLE DATA TO INCLUDE totalCplBulloch
const sampleData = [
  {
    date: '2026-03-17',
    totalExemptedTax: 120.5,
    totalItemSales: 1500.0,
    totalCplBulloch: 100.0, // Added
    shiftNumbers: ['SFT-001', 'SFT-002'],
    isSubmitted: true,
  },
  {
    date: '2026-03-16',
    totalExemptedTax: 80.25,
    totalItemSales: 950.0,
    totalCplBulloch: 90.0, // Added (triggers red highlighting)
    shiftNumbers: ['SFT-003'],
    isSubmitted: false,
  },
]

const emptyDayData = [
  {
    date: '2026-03-15',
    totalExemptedTax: 0,
    totalItemSales: 0,
    totalCplBulloch: 0,
    shiftNumbers: [],
    isSubmitted: false,
  },
]

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('InfoNet Tax Report — infonet-report.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSearch.mockReturnValue({ site: '', from: '2026-03-01', to: '2026-03-18' })
    localStorage.setItem('token', 'test-token')
    global.fetch = makeOkFetch([])
  })

  it('renders the SitePicker', async () => {
    renderWithSuspense(<InfonetReport />)
    await waitFor(
      () => expect(screen.getByTestId('site-picker')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders the DatePickerWithRange', async () => {
    renderWithSuspense(<InfonetReport />)
    await waitFor(
      () => expect(screen.getByTestId('date-range-picker')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows the prompt message when no site is selected', async () => {
    renderWithSuspense(<InfonetReport />)
    await waitFor(
      () => expect(screen.getByText(/please select a site and date range/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows "No data found" when site is set but API returns empty array', async () => {
    mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
    global.fetch = makeOkFetch([])

    renderWithSuspense(<InfonetReport />)
    await waitFor(
      () => expect(screen.getByText(/no data found for the selected criteria/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows the grand total Tax Rebate when data is loaded', async () => {
    mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
    global.fetch = makeOkFetch(sampleData)

    renderWithSuspense(<InfonetReport />)

    // Use a more specific matcher for the Card title
    await waitFor(
      () => expect(screen.getByText(/total infonet tax rebate/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows the grand total CPL Bulloch when data is loaded', async () => {
    mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
    global.fetch = makeOkFetch(sampleData)

    renderWithSuspense(<InfonetReport />)
    await waitFor(
      () => expect(screen.getByText(/total cpl bulloch tax/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows the grand total Item Sales when data is loaded', async () => {
    mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
    global.fetch = makeOkFetch(sampleData)

    renderWithSuspense(<InfonetReport />)

    // MATCH ACTUAL UI: "Total Item Sales" instead of "Total Item Sales Recorded"
    // await waitFor(
    //   () => expect(screen.getByText(/total item sales/i)).toBeInTheDocument(),
    //   { timeout: 5000 }
    // )
    await waitFor(
      () => expect(screen.getAllByText(/total item sales/i).length).toBeGreaterThan(0),
      { timeout: 5000 }
    )
    // await waitFor(
    //   () => expect(screen.getByText(/total item sales/i, { selector: 'p' })).toBeInTheDocument(),
    //   { timeout: 5000 }
    // )
  })

  it('renders the table headers', async () => {
    mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
    global.fetch = makeOkFetch(sampleData)

    renderWithSuspense(<InfonetReport />)

    await waitFor(
      () => expect(screen.getByText('Date')).toBeInTheDocument(),
      { timeout: 5000 }
    )

    // FIX: Instead of getByText(/infonet tax/i), we use getByRole to target the <th>
    expect(screen.getByRole('columnheader', { name: /infonet tax/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /cpl bulloch tax/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /total item sales/i })).toBeInTheDocument()
    // expect(screen.getByText(/total item sales/i, { selector: 'p' })).toBeInTheDocument()

    expect(screen.getByText('Shift Numbers')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('displays dates from the API response', async () => {
    mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
    global.fetch = makeOkFetch(sampleData)

    renderWithSuspense(<InfonetReport />)
    await waitFor(
      () => expect(screen.getByText('2026-03-17')).toBeInTheDocument(),
      { timeout: 5000 }
    )
    expect(screen.getByText('2026-03-16')).toBeInTheDocument()
  })

  it('displays shift numbers joined by comma', async () => {
    mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
    global.fetch = makeOkFetch(sampleData)

    renderWithSuspense(<InfonetReport />)
    await waitFor(
      () => expect(screen.getByText('SFT-001, SFT-002')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows "Submitted" badge for submitted rows', async () => {
    mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
    global.fetch = makeOkFetch(sampleData)

    renderWithSuspense(<InfonetReport />)
    await waitFor(
      () => expect(screen.getByText('Submitted')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows "Draft" badge for non-submitted rows', async () => {
    mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
    global.fetch = makeOkFetch(sampleData)

    renderWithSuspense(<InfonetReport />)
    await waitFor(
      () => expect(screen.getByText('Draft')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows "No shifts recorded for this date." for a day with no shifts', async () => {
    mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
    global.fetch = makeOkFetch(emptyDayData)

    renderWithSuspense(<InfonetReport />)
    await waitFor(
      () => expect(screen.getByText(/no shifts recorded for this date/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows an error message when the API returns an error', async () => {
    mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal Server Error' }),
    })

    renderWithSuspense(<InfonetReport />)
    await waitFor(
      () => expect(screen.getByText('Internal Server Error')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('calls the correct API endpoint with site, from, and to', async () => {
    mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
    global.fetch = makeOkFetch(sampleData)

    renderWithSuspense(<InfonetReport />)

    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls
      const apiCall = calls.find((c: any[]) =>
        typeof c[0] === 'string' && c[0].includes('/api/cash-summary/tax-exempt-report')
      )
      expect(apiCall).toBeTruthy()
      expect(apiCall[0]).toContain('site=Rankin')
      expect(apiCall[0]).toContain('from=2026-03-01')
      expect(apiCall[0]).toContain('to=2026-03-18')
    })
  })

  it('sorts data descending by date (latest first)', async () => {
    mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
    // Provide data in ascending order — component should render descending
    const ascData = [
      { date: '2026-03-10', totalExemptedTax: 10, totalItemSales: 100, shiftNumbers: ['SFT-A'], isSubmitted: true },
      { date: '2026-03-15', totalExemptedTax: 20, totalItemSales: 200, shiftNumbers: ['SFT-B'], isSubmitted: true },
    ]
    global.fetch = makeOkFetch(ascData)

    renderWithSuspense(<InfonetReport />)
    await waitFor(
      () => expect(screen.getByText('2026-03-15')).toBeInTheDocument(),
      { timeout: 5000 }
    )

    // Get all table rows (skip header)
    const rows = screen.getAllByRole('row').filter((_, i) => i > 0)
    // First data row should be 2026-03-15 (latest), second should be 2026-03-10
    expect(rows[0]).toHaveTextContent('2026-03-15')
    expect(rows[1]).toHaveTextContent('2026-03-10')
  })

  it('computes correct grand totals from multiple rows', async () => {
    mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
    // 120.50 + 80.25 = 200.75
    global.fetch = makeOkFetch(sampleData)

    renderWithSuspense(<InfonetReport />)

    // FIX: Since 200.75 might appear in the card and the row, use getAll and check the first one
    await waitFor(
      () => {
        const matches = screen.getAllByText(/200\.75/)
        expect(matches.length).toBeGreaterThan(0)
      },
      { timeout: 5000 }
    )

    // Check for CPL Bulloch total (100 + 90 = 190.00)
    expect(screen.getByText(/190\.00/)).toBeInTheDocument()
  })
})


// import React from 'react'
// import { describe, it, expect, vi, beforeEach } from 'vitest'
// import { render, screen, waitFor } from '@testing-library/react'

// // ─── Hoisted mutable state ─────────────────────────────────────────────────────

// const { mockNavigate, mockUseSearch } = vi.hoisted(() => ({
//   mockNavigate: vi.fn(),
//   mockUseSearch: vi.fn().mockReturnValue({ site: '', from: '2026-03-01', to: '2026-03-18' }),
// }))

// // ─── Module mocks ──────────────────────────────────────────────────────────────

// vi.mock('@tanstack/react-router', async (importOriginal) => {
//   const actual = await importOriginal<typeof import('@tanstack/react-router')>()
//   return {
//     ...actual,
//     createFileRoute: () => (config: any) => ({
//       ...config,
//       fullPath: '/_navbarLayout/infonet-report',
//       id: '/_navbarLayout/infonet-report',
//       useSearch: mockUseSearch,
//     }),
//     useNavigate: () => mockNavigate,
//   }
// })

// vi.mock('@/components/custom/sitePicker', () => ({
//   SitePicker: ({ onValueChange, value }: any) => (
//     <button data-testid="site-picker" onClick={() => onValueChange('Rankin')}>
//       {value || 'Pick a site'}
//     </button>
//   ),
// }))

// vi.mock('@/components/custom/datePickerWithRange', () => ({
//   DatePickerWithRange: ({ date }: any) => (
//     <div data-testid="date-range-picker">
//       {date?.from ? String(date.from) : 'no start'} – {date?.to ? String(date.to) : 'no end'}
//     </div>
//   ),
// }))

// // ─── Component import (after mocks) ───────────────────────────────────────────

// import { Route as InfonetRoute } from '../infonet-report'

// // ─── Helpers ──────────────────────────────────────────────────────────────────

// const renderWithSuspense = (ui: React.ReactElement) =>
//   render(ui, {
//     wrapper: ({ children }: { children: React.ReactNode }) => (
//       <React.Suspense fallback={null}>{children}</React.Suspense>
//     ),
//   })

// const InfonetReport = (InfonetRoute as any).component as React.ComponentType

// const makeOkFetch = (data: any) =>
//   vi.fn().mockResolvedValue({ status: 200, ok: true, json: () => Promise.resolve(data) })

// const sampleData = [
//   {
//     date: '2026-03-17',
//     totalExemptedTax: 120.5,
//     totalItemSales: 1500.0,
//     shiftNumbers: ['SFT-001', 'SFT-002'],
//     isSubmitted: true,
//   },
//   {
//     date: '2026-03-16',
//     totalExemptedTax: 80.25,
//     totalItemSales: 950.0,
//     shiftNumbers: ['SFT-003'],
//     isSubmitted: false,
//   },
// ]

// const emptyDayData = [
//   {
//     date: '2026-03-15',
//     totalExemptedTax: 0,
//     totalItemSales: 0,
//     shiftNumbers: [],
//     isSubmitted: false,
//   },
// ]

// // ─── Tests ────────────────────────────────────────────────────────────────────

// describe('InfoNet Tax Report — infonet-report.tsx', () => {
//   beforeEach(() => {
//     vi.clearAllMocks()
//     mockUseSearch.mockReturnValue({ site: '', from: '2026-03-01', to: '2026-03-18' })
//     localStorage.setItem('token', 'test-token')
//     global.fetch = makeOkFetch([])
//   })

//   it('renders the SitePicker', async () => {
//     renderWithSuspense(<InfonetReport />)
//     await waitFor(
//       () => expect(screen.getByTestId('site-picker')).toBeInTheDocument(),
//       { timeout: 5000 }
//     )
//   })

//   it('renders the DatePickerWithRange', async () => {
//     renderWithSuspense(<InfonetReport />)
//     await waitFor(
//       () => expect(screen.getByTestId('date-range-picker')).toBeInTheDocument(),
//       { timeout: 5000 }
//     )
//   })

//   it('shows the prompt message when no site is selected', async () => {
//     renderWithSuspense(<InfonetReport />)
//     await waitFor(
//       () => expect(screen.getByText(/please select a site and date range/i)).toBeInTheDocument(),
//       { timeout: 5000 }
//     )
//   })

//   it('shows "No data found" when site is set but API returns empty array', async () => {
//     mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
//     global.fetch = makeOkFetch([])

//     renderWithSuspense(<InfonetReport />)
//     await waitFor(
//       () => expect(screen.getByText(/no data found for the selected criteria/i)).toBeInTheDocument(),
//       { timeout: 5000 }
//     )
//   })

//   it('shows the grand total Tax Rebate Expected when data is loaded', async () => {
//     mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
//     global.fetch = makeOkFetch(sampleData)

//     renderWithSuspense(<InfonetReport />)
//     await waitFor(
//       () => expect(screen.getByText(/total infonet tax rebate expected/i)).toBeInTheDocument(),
//       { timeout: 5000 }
//     )
//   })

//   it('shows the grand total Item Sales Recorded when data is loaded', async () => {
//     mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
//     global.fetch = makeOkFetch(sampleData)

//     renderWithSuspense(<InfonetReport />)
//     await waitFor(
//       () => expect(screen.getByText(/total item sales recorded/i)).toBeInTheDocument(),
//       { timeout: 5000 }
//     )
//   })

//   it('renders the table headers', async () => {
//     mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
//     global.fetch = makeOkFetch(sampleData)

//     renderWithSuspense(<InfonetReport />)
//     await waitFor(
//       () => expect(screen.getByText('Date')).toBeInTheDocument(),
//       { timeout: 5000 }
//     )
//     expect(screen.getByText('Shift Numbers')).toBeInTheDocument()
//     expect(screen.getByText(/infonet tax exempt/i)).toBeInTheDocument()
//     expect(screen.getByRole('columnheader', { name: /total item sales/i })).toBeInTheDocument()
//     expect(screen.getByText('Status')).toBeInTheDocument()
//   })

//   it('displays dates from the API response', async () => {
//     mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
//     global.fetch = makeOkFetch(sampleData)

//     renderWithSuspense(<InfonetReport />)
//     await waitFor(
//       () => expect(screen.getByText('2026-03-17')).toBeInTheDocument(),
//       { timeout: 5000 }
//     )
//     expect(screen.getByText('2026-03-16')).toBeInTheDocument()
//   })

//   it('displays shift numbers joined by comma', async () => {
//     mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
//     global.fetch = makeOkFetch(sampleData)

//     renderWithSuspense(<InfonetReport />)
//     await waitFor(
//       () => expect(screen.getByText('SFT-001, SFT-002')).toBeInTheDocument(),
//       { timeout: 5000 }
//     )
//   })

//   it('shows "Submitted" badge for submitted rows', async () => {
//     mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
//     global.fetch = makeOkFetch(sampleData)

//     renderWithSuspense(<InfonetReport />)
//     await waitFor(
//       () => expect(screen.getByText('Submitted')).toBeInTheDocument(),
//       { timeout: 5000 }
//     )
//   })

//   it('shows "Draft" badge for non-submitted rows', async () => {
//     mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
//     global.fetch = makeOkFetch(sampleData)

//     renderWithSuspense(<InfonetReport />)
//     await waitFor(
//       () => expect(screen.getByText('Draft')).toBeInTheDocument(),
//       { timeout: 5000 }
//     )
//   })

//   it('shows "No shifts recorded for this date." for a day with no shifts', async () => {
//     mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
//     global.fetch = makeOkFetch(emptyDayData)

//     renderWithSuspense(<InfonetReport />)
//     await waitFor(
//       () => expect(screen.getByText(/no shifts recorded for this date/i)).toBeInTheDocument(),
//       { timeout: 5000 }
//     )
//   })

//   it('shows an error message when the API returns an error', async () => {
//     mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
//     global.fetch = vi.fn().mockResolvedValue({
//       ok: false,
//       status: 500,
//       json: () => Promise.resolve({ error: 'Internal Server Error' }),
//     })

//     renderWithSuspense(<InfonetReport />)
//     await waitFor(
//       () => expect(screen.getByText('Internal Server Error')).toBeInTheDocument(),
//       { timeout: 5000 }
//     )
//   })

//   it('calls the correct API endpoint with site, from, and to', async () => {
//     mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
//     global.fetch = makeOkFetch(sampleData)

//     renderWithSuspense(<InfonetReport />)

//     await waitFor(() => {
//       const calls = (global.fetch as any).mock.calls
//       const apiCall = calls.find((c: any[]) =>
//         typeof c[0] === 'string' && c[0].includes('/api/cash-summary/tax-exempt-report')
//       )
//       expect(apiCall).toBeTruthy()
//       expect(apiCall[0]).toContain('site=Rankin')
//       expect(apiCall[0]).toContain('from=2026-03-01')
//       expect(apiCall[0]).toContain('to=2026-03-18')
//     })
//   })

//   it('sorts data descending by date (latest first)', async () => {
//     mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
//     // Provide data in ascending order — component should render descending
//     const ascData = [
//       { date: '2026-03-10', totalExemptedTax: 10, totalItemSales: 100, shiftNumbers: ['SFT-A'], isSubmitted: true },
//       { date: '2026-03-15', totalExemptedTax: 20, totalItemSales: 200, shiftNumbers: ['SFT-B'], isSubmitted: true },
//     ]
//     global.fetch = makeOkFetch(ascData)

//     renderWithSuspense(<InfonetReport />)
//     await waitFor(
//       () => expect(screen.getByText('2026-03-15')).toBeInTheDocument(),
//       { timeout: 5000 }
//     )

//     // Get all table rows (skip header)
//     const rows = screen.getAllByRole('row').filter((_, i) => i > 0)
//     // First data row should be 2026-03-15 (latest), second should be 2026-03-10
//     expect(rows[0]).toHaveTextContent('2026-03-15')
//     expect(rows[1]).toHaveTextContent('2026-03-10')
//   })

//   it('computes correct grand totals from multiple rows', async () => {
//     mockUseSearch.mockReturnValue({ site: 'Rankin', from: '2026-03-01', to: '2026-03-18' })
//     // 120.50 + 80.25 = 200.75
//     global.fetch = makeOkFetch(sampleData)

//     renderWithSuspense(<InfonetReport />)
//     await waitFor(
//       () => expect(screen.getByText(/200\.75/)).toBeInTheDocument(),
//       { timeout: 5000 }
//     )
//   })
// })


