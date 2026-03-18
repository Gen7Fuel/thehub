import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ─── Hoisted mutable state ─────────────────────────────────────────────────────

const {
  mockNavigate,
  mockStore,
  mockAxiosGet,
  mockAxiosPost,
  mockUploadBase64Image,
  mockUseAuth,
} = vi.hoisted(() => {
  const mockStore = {
    payableVendorName: 'Shell Canada' as string,
    setPayableVendorName: vi.fn(),
    payableLocation: 'Rankin' as string,
    setPayableLocation: vi.fn(),
    payableNotes: '' as string,
    setPayableNotes: vi.fn(),
    payablePaymentMethod: 'safe' as string,
    setPayablePaymentMethod: vi.fn(),
    payableAmount: 150 as number,
    setPayableAmount: vi.fn(),
    payableImages: [] as string[],
    setPayableImages: vi.fn(),
    date: new Date('2026-03-10') as Date | undefined,
    setDate: vi.fn(),
    resetPayableForm: vi.fn(),
  }

  const mockUseAuth = vi.fn().mockReturnValue({
    user: {
      id: 'user-1',
      location: 'Rankin',
      timezone: 'America/Toronto',
    },
  })

  return {
    mockNavigate: vi.fn(),
    mockStore,
    mockAxiosGet: vi.fn(),
    mockAxiosPost: vi.fn(),
    mockUploadBase64Image: vi.fn().mockResolvedValue({ filename: 'uploaded.jpg' }),
    mockUseAuth,
  }
})

// ─── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (config: any) => ({ ...config }),
    useNavigate: () => mockNavigate,
    Link: ({ to, children }: any) => <a href={to}>{children}</a>,
  }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/store', () => ({
  useFormStore: (selector: (state: any) => any) => selector(mockStore),
}))

vi.mock('axios', () => ({
  default: {
    get: mockAxiosGet,
    post: mockAxiosPost,
  },
}))

vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>()
  return {
    ...actual,
    getStartAndEndOfToday: () => ({
      start: new Date('2026-03-10T00:00:00Z'),
      end: new Date('2026-03-10T23:59:59Z'),
    }),
    uploadBase64Image: mockUploadBase64Image,
    toUTC: (d: Date) => d,
  }
})

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
  DatePicker: () => <div data-testid="date-picker" />,
}))

vi.mock('@/components/custom/datePickerWithRange', () => ({
  DatePickerWithRange: () => <div data-testid="date-picker-range" />,
}))

vi.mock('@/components/custom/PayablePDF', () => ({
  default: () => <div />,
}))

vi.mock('@/components/ui/calendar', () => ({
  Calendar: () => <div data-testid="calendar" />,
}))

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('@react-pdf/renderer', () => ({
  pdf: vi.fn(() => ({
    updateContainer: vi.fn(),
    toBlob: vi.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' })),
  })),
  Document: ({ children }: any) => <>{children}</>,
  Page: ({ children }: any) => <>{children}</>,
  Text: ({ children }: any) => <span>{children}</span>,
  View: ({ children }: any) => <div>{children}</div>,
  StyleSheet: { create: (s: any) => s },
  Font: { register: vi.fn() },
  Image: () => null,
}))

// ─── Component imports (after mocks) ─────────────────────────────────────────

import { Route as IndexRoute } from '../payables/index'
import { Route as ListRoute } from '../payables/list'
import { Route as ImagesRoute } from '../payables/images'
import { Route as ReviewRoute } from '../payables/review'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const renderWithSuspense = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <React.Suspense fallback={null}>{children}</React.Suspense>
    ),
  })

const resetStore = () => {
  mockStore.payableVendorName = 'Shell Canada'
  mockStore.payableLocation = 'Rankin'
  mockStore.payableNotes = ''
  mockStore.payablePaymentMethod = 'safe'
  mockStore.payableAmount = 150
  mockStore.payableImages = []
  mockStore.date = new Date('2026-03-10')
}

