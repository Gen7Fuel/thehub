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
  mockIsActuallyOnline,
  mockSavePendingAction,
  mockGetPendingActions,
  mockTriggerBackgroundSync,
  mockDeletePendingAction,
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
    licensePlate: '' as string,
    setLicensePlate: vi.fn(),
    quantity: 50 as number,
    setQuantity: vi.fn(),
    amount: 100 as number,
    setAmount: vi.fn(),
    fuelType: 'UNL' as string,
    setFuelType: vi.fn(),
    purchaseType: 'fuel' as 'fuel' | 'non-fuel',
    setPurchaseType: vi.fn(),
    itemsDescription: '' as string,
    setItemsDescription: vi.fn(),
    receipt: 'data:image/png;base64,abc' as string | null,
    setReceipt: vi.fn(),
    signature: 'data:image/png;base64,sig' as string | null,
    setSignature: vi.fn(),
    // Local-midnight construction, matching how the Calendar picker actually
    // produces dates — new Date('2026-01-15') would parse as UTC midnight and
    // shift a day in negative-UTC-offset timezones.
    date: new Date(2026, 0, 15) as Date | undefined,
    setDate: vi.fn(),
    stationName: 'TestSite' as string,
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
    // Default: "online" so existing submit tests exercise the normal network path.
    mockIsActuallyOnline: vi.fn().mockResolvedValue(true),
    mockSavePendingAction: vi.fn().mockResolvedValue(undefined),
    mockGetPendingActions: vi.fn().mockResolvedValue([]),
    mockTriggerBackgroundSync: vi.fn().mockResolvedValue(undefined),
    mockDeletePendingAction: vi.fn().mockResolvedValue(undefined),
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

vi.mock('@/context/SiteContext', () => ({
  useSite: () => ({ selectedSite: '', setSelectedSite: vi.fn() }),
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
    triggerBackgroundSync: mockTriggerBackgroundSync,
  }
})

vi.mock('@/lib/constants', () => ({
  domain: 'http://localhost:5000',
}))

vi.mock('@/lib/network', () => ({
  isActuallyOnline: mockIsActuallyOnline,
}))

