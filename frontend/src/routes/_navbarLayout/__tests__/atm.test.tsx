import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ─── Hoisted mutable state ─────────────────────────────────────────────────────

const { mockNavigate, mockAxiosPost, mockAxiosGet, mockUser } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockAxiosPost: vi.fn().mockResolvedValue({ data: { _id: 'atm-001' } }),
  mockAxiosGet: vi.fn().mockResolvedValue({ data: [] }),
  mockUser: {
    id: 'user-1',
    location: 'Rankin',
    access: { accounting: { atm: true } },
  },
}))

// ─── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (config: any) => config,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

vi.mock('@/context/SiteContext', () => ({
  useSite: () => ({ selectedSite: '', setSelectedSite: vi.fn() }),
}))

vi.mock('@/components/custom/datePicker', () => ({
  DatePicker: ({ date }: any) => (
    <div data-testid="date-picker">{date ? 'date-set' : 'no-date'}</div>
  ),
}))

vi.mock('@/components/custom/datePickerWithRange', () => ({
  DatePickerWithRange: () => <div data-testid="date-range-picker" />,
}))

vi.mock('@/components/custom/locationPicker', () => ({
  LocationPicker: ({ setStationName }: any) => (
    <button
      data-testid="location-picker"
      onClick={() => setStationName('Couchiching')}
    >
      Pick Location
    </button>
  ),
}))

vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>()
  return {
    ...actual,
    uploadBase64Image: vi.fn().mockResolvedValue({ filename: 'atm-test.jpg' }),
    getStartAndEndOfToday: () => ({ start: new Date('2026-04-01'), end: new Date('2026-04-01') }),
  }
})

vi.mock('axios', () => ({
  default: {
    get: mockAxiosGet,
    post: mockAxiosPost,
  },
}))

// ─── Component import (after mocks) ───────────────────────────────────────────

const { Route: CreateRoute } = await import('../atm/index')
const { Route: ListRoute } = await import('../atm/list')

const ATMCreateComponent = (CreateRoute as any).component as React.ComponentType
const ATMListComponent = (ListRoute as any).component as React.ComponentType

// ─── Helpers ──────────────────────────────────────────────────────────────────

const renderWithSuspense = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <React.Suspense fallback={null}>{children}</React.Suspense>
    ),
  })

// ─── Tests: ATM Create form ────────────────────────────────────────────────────

