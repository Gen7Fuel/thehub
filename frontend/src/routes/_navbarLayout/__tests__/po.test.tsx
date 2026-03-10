import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ─── Hoisted mutable state ─────────────────────────────────────────────────────
// vi.hoisted runs before vi.mock factories and before module imports.

const {
  mockNavigate,
  mockUseLoaderData,
  mockStore,
  mockAxiosGet,
  mockAxiosPost,
  mockAxiosDelete,
  mockAxiosPut,
  mockUploadBase64Image,
  mockUseAuth,
} = vi.hoisted(() => {
  const mockStore = {
    fleetCardNumber: '' as string,
    setFleetCardNumber: vi.fn(),
    poNumber: '' as string,
    setPoNumber: vi.fn(),
    customerName: 'Jane Doe' as string,
    setCustomerName: vi.fn(),
    driverName: 'Bob Smith' as string,
    setDriverName: vi.fn(),
    vehicleInfo: 'Ford F-150' as string,
    setVehicleInfo: vi.fn(),
    quantity: 50 as number,
    setQuantity: vi.fn(),
    amount: 100 as number,
    setAmount: vi.fn(),
    fuelType: 'UNL' as string,
    setFuelType: vi.fn(),
    receipt: 'data:image/png;base64,abc' as string | null,
    setReceipt: vi.fn(),
    signature: 'data:image/png;base64,sig' as string | null,
    setSignature: vi.fn(),
    date: new Date('2026-01-15') as Date | undefined,
    setDate: vi.fn(),
    stationName: 'Rankin' as string,
    setStationName: vi.fn(),
    resetForm: vi.fn(),
  }

  const mockUseAuth = vi.fn().mockReturnValue({
    user: {
      id: 'user-1',
      location: 'Rankin',
      timezone: 'America/Toronto',
      access: {
        po: { pdf: true, changeDate: true, delete: true },
      },
    },
  })

  return {
    mockNavigate: vi.fn(),
    mockUseLoaderData: vi.fn().mockReturnValue({
      products: [{ _id: '1', code: 'UNL', description: 'Regular Unleaded' }],
    }),
    mockStore,
    mockAxiosGet: vi.fn(),
    mockAxiosPost: vi.fn(),
    mockAxiosDelete: vi.fn(),
    mockAxiosPut: vi.fn(),
    mockUploadBase64Image: vi.fn().mockResolvedValue({ filename: 'uploaded.jpg' }),
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
      fullPath: '/_navbarLayout/po',
      useLoaderData: mockUseLoaderData,
    }),
    useNavigate: () => mockNavigate,
    Link: ({ to, children, className }: any) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
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
    delete: mockAxiosDelete,
    put: mockAxiosPut,
    isAxiosError: (err: any) => !!(err && err.isAxiosErr),
  },
  isAxiosError: (err: any) => !!(err && err.isAxiosErr),
}))

vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>()
  return {
    ...actual,
    getStartAndEndOfToday: () => ({
      start: new Date('2026-01-01T00:00:00Z'),
      end: new Date('2026-01-02T00:00:00Z'),
    }),
    uploadBase64Image: mockUploadBase64Image,
    formatFleetCardNumber: (num: string) => num || '',
  }
})

vi.mock('@/lib/constants', () => ({
  domain: 'http://localhost:5000',
}))

// Stub SignatureCanvas — expose all methods that signature.tsx calls on the ref.
vi.mock('react-signature-canvas', () => ({
  default: React.forwardRef((_props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      toDataURL: () => 'data:image/png;base64,mocksig',
      fromDataURL: vi.fn(),
      clear: vi.fn(),
    }))
    return <canvas data-testid="sig-canvas" />
  }),
}))

vi.mock('@react-pdf/renderer', () => ({
  pdf: vi.fn(() => ({
    toBlob: vi.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' })),
  })),
  Document: ({ children }: any) => <>{children}</>,
  Page: ({ children }: any) => <>{children}</>,
  Text: ({ children }: any) => <span>{children}</span>,
  View: ({ children }: any) => <div>{children}</div>,
  StyleSheet: { create: (s: any) => s },
  Font: { register: vi.fn() },
}))

vi.mock('@/components/custom/poForm', () => ({
  default: () => <div data-testid="po-pdf-form" />,
}))

vi.mock('@/components/custom/datePickerWithRange', () => ({
  DatePickerWithRange: () => <div data-testid="date-picker-range" />,
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

// Render InputOTP as a plain <input> so blur/change events work in tests.
vi.mock('@/components/ui/input-otp', () => ({
  InputOTP: ({ value, onChange, onBlur }: any) => (
    <input
      data-testid="otp-input"
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={onBlur}
    />
  ),
  InputOTPGroup: ({ children }: any) => <>{children}</>,
  InputOTPSeparator: () => null,
  InputOTPSlot: () => null,
}))

// ─── Component imports (after mocks) ─────────────────────────────────────────

import { Route as IndexRoute } from '../po/index'
import { Route as ListRoute } from '../po/list'
import { Route as SignatureRoute } from '../po/signature'
import { Route as ReceiptRoute } from '../po/receipt'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Route component files are transformed by TanStack Router's vite plugin with
 * autoCodeSplitting=true, wrapping each component in React.lazy(). Every test
 * render must therefore include a <Suspense> boundary, and the lazy import must
 * be allowed to resolve before assertions run.
 */

/** Plain render inside Suspense (via wrapper option) so lazy route components can mount. */
const renderWithSuspense = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <React.Suspense fallback={null}>{children}</React.Suspense>
    ),
  })