vi.mock('@/lib/orderRecIndexedDB', () => ({
  getDB: vi.fn(),
  saveOrderRec: vi.fn(),
  getOrderRecById: vi.fn(),
  savePendingAction: mockSavePendingAction,
  getPendingActions: mockGetPendingActions,
  getPendingActionEntries: vi.fn().mockResolvedValue([]),
  deletePendingAction: mockDeletePendingAction,
  updatePendingAction: vi.fn().mockResolvedValue(undefined),
  clearPendingActions: vi.fn(),
  hasPendingActionsForId: vi.fn().mockResolvedValue(false),
  deletePendingActionsForId: vi.fn(),
  clearLocalDB: vi.fn(),
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
  mockStore.licensePlate = ''
  mockStore.quantity = 50
  mockStore.amount = 100
  mockStore.fuelType = 'UNL'
  mockStore.purchaseType = 'fuel'
  mockStore.itemsDescription = ''
  mockStore.receipt = 'data:image/png;base64,abc'
  mockStore.signature = 'data:image/png;base64,sig'
  mockStore.date = new Date(2026, 0, 15)
  mockStore.stationName = 'TestSite'
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
    // Default: AR customers fetch resolves to empty list so the component mounts cleanly.
    mockAxiosGet.mockResolvedValue({ data: [] })
  })

  it('renders the location picker and OTP input by default', async () => {
    renderWithSuspense(<POForm />)
    // Allow up to 5 s on the first render — the lazy route module needs to load
    await waitFor(() => {
      expect(screen.getByTestId('date-picker')).toBeInTheDocument()
      expect(screen.getByTestId('otp-input')).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('shows a PO uniqueness error when the uniqueness API returns not-unique', async () => {
    mockStore.poNumber = '12345'
    mockAxiosGet.mockImplementation((url: string) => {
      if (url.includes('ar-customers')) return Promise.resolve({ data: [] })
      return Promise.resolve({ data: { unique: false } })
    })

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
    mockAxiosGet.mockImplementation((url: string) => {
      if (url.includes('ar-customers')) return Promise.resolve({ data: [] })
      return Promise.resolve({ data: { unique: true } })
    })

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

  it.each(['Rankin', 'Sarnia', 'Walpole', 'Jocko Point'])('does not render the Number section or OTP input for site "%s"', async (site) => {
    mockStore.stationName = site
    renderWithSuspense(<POForm />)

    await waitFor(() => {
      expect(screen.getByTestId('date-picker')).toBeInTheDocument()
    }, { timeout: 5000 })

    expect(screen.queryByText('Number')).not.toBeInTheDocument()
    expect(screen.queryByTestId('otp-input')).not.toBeInTheDocument()
  })

  it.each(['Rankin', 'Sarnia', 'Walpole', 'Jocko Point'])('does not auto-fill a fleet card from quick-select on site "%s"', async (site) => {
    mockStore.stationName = site
    mockAxiosGet.mockImplementation((url: string) => {
      if (url.includes('quick-select')) {
        return Promise.resolve({
          data: [{ _id: 'qc1', name: 'Acme Co', fleetCardNumber: '1234567890123456', order: 0 }],
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderWithSuspense(<POForm />)
    const quickBtn = await waitFor(() => screen.getByRole('button', { name: 'Acme' }), { timeout: 5000 })
    fireEvent.click(quickBtn)

    await waitFor(() => expect(mockStore.setCustomerName).toHaveBeenCalledWith('Acme Co'))
    expect(mockStore.setFleetCardNumber).not.toHaveBeenCalledWith('1234567890123456')
    expect(screen.queryByTestId('otp-input')).not.toBeInTheDocument()
  })

  it('shows only the first word of a customer name on the quick-select button', async () => {
    mockAxiosGet.mockImplementation((url: string) => {
      if (url.includes('quick-select')) {
        return Promise.resolve({
          data: [{ _id: 'qc1', name: 'Batchewana Frist Nation of Ojibways', fleetCardNumber: '', order: 0 }],
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderWithSuspense(<POForm />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Batchewana' })).toBeInTheDocument()
    , { timeout: 5000 })
    expect(screen.queryByText('Batchewana Frist Nation of Ojibways')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Batchewana' }))
    expect(mockStore.setCustomerName).toHaveBeenCalledWith('Batchewana Frist Nation of Ojibways')
  })

  it('falls back to the cached AR customer list when the fetch fails (offline)', async () => {
    localStorage.setItem('po_cachedArCustomers', JSON.stringify([{ _id: 'c1', name: 'Jane Doe Trucking' }]))
    mockAxiosGet.mockImplementation((url: string) => {
      if (url.includes('ar-customers/quick-select')) return Promise.resolve({ data: [] })
      if (url.includes('ar-customers')) {
        return Promise.reject(Object.assign(new Error('Network Error'), { isAxiosErr: true }))
      }
      return Promise.resolve({ data: [] })
    })

    renderWithSuspense(<POForm />)

    const nameInput = await waitFor(() => screen.getByDisplayValue('Jane Doe'), { timeout: 5000 })
    fireEvent.focus(nameInput)

    await waitFor(() => expect(screen.getByText('Jane Doe Trucking')).toBeInTheDocument())

    localStorage.removeItem('po_cachedArCustomers')
  })

  it('caches the AR customer list to localStorage on a successful fetch', async () => {
    localStorage.removeItem('po_cachedArCustomers')
    const fetchedCustomers = [{ _id: 'c2', name: 'Acme Co' }]
    mockAxiosGet.mockImplementation((url: string) => {
      if (url.includes('ar-customers/quick-select')) return Promise.resolve({ data: [] })
      if (url.includes('ar-customers')) return Promise.resolve({ data: fetchedCustomers })
      return Promise.resolve({ data: [] })
    })

    renderWithSuspense(<POForm />)

    await waitFor(() => {
      const cached = localStorage.getItem('po_cachedArCustomers')
      expect(cached ? JSON.parse(cached) : null).toEqual(fetchedCustomers)
    }, { timeout: 5000 })
  })

  it('falls back to the cached quick-select list for a station when the fetch fails (offline)', async () => {
    // mockStore.stationName defaults to 'TestSite' (see resetStore)
    localStorage.setItem('po_cachedQuickSelect_TestSite', JSON.stringify([
      { _id: 'qc1', name: 'Cached Customer', fleetCardNumber: '', order: 0 },
    ]))
    mockAxiosGet.mockImplementation((url: string) => {
      if (url.includes('ar-customers/quick-select')) {
        return Promise.reject(Object.assign(new Error('Network Error'), { isAxiosErr: true }))
      }
      return Promise.resolve({ data: [] })
    })

    renderWithSuspense(<POForm />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Cached' })).toBeInTheDocument()
    , { timeout: 5000 })

    localStorage.removeItem('po_cachedQuickSelect_TestSite')
  })

  it('shows a custom label on the quick-select button instead of the first word, when set', async () => {
    mockAxiosGet.mockImplementation((url: string) => {
      if (url.includes('quick-select')) {
        return Promise.resolve({
          data: [{ _id: 'qc1', name: 'Three fires development corporation', fleetCardNumber: '', label: 'Three Fires', order: 0 }],
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderWithSuspense(<POForm />)

    const quickBtn = await waitFor(() => screen.getByRole('button', { name: 'Three Fires' }), { timeout: 5000 })
    expect(screen.queryByText('Three', { selector: 'button' })).not.toBeInTheDocument()

    fireEvent.click(quickBtn)
    expect(mockStore.setCustomerName).toHaveBeenCalledWith('Three fires development corporation')
  })

  it.each(['Rankin', 'Sarnia', 'Walpole', 'Jocko Point'])('does not pad poNumber to "00000" when clicking Upload Receipt on site "%s"', async (site) => {
    mockStore.stationName = site
    mockStore.receipt = null
    renderWithSuspense(<POForm />)

    const uploadBtn = await waitFor(() => screen.getByRole('button', { name: /upload receipt/i }), { timeout: 5000 })
    fireEvent.click(uploadBtn)

    expect(mockStore.setPoNumber).not.toHaveBeenCalledWith('00000')
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

  it('sends startDate/endDate as plain "yyyy-MM-dd" strings', async () => {
    renderWithSuspense(<POList />)
    await waitFor(() =>
      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/purchase-orders'),
        expect.objectContaining({
          params: expect.objectContaining({
            startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          }),
        })
      )
    )
  })

  it('prefers dateStr over the legacy date field when displaying a row', async () => {
    mockAxiosGet.mockResolvedValue({
      status: 200,
      data: [{ ...sampleOrders[0], date: '2026-01-15T12:00:00Z', dateStr: '2026-01-16' }],
    })
    renderWithSuspense(<POList />)
    await waitFor(() => expect(screen.getByText('2026-01-16')).toBeInTheDocument())
  })

  it('falls back to a UTC-derived date when dateStr is absent (legacy row)', async () => {
    renderWithSuspense(<POList />)
    await waitFor(() => expect(screen.getByText('2026-01-15')).toBeInTheDocument())
  })

  it('sends a plain "yyyy-mm-dd" string when saving a changed date', async () => {
    mockAxiosPut.mockResolvedValue({
      data: { ...sampleOrders[0], date: '2026-02-01T12:00:00.000Z', dateStr: '2026-02-01' },
    })
    renderWithSuspense(<POList />)
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /change date/i }))
    const dateInput = screen.getByLabelText('Date') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-02-01' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockAxiosPut).toHaveBeenCalledWith(
        expect.stringContaining('/api/purchase-orders/order-1'),
        { date: '2026-02-01' },
        expect.any(Object)
      )
    )
    await waitFor(() => expect(screen.getByText('2026-02-01')).toBeInTheDocument())
  })

  it('keeps showing previously loaded orders when a refresh fetch fails (offline)', async () => {
    renderWithSuspense(<POList />)
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())

    // Simulate the connection dropping on a subsequent refresh (e.g. switching site).
    mockAxiosGet.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { isAxiosErr: true }))
    fireEvent.click(screen.getByTestId('location-picker'))

    // The table should still show the last successfully fetched order, not blank out.
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
  })

  it('shows a queued purchase order from the offline sync queue as "Pending upload"', async () => {
    mockAxiosGet.mockResolvedValue({ status: 200, data: [] })
    mockGetPendingActions.mockResolvedValueOnce([
      {
        type: 'CREATE_PURCHASE_ORDER',
        queuedAt: 12345,
        receipt: 'data:image/png;base64,queued',
        payload: {
          source: 'PO',
          date: '2026-01-01',
          stationName: 'Rankin',
          fleetCardNumber: '',
          poNumber: '99999',
          quantity: 25,
          amount: 50,
          productCode: 'UNL',
          customerName: 'Offline Customer',
          driverName: 'Offline Driver',
          vehicleMakeModel: '',
          licensePlate: '',
          purchaseType: 'fuel',
          itemsDescription: '',
        },
      },
    ])

    renderWithSuspense(<POList />)

    await waitFor(() => expect(screen.getByText('Offline Customer')).toBeInTheDocument())
    expect(screen.getAllByText(/pending upload/i).length).toBeGreaterThan(0)
  })

  it('shows a permanently-failed purchase order with red/error styling and its reason, separate from the pending count', async () => {
    mockAxiosGet.mockResolvedValue({ status: 200, data: [] })
    mockGetPendingActions.mockResolvedValueOnce([
      {
        type: 'CREATE_PURCHASE_ORDER',
        queuedAt: 54321,
        receipt: 'data:image/png;base64,failed',
        failed: true,
        failureReason: 'PO number already exists.',
        _key: 7,
        payload: {
          source: 'PO',
          date: '2026-01-01',
          stationName: 'Rankin',
          fleetCardNumber: '',
          poNumber: '11111',
          quantity: 10,
          amount: 20,
          productCode: 'UNL',
          customerName: 'Failed Customer',
          driverName: 'Failed Driver',
          vehicleMakeModel: '',
          licensePlate: '',
          purchaseType: 'fuel',
          itemsDescription: '',
        },
      },
    ])

    renderWithSuspense(<POList />)

    await waitFor(() => expect(screen.getByText('Failed Customer')).toBeInTheDocument())
    expect(screen.getByText(/upload failed/i)).toBeInTheDocument()
    expect(screen.getByText('PO number already exists.')).toBeInTheDocument()
    // Not counted as "pending upload" — it's terminal, not in progress.
    expect(screen.queryByText(/pending upload/i)).not.toBeInTheDocument()
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
        expect.objectContaining({ source: 'PO', stationName: 'Rankin', vehicleMakeModel: 'Ford F-150', licensePlate: '' }),
        expect.any(Object)
      )
    )
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/po/list' })
    )
  })

  it('sends date as a plain "yyyy-MM-dd" string, not a full datetime', async () => {
    renderWithQuery(<POSignature />)

    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() =>
      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/api/purchase-orders'),
        expect.objectContaining({ date: '2026-01-15' }),
        expect.any(Object)
      )
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

  // The submit handler no longer makes any network call at all — it always
  // saves locally first (see receipt.tsx). These tests replace the old
  // ones that exercised a live axios.post path, which no longer exists.

  it('always saves the purchase order to the local queue immediately, regardless of connectivity', async () => {
    // A blocking window.alert() freezes the tab's repaint until dismissed —
    // on a device with no visible dialog chrome that looks identical to the
    // submit being permanently stuck on "Saving...". Confirm the success
    // path never calls it (regression test for that exact bug).
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    renderWithQuery(<POReceipt />)

    const submitBtn = screen.getByRole('button', { name: /finalize|submit/i })
    fireEvent.click(submitBtn)

    await waitFor(() =>
      expect(mockSavePendingAction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CREATE_PURCHASE_ORDER',
          receipt: 'data:image/png;base64,abc',
          payload: expect.objectContaining({ source: 'PO', stationName: 'TestSite' }),
        })
      )
    )
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/po/list' }))
    expect(alertSpy).not.toHaveBeenCalled()

    alertSpy.mockRestore()
  })

  it('never calls axios/uploadBase64Image directly, even when isActuallyOnline resolves true', async () => {
    mockIsActuallyOnline.mockResolvedValue(true)

    renderWithQuery(<POReceipt />)

    const submitBtn = screen.getByRole('button', { name: /finalize|submit/i })
    fireEvent.click(submitBtn)

    await waitFor(() => expect(mockSavePendingAction).toHaveBeenCalled())
    expect(mockAxiosPost).not.toHaveBeenCalled()
    expect(mockUploadBase64Image).not.toHaveBeenCalled()
  })

  it('triggers a background sync attempt after queuing, without blocking navigation', async () => {
    // Never resolves — proves navigation doesn't wait on this at all, which
    // is the concrete regression test for the stuck-"Saving..." bug: the fix
    // isn't "make the network check faster," it's "don't have one in the
    // critical path at all."
    mockTriggerBackgroundSync.mockReturnValue(new Promise(() => {}))

    renderWithQuery(<POReceipt />)

    const submitBtn = screen.getByRole('button', { name: /finalize|submit/i })
    fireEvent.click(submitBtn)

    await waitFor(() => expect(mockSavePendingAction).toHaveBeenCalled())
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/po/list' }))
    expect(mockTriggerBackgroundSync).toHaveBeenCalled()
  })

  it('sends date as a plain "yyyy-MM-dd" string, not a full datetime', async () => {
    renderWithQuery(<POReceipt />)

    const submitBtn = screen.getByRole('button', { name: /finalize|submit/i })
    fireEvent.click(submitBtn)

    await waitFor(() =>
      expect(mockSavePendingAction).toHaveBeenCalledWith(
        expect.objectContaining({ payload: expect.objectContaining({ date: '2026-01-15' }) })
      )
    )
  })

  it('double-clicking Finalize & Submit only queues one pending action', async () => {
    renderWithQuery(<POReceipt />)

    const submitBtn = screen.getByRole('button', { name: /finalize|submit/i })
    fireEvent.click(submitBtn)
    fireEvent.click(submitBtn)

    await waitFor(() => expect(mockSavePendingAction).toHaveBeenCalled())
    expect(mockSavePendingAction).toHaveBeenCalledTimes(1)
  })
})