const PayableForm = (IndexRoute as any).component as React.ComponentType
const PayableList = (ListRoute as any).component as React.ComponentType
const PayableImages = (ImagesRoute as any).component as React.ComponentType
const PayableReview = (ReviewRoute as any).component as React.ComponentType

// ─── Payable Form (index.tsx) ─────────────────────────────────────────────────

describe('Payable Form — index.tsx', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  it('renders the Vendor Name input', async () => {
    renderWithSuspense(<PayableForm />)
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/vendor name/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders the Amount input', async () => {
    renderWithSuspense(<PayableForm />)
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/amount/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders the location picker', async () => {
    renderWithSuspense(<PayableForm />)
    await waitFor(() =>
      expect(screen.getByTestId('location-picker')).toBeInTheDocument()
    )
  })

  it('renders the date picker', async () => {
    renderWithSuspense(<PayableForm />)
    await waitFor(() =>
      expect(screen.getByTestId('date-picker')).toBeInTheDocument()
    )
  })

  it('shows "Capture Invoice" button when form is valid and no images exist', async () => {
    renderWithSuspense(<PayableForm />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /capture invoice/i })).toBeInTheDocument()
    )
  })

  it('disables "Capture Invoice" button when vendorName is missing', async () => {
    mockStore.payableVendorName = ''
    renderWithSuspense(<PayableForm />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /capture invoice/i })).toBeDisabled()
    )
  })

  it('disables "Capture Invoice" button when amount is 0', async () => {
    mockStore.payableAmount = 0
    renderWithSuspense(<PayableForm />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /capture invoice/i })).toBeDisabled()
    )
  })

  it('shows "View X Images" button when images exist', async () => {
    mockStore.payableImages = ['data:image/png;base64,abc']
    renderWithSuspense(<PayableForm />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /view 1 images/i })).toBeInTheDocument()
    )
  })
})

// ─── Payable List (list.tsx) ──────────────────────────────────────────────────

describe('Payable List — list.tsx', () => {
  const samplePayables = [
    {
      _id: 'pay-1',
      vendorName: 'Shell Canada',
      location: { _id: 'loc-1', stationName: 'Rankin', csoCode: 'RNK' },
      paymentMethod: 'safe',
      amount: 150,
      images: [],
      createdAt: '2026-03-10T12:00:00Z',
      notes: '',
    },
  ]

  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    window.open = vi.fn()
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', location: 'Rankin', timezone: 'America/Toronto' },
    })
    // First call: locations lookup, second call: payables fetch
    mockAxiosGet
      .mockResolvedValueOnce({ data: [{ _id: 'loc-1', stationName: 'Rankin' }] })
      .mockResolvedValueOnce({ data: samplePayables })
  })

  it('renders the "Payables List" heading', async () => {
    renderWithSuspense(<PayableList />)
    await waitFor(() =>
      expect(screen.getByText(/payables list/i)).toBeInTheDocument()
    )
  })

  it('fetches and displays payables in the table', async () => {
    renderWithSuspense(<PayableList />)
    await waitFor(() =>
      expect(screen.getByText('Shell Canada')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows "No payables found" when the response is empty', async () => {
    mockAxiosGet
      .mockReset()
      .mockResolvedValueOnce({ data: [{ _id: 'loc-1', stationName: 'Rankin' }] })
      .mockResolvedValueOnce({ data: [] })

    renderWithSuspense(<PayableList />)
    await waitFor(() =>
      expect(screen.getByText(/no payables found/i)).toBeInTheDocument()
    )
  })

  it('displays the formatted amount for each payable', async () => {
    renderWithSuspense(<PayableList />)
    await waitFor(() =>
      expect(screen.getByText('$150.00')).toBeInTheDocument()
    )
  })

  it('shows total amount in the summary', async () => {
    renderWithSuspense(<PayableList />)
    await waitFor(() =>
      expect(screen.getByText(/total amount/i)).toBeInTheDocument()
    )
  })

  it('navigates to /no-access when the fetch returns 403', async () => {
    mockAxiosGet.mockReset().mockRejectedValue(
      Object.assign(new Error('Forbidden'), { response: { status: 403 } })
    )

    renderWithSuspense(<PayableList />)
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/no-access' })
    )
  })
})