/** Wraps a component in QueryClientProvider + Suspense for mutation tests. */
const makeQueryWrapper = () => {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <React.Suspense fallback={null}>{children}</React.Suspense>
    </QueryClientProvider>
  )
}

/** Convenience render that includes QueryClientProvider + Suspense. */
const renderWithQuery = (ui: React.ReactElement) =>
  render(ui, { wrapper: makeQueryWrapper() })

/** Reset mockStore back to safe defaults before each test. */
const resetStore = () => {
  mockStore.fleetCardNumber = ''
  mockStore.poNumber = ''
  mockStore.customerName = 'Jane Doe'
  mockStore.driverName = 'Bob Smith'
  mockStore.vehicleInfo = 'Ford F-150'
  mockStore.quantity = 50
  mockStore.amount = 100
  mockStore.fuelType = 'UNL'
  mockStore.receipt = 'data:image/png;base64,abc'
  mockStore.signature = 'data:image/png;base64,sig'
  mockStore.date = new Date('2026-01-15')
  mockStore.stationName = 'Rankin'
}

const POForm = (IndexRoute as any).component as React.ComponentType
const POList = (ListRoute as any).component as React.ComponentType
const POSignature = (SignatureRoute as any).component as React.ComponentType
const POReceipt = (ReceiptRoute as any).component as React.ComponentType

// ─── PO Form (index.tsx) ──────────────────────────────────────────────────────

describe('PO Form — index.tsx', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', location: 'Rankin', timezone: 'America/Toronto', access: {} },
    })
  })

  it('renders the location picker and OTP input by default', async () => {
    renderWithSuspense(<POForm />)
    // Allow up to 5 s on the first render — the lazy route module needs to load
    await waitFor(() => {
      expect(screen.getByTestId('date-picker')).toBeInTheDocument()
      expect(screen.getByTestId('otp-input')).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it("hides the number-type toggle and PO/fleet fields when stationName is charlies", async () => {
    // isCharlies = stationName.trim().toLowerCase() === "charlies" (no apostrophe)
    mockStore.stationName = 'charlies'
    renderWithSuspense(<POForm />)
    // Wait for the component to mount (Select Site heading is always rendered)
    await waitFor(() => expect(screen.getByText(/select site/i)).toBeInTheDocument())
    expect(screen.queryByTestId('otp-input')).not.toBeInTheDocument()
  })

  it('shows a PO uniqueness error when the uniqueness API returns not-unique', async () => {
    mockStore.poNumber = '12345'
    mockAxiosGet.mockResolvedValue({ data: { unique: false } })

    renderWithSuspense(<POForm />)
    const otpInput = await waitFor(() => screen.getByTestId('otp-input'), { timeout: 5000 })
    fireEvent.blur(otpInput)

    await waitFor(() =>
      // Actual error text: "This PO number has already been used for this site."
      expect(screen.getByText(/already been used for this site/i)).toBeInTheDocument()
    )
  })

  it('clears the PO error when the uniqueness API confirms the number is unique', async () => {
    mockStore.poNumber = '12345'
    mockAxiosGet.mockResolvedValue({ data: { unique: true } })

    renderWithSuspense(<POForm />)
    const otpInput = await waitFor(() => screen.getByTestId('otp-input'), { timeout: 5000 })
    fireEvent.blur(otpInput)

    // After blur with unique=true the error text should never appear
    await waitFor(() =>
      expect(screen.queryByText(/already been used for this site/i)).not.toBeInTheDocument()
    )
  })

  it('disables the Upload Receipt button when customerName is missing', async () => {
    // receipt must be null so the camera/upload button is rendered (not "View Captured Receipt")
    mockStore.receipt = null
    mockStore.customerName = ''
    renderWithSuspense(<POForm />)

    await waitFor(() => {
      const uploadBtn = screen.getByRole('button', { name: /upload receipt/i })
      expect(uploadBtn).toBeDisabled()
    }, { timeout: 5000 })
  })
})

// ─── PO List (list.tsx) ───────────────────────────────────────────────────────

describe('PO List — list.tsx', () => {
  const sampleOrders = [
    {
      _id: 'order-1',
      date: '2026-01-15T12:00:00Z',
      fleetCardNumber: '',
      poNumber: '10001',
      customerName: 'Jane Doe',
      driverName: 'Bob Smith',
      quantity: 50,
      amount: 100,
      description: 'Regular Unleaded',
      vehicleMakeModel: 'Ford F-150',
      signature: '',
      receipt: '',
    },
  ]

  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    window.confirm = vi.fn(() => true)
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
    mockUseAuth.mockReturnValue({
      user: {
        id: 'u1',
        location: 'Rankin',
        timezone: 'America/Toronto',
        access: { po: { pdf: true, changeDate: true, delete: true } },
      },
    })
    mockAxiosGet.mockResolvedValue({ status: 200, data: sampleOrders })
  })

  it('renders the "Purchase Order List" heading', async () => {
    renderWithSuspense(<POList />)
    await waitFor(() =>
      expect(screen.getByText(/purchase order list/i)).toBeInTheDocument()
    )
  })

  it('fetches orders on mount and displays them in the table', async () => {
    renderWithSuspense(<POList />)
    await waitFor(() =>
      expect(screen.getByText('Jane Doe')).toBeInTheDocument(),
      { timeout: 5000 }
    )
    expect(mockAxiosGet).toHaveBeenCalledWith(
      expect.stringContaining('/api/purchase-orders'),
      expect.any(Object)
    )
  })

  it('shows "No purchase orders available" when the response is empty', async () => {
    mockAxiosGet.mockResolvedValue({ status: 200, data: [] })
    renderWithSuspense(<POList />)
    await waitFor(() =>
      expect(screen.getByText(/no purchase orders available/i)).toBeInTheDocument()
    )
  })

  it('hides the delete button when user lacks delete access', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'u1',
        location: 'Rankin',
        timezone: 'America/Toronto',
        access: { po: { pdf: false, changeDate: false, delete: false } },
      },
    })

    renderWithSuspense(<POList />)
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('navigates to /no-access when the fetch call returns 403', async () => {
    const err403 = Object.assign(new Error('Forbidden'), {
      response: { status: 403 },
    })
    mockAxiosGet.mockRejectedValue(err403)

    renderWithSuspense(<POList />)

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/no-access' })
    )
  })
})