describe('ATM Create — rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
  })

  it('renders the "ATM Fill" heading', async () => {
    renderWithSuspense(<ATMCreateComponent />)
    await waitFor(
      () => expect(screen.getByText('ATM Fill')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('renders the DatePicker', async () => {
    renderWithSuspense(<ATMCreateComponent />)
    await waitFor(
      () => expect(screen.getByTestId('date-picker')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('renders the LocationPicker', async () => {
    renderWithSuspense(<ATMCreateComponent />)
    await waitFor(
      () => expect(screen.getByTestId('location-picker')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('renders the amount input', async () => {
    renderWithSuspense(<ATMCreateComponent />)
    await waitFor(
      () => expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('renders the source selector', async () => {
    renderWithSuspense(<ATMCreateComponent />)
    await waitFor(
      () => expect(screen.getByText('Select source')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('renders the Capture Photo button', async () => {
    renderWithSuspense(<ATMCreateComponent />)
    await waitFor(
      () => expect(screen.getByText('Capture Photo')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('renders the History link', async () => {
    renderWithSuspense(<ATMCreateComponent />)
    await waitFor(
      () => expect(screen.getByText('History')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('renders section labels', async () => {
    renderWithSuspense(<ATMCreateComponent />)
    await waitFor(() => {
      expect(screen.getByText('Date')).toBeInTheDocument()
      expect(screen.getByText('Location')).toBeInTheDocument()
      expect(screen.getByText(/Amount Loaded/i)).toBeInTheDocument()
      expect(screen.getByText(/Money Taken From/i)).toBeInTheDocument()
      expect(screen.getByText(/Supporting Document/i)).toBeInTheDocument()
    }, { timeout: 5000 })
  })
})

describe('ATM Create — form validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
  })

  it('submit button is disabled when no amount is entered', async () => {
    renderWithSuspense(<ATMCreateComponent />)
    await waitFor(
      () => expect(screen.getByText('Submit')).toBeInTheDocument(),
      { timeout: 5000 },
    )
    const submit = screen.getByRole('button', { name: 'Submit' })
    expect(submit).toBeDisabled()
  })

  it('entering a positive amount alone does not enable submit (image still required)', async () => {
    renderWithSuspense(<ATMCreateComponent />)
    await waitFor(
      () => expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument(),
      { timeout: 5000 },
    )
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '500' } })
    const submit = screen.getByRole('button', { name: 'Submit' })
    expect(submit).toBeDisabled()
  })
})

describe('ATM Create — image capture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')

    // Mock FileReader to call onloadend synchronously with a data URL
    const MockFileReader = class {
      result = 'data:image/jpeg;base64,/9j/test=='
      onloadend: (() => void) | null = null
      readAsDataURL() {
        this.onloadend?.()
      }
    }
    vi.stubGlobal('FileReader', MockFileReader)
  })

  it('shows "Retake Photo" after a file is captured', async () => {
    renderWithSuspense(<ATMCreateComponent />)
    await waitFor(
      () => expect(screen.getByText('Capture Photo')).toBeInTheDocument(),
      { timeout: 5000 },
    )

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['jpeg'], 'receipt.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(
      () => expect(screen.getByText('Retake Photo')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('clears the image when the X button is clicked', async () => {
    renderWithSuspense(<ATMCreateComponent />)
    await waitFor(
      () => expect(screen.getByText('Capture Photo')).toBeInTheDocument(),
      { timeout: 5000 },
    )

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [new File(['x'], 'r.jpg', { type: 'image/jpeg' })] } })

    await waitFor(
      () => expect(screen.getByText('Retake Photo')).toBeInTheDocument(),
      { timeout: 5000 },
    )

    // Find the X (remove) button — it's next to the image
    const buttons = screen.getAllByRole('button')
    const xBtn = buttons.find((b) => !b.textContent?.trim())
    if (xBtn) fireEvent.click(xBtn)

    await waitFor(
      () => expect(screen.getByText('Capture Photo')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })
})

// ─── Tests: ATM List ──────────────────────────────────────────────────────────

describe('ATM List — rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockAxiosGet.mockResolvedValue({ data: [] })
  })

  it('renders the New Record link', async () => {
    renderWithSuspense(<ATMListComponent />)
    await waitFor(
      () => expect(screen.getByText('New Record')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('calls /api/atm on mount', async () => {
    renderWithSuspense(<ATMListComponent />)
    await waitFor(() => expect(mockAxiosGet).toHaveBeenCalled(), { timeout: 5000 })
    const [url] = mockAxiosGet.mock.calls[0]
    expect(url).toContain('/api/atm')
  })

  it('shows "No records found." when there are no records', async () => {
    renderWithSuspense(<ATMListComponent />)
    await waitFor(
      () => expect(screen.getByText('No records found.')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('renders records returned from the API', async () => {
    mockAxiosGet.mockResolvedValue({
      data: [
        {
          _id: 'atm-1',
          date: '2026-04-01',
          amount: 1500,
          source: 'till',
          stationName: 'Rankin',
          createdBy: 'staff@gen7.com',
          image: null,
          createdAt: '2026-04-01T10:00:00Z',
        },
      ],
    })
    renderWithSuspense(<ATMListComponent />)
    await waitFor(
      () => expect(screen.getByText('Rankin')).toBeInTheDocument(),
      { timeout: 5000 },
    )
    // Amount appears in both the row and the total line — use getAllByText
    expect(screen.getAllByText(/1,500\.00/).length).toBeGreaterThan(0)
  })
})