// ─── Payable Images (images.tsx) ──────────────────────────────────────────────

describe('Payable Images — images.tsx', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  it('redirects to /payables when required store fields are missing', async () => {
    mockStore.payableVendorName = ''

    renderWithSuspense(<PayableImages />)
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/payables' })
    )
  })

  it('renders the "Add more Invoice Images" capture button', async () => {
    renderWithSuspense(<PayableImages />)
    await waitFor(() =>
      expect(screen.getByText(/add more invoice images/i)).toBeInTheDocument()
    )
  })

  it('renders existing images as thumbnails', async () => {
    mockStore.payableImages = ['data:image/png;base64,img1', 'data:image/png;base64,img2']
    renderWithSuspense(<PayableImages />)
    await waitFor(() => {
      const imgs = screen.getAllByRole('img', { name: /invoice/i })
      expect(imgs).toHaveLength(2)
    })
  })

  it('alerts and does not navigate when Review is clicked with no images', async () => {
    window.alert = vi.fn()
    renderWithSuspense(<PayableImages />)

    const reviewBtn = await waitFor(() =>
      screen.getByRole('button', { name: /review/i })
    )
    fireEvent.click(reviewBtn)

    expect(window.alert).toHaveBeenCalledWith(
      expect.stringMatching(/at least one invoice image/i)
    )
    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: '/payables/review' })
    )
  })

  it('navigates to /payables/review when Review is clicked with images present', async () => {
    mockStore.payableImages = ['data:image/png;base64,img1']
    renderWithSuspense(<PayableImages />)

    const reviewBtn = await waitFor(() =>
      screen.getByRole('button', { name: /review/i })
    )
    fireEvent.click(reviewBtn)

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/payables/review' })
  })
})

// ─── Payable Review (review.tsx) ──────────────────────────────────────────────

describe('Payable Review — review.tsx', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockAxiosGet.mockResolvedValue({
      data: [{ _id: 'loc-1', stationName: 'Rankin' }],
    })
    mockAxiosPost.mockResolvedValue({ status: 201, data: { _id: 'pay-new' } })
  })

  it('redirects to /payables when required fields are missing', async () => {
    mockStore.payableVendorName = ''

    renderWithSuspense(<PayableReview />)
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/payables' })
    )
  })

  it('displays the vendor name in the review', async () => {
    renderWithSuspense(<PayableReview />)
    await waitFor(() =>
      expect(screen.getByText('Shell Canada')).toBeInTheDocument()
    )
  })

  it('displays the payment method label', async () => {
    renderWithSuspense(<PayableReview />)
    await waitFor(() =>
      expect(screen.getByText('Safe')).toBeInTheDocument()
    )
  })

  it('displays the formatted amount', async () => {
    renderWithSuspense(<PayableReview />)
    await waitFor(() =>
      expect(screen.getByText('$150.00')).toBeInTheDocument()
    )
  })

  it('calls POST /api/payables and navigates to /payables/list on success', async () => {
    renderWithSuspense(<PayableReview />)

    const submitBtn = await waitFor(() =>
      screen.getByRole('button', { name: /submit/i })
    )
    fireEvent.click(submitBtn)

    await waitFor(() =>
      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/api/payables'),
        expect.objectContaining({
          vendorName: 'Shell Canada',
          paymentMethod: 'safe',
          amount: 150,
        }),
        expect.any(Object)
      )
    )
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/payables/list' })
    )
  })

  it('shows "Submitting..." while the request is in flight', async () => {
    // Never resolve so the component stays in submitting state
    mockAxiosGet.mockResolvedValue({ data: [{ _id: 'loc-1', stationName: 'Rankin' }] })
    mockAxiosPost.mockReturnValue(new Promise(() => {}))

    renderWithSuspense(<PayableReview />)

    const submitBtn = await waitFor(() =>
      screen.getByRole('button', { name: /submit/i })
    )
    fireEvent.click(submitBtn)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /submitting/i })).toBeInTheDocument()
    )
  })
})