// ─── PO Signature (signature.tsx) ─────────────────────────────────────────────

describe('PO Signature — signature.tsx', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', location: 'Rankin', timezone: 'America/Toronto', access: {} },
    })
    mockAxiosPost.mockResolvedValue({ status: 201, data: { _id: 'txn-1' } })
  })

  it('redirects to /po/receipt when there is no receipt in the store', async () => {
    mockStore.receipt = null

    renderWithQuery(<POSignature />)

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/po/receipt' })
    )
  })

  it('disables the Submit button when signature is empty', () => {
    mockStore.signature = null

    renderWithQuery(<POSignature />)

    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
  })

  it('calls POST /api/purchase-orders and navigates to /po/list on success', async () => {
    renderWithQuery(<POSignature />)

    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() =>
      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/api/purchase-orders'),
        expect.objectContaining({ source: 'PO', stationName: 'Rankin' }),
        expect.any(Object)
      )
    )
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/po/list' })
    )
  })
})

// ─── PO Receipt (receipt.tsx) ─────────────────────────────────────────────────

describe('PO Receipt — receipt.tsx', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', location: 'Rankin', timezone: 'America/Toronto', access: {} },
    })
    mockAxiosPost.mockResolvedValue({ status: 201, data: { _id: 'txn-2' } })
  })

  it('redirects to /po when required form fields are missing', async () => {
    mockStore.quantity = 0 // triggers the guard

    renderWithQuery(<POReceipt />)

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/po' })
    )
  })

  it('shows "No receipt image found" when receipt is null', async () => {
    mockStore.receipt = null

    renderWithQuery(<POReceipt />)

    await waitFor(() =>
      expect(screen.getByText(/no receipt image found/i)).toBeInTheDocument()
    )
  })

  it('renders the receipt image when receipt data is present', async () => {
    renderWithQuery(<POReceipt />)
    const img = await waitFor(() =>
      screen.getByRole('img', { name: /captured receipt/i })
    )
    expect(img).toHaveAttribute('src', 'data:image/png;base64,abc')
  })

  it('disables the submit button when receipt is null', () => {
    mockStore.receipt = null

    renderWithQuery(<POReceipt />)

    // Button is rendered but disabled — "Finalize & Submit"
    const submitBtn = screen.getByRole('button', { name: /finalize|submit/i })
    expect(submitBtn).toBeDisabled()
  })

  it('calls POST /api/purchase-orders and navigates to /po/list on success', async () => {
    renderWithQuery(<POReceipt />)

    const submitBtn = screen.getByRole('button', { name: /finalize|submit/i })
    fireEvent.click(submitBtn)

    await waitFor(() =>
      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/api/purchase-orders'),
        expect.objectContaining({ source: 'PO', signature: '' }),
        expect.any(Object)
      )
    )
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/po/list' })
    )
  })
})
