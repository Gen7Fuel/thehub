import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ─── Hoisted mutable state ─────────────────────────────────────────────────────

const { mockNavigate, mockUseSearch, mockUseLoaderData, mockUseAuth, mockUploadBase64Image } =
  vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockUseSearch: vi.fn().mockReturnValue({ site: 'Rankin', date: '2026-03-13' }),
    mockUseLoaderData: vi.fn().mockReturnValue({
      site: 'Rankin', from: '2026-03-07', to: '2026-03-13', data: null,
    }),
    mockUseAuth: vi.fn().mockReturnValue({
      user: {
        access: {
          accounting: {
            fuelRec: { bol: true, list: true, requestAgain: true, delete: true },
          },
        },
      },
    }),
    mockUploadBase64Image: vi.fn().mockResolvedValue({ filename: 'uuid-test.jpg' }),
  }))

// ─── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (config: any) => ({
      ...config,
      useSearch: mockUseSearch,
      useLoaderData: mockUseLoaderData,
    }),
    useNavigate: () => mockNavigate,
    useLoaderData: () => mockUseLoaderData(),
    Link: ({ children, to }: any) => <a href={to}>{children}</a>,
    Outlet: () => <div data-testid="outlet" />,
    useMatchRoute: () => () => false,
  }
})

vi.mock('@/context/SiteContext', () => ({
  useSite: () => ({ selectedSite: '', setSelectedSite: vi.fn() }),
}))

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

vi.mock('@/components/custom/datePicker', () => ({
  DatePicker: ({ date }: any) => (
    <div data-testid="date-picker">{date?.toISOString?.() || 'no date'}</div>
  ),
}))

vi.mock('@/components/custom/datePickerWithRange', () => ({
  DatePickerWithRange: () => <div data-testid="date-range-picker" />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}))

vi.mock('@/lib/utils', () => ({
  uploadBase64Image: mockUploadBase64Image,
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@react-pdf/renderer', () => ({
  pdf: vi.fn().mockReturnValue({ toBlob: vi.fn().mockResolvedValue(new Blob()) }),
  Document: ({ children }: any) => <>{children}</>,
  Page: ({ children }: any) => <>{children}</>,
  Image: () => null,
  StyleSheet: { create: (s: any) => s },
}))

// ─── Component imports (after mocks) ──────────────────────────────────────────

import { Route as LayoutRoute } from '../../fuel-rec'
import { Route as BolRoute } from '../index'
import { Route as ListRoute } from '../list'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const renderWithSuspense = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <React.Suspense fallback={null}>{children}</React.Suspense>
    ),
  })

const Layout = (LayoutRoute as any).component as React.ComponentType
const BolCapture = (BolRoute as any).component as React.ComponentType
const BolList = (ListRoute as any).component as React.ComponentType

const sampleEntries = [
  {
    _id: 'entry-1',
    site: 'Rankin',
    date: '2026-03-13',
    filename: 'uuid-abc.jpg',
    bolNumber: 'BOL-001',
    comments: [],
  },
  {
    _id: 'entry-2',
    site: 'Rankin',
    date: '2026-03-12',
    filename: 'uuid-def.jpg',
    bolNumber: 'BOL-002',
    comments: [{ text: 'Needs retake', createdAt: '2026-03-12T10:00:00Z', user: 'admin' }],
  },
]

// ─── Fuel Rec Layout — fuel-rec.tsx ───────────────────────────────────────────

describe('Fuel Rec Layout — fuel-rec.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: {
        access: {
          accounting: {
            fuelRec: { bol: true, list: true },
          },
        },
      },
    })
  })

  it('renders the BOL tab when user has bol permission', async () => {
    renderWithSuspense(<Layout />)
    await waitFor(
      () => expect(screen.getByText('BOL')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders the List tab when user has list permission', async () => {
    renderWithSuspense(<Layout />)
    await waitFor(() => expect(screen.getByText('List')).toBeInTheDocument(), { timeout: 5000 })
  })

  it('hides BOL tab when user lacks bol permission', async () => {
    mockUseAuth.mockReturnValue({
      user: { access: { accounting: { fuelRec: { bol: false, list: true } } } },
    })
    renderWithSuspense(<Layout />)
    await waitFor(() => expect(screen.queryByText('BOL')).not.toBeInTheDocument(), { timeout: 5000 })
    expect(screen.getByText('List')).toBeInTheDocument()
  })

  it('hides List tab when user lacks list permission', async () => {
    mockUseAuth.mockReturnValue({
      user: { access: { accounting: { fuelRec: { bol: true, list: false } } } },
    })
    renderWithSuspense(<Layout />)
    await waitFor(() => expect(screen.queryByText('List')).not.toBeInTheDocument(), { timeout: 5000 })
    expect(screen.getByText('BOL')).toBeInTheDocument()
  })

  it('renders no tabs when user has no fuelRec permissions', async () => {
    mockUseAuth.mockReturnValue({
      user: { access: { accounting: { fuelRec: {} } } },
    })
    renderWithSuspense(<Layout />)
    await waitFor(() => {
      expect(screen.queryByText('BOL')).not.toBeInTheDocument()
      expect(screen.queryByText('List')).not.toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('renders the Outlet', async () => {
    renderWithSuspense(<Layout />)
    await waitFor(() => expect(screen.getByTestId('outlet')).toBeInTheDocument(), { timeout: 5000 })
  })
})

// ─── BOL Capture Form — fuel-rec/index.tsx ────────────────────────────────────

describe('BOL Capture Form — fuel-rec/index.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockUseSearch.mockReturnValue({ site: 'Rankin', date: '2026-03-13' })
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) })
    mockUploadBase64Image.mockResolvedValue({ filename: 'uuid-test.jpg' })
  })

  it('renders the "Fuel Receipt Capture" heading', async () => {
    renderWithSuspense(<BolCapture />)
    await waitFor(
      () => expect(screen.getByText(/fuel receipt capture/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders the SitePicker', async () => {
    renderWithSuspense(<BolCapture />)
    await waitFor(
      () => expect(screen.getByTestId('site-picker')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders the DatePicker', async () => {
    renderWithSuspense(<BolCapture />)
    await waitFor(
      () => expect(screen.getByTestId('date-picker')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders the BOL Number input', async () => {
    renderWithSuspense(<BolCapture />)
    await waitFor(
      () => expect(screen.getByLabelText(/bol number/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders the "Capture BOL Image" button', async () => {
    renderWithSuspense(<BolCapture />)
    await waitFor(
      () => expect(screen.getByText(/capture bol image/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('disables "Capture BOL Image" when BOL number is empty', async () => {
    renderWithSuspense(<BolCapture />)
    const btn = await waitFor(
      () => screen.getByText(/capture bol image/i).closest('button')!,
      { timeout: 5000 }
    )
    expect(btn).toBeDisabled()
  })

  it('enables "Capture BOL Image" when site, date, and BOL number are all set', async () => {
    renderWithSuspense(<BolCapture />)
    const input = await waitFor(
      () => screen.getByLabelText(/bol number/i),
      { timeout: 5000 }
    )
    fireEvent.change(input, { target: { value: 'BOL-001' } })
    const btn = screen.getByText(/capture bol image/i).closest('button')!
    expect(btn).not.toBeDisabled()
  })

  it('shows "Image Captured Successfully" after a photo is captured via file input', async () => {
    // Mock FileReader to immediately fire onloadend with a base64 result
    class MockFileReader {
      result = 'data:image/jpeg;base64,fakeimagedata'
      onloadend: (() => void) | null = null
      readAsDataURL(_: Blob) { setTimeout(() => this.onloadend?.(), 0) }
    }
    vi.stubGlobal('FileReader', MockFileReader)

    renderWithSuspense(<BolCapture />)
    await waitFor(() => screen.getByLabelText(/bol number/i), { timeout: 5000 })

    // Simulate file capture via the hidden input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const fakeFile = new File(['(binary)'], 'bol.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { value: [fakeFile], configurable: true })
    fireEvent.change(fileInput)

    await waitFor(
      () => expect(screen.getByText(/image captured successfully/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows the "Upload & Save BOL" button after photo capture', async () => {
    class MockFileReader {
      result = 'data:image/jpeg;base64,fakeimagedata'
      onloadend: (() => void) | null = null
      readAsDataURL(_: Blob) { setTimeout(() => this.onloadend?.(), 0) }
    }
    vi.stubGlobal('FileReader', MockFileReader)

    renderWithSuspense(<BolCapture />)
    await waitFor(() => screen.getByLabelText(/bol number/i), { timeout: 5000 })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const fakeFile = new File(['(binary)'], 'bol.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { value: [fakeFile], configurable: true })
    fireEvent.change(fileInput)

    await waitFor(
      () => expect(screen.getByText(/upload & save bol/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('navigates to /fuel-rec/list after successful upload and save', async () => {
    class MockFileReader {
      result = 'data:image/jpeg;base64,fakeimagedata'
      onloadend: (() => void) | null = null
      readAsDataURL(_: Blob) { setTimeout(() => this.onloadend?.(), 0) }
    }
    vi.stubGlobal('FileReader', MockFileReader)

    renderWithSuspense(<BolCapture />)
    const bolInput = await waitFor(() => screen.getByLabelText(/bol number/i), { timeout: 5000 })
    fireEvent.change(bolInput, { target: { value: 'BOL-999' } })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['img'], 'bol.jpg', { type: 'image/jpeg' })],
      configurable: true,
    })
    fireEvent.change(fileInput)

    const saveBtn = await waitFor(() => screen.getByText(/upload & save bol/i), { timeout: 5000 })
    fireEvent.click(saveBtn)

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/fuel-rec/list' })
      )
    )
  })

  it('navigates to /no-access when save returns 403', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403, text: () => Promise.resolve('') })

    class MockFileReader {
      result = 'data:image/jpeg;base64,fakeimagedata'
      onloadend: (() => void) | null = null
      readAsDataURL(_: Blob) { setTimeout(() => this.onloadend?.(), 0) }
    }
    vi.stubGlobal('FileReader', MockFileReader)

    renderWithSuspense(<BolCapture />)
    const bolInput = await waitFor(() => screen.getByLabelText(/bol number/i), { timeout: 5000 })
    fireEvent.change(bolInput, { target: { value: 'BOL-999' } })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['img'], 'bol.jpg', { type: 'image/jpeg' })],
      configurable: true,
    })
    fireEvent.change(fileInput)

    const saveBtn = await waitFor(() => screen.getByText(/upload & save bol/i), { timeout: 5000 })
    fireEvent.click(saveBtn)

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/no-access' })
    )
  })

  it('retake button clears the captured photo', async () => {
    class MockFileReader {
      result = 'data:image/jpeg;base64,fakeimagedata'
      onloadend: (() => void) | null = null
      readAsDataURL(_: Blob) { setTimeout(() => this.onloadend?.(), 0) }
    }
    vi.stubGlobal('FileReader', MockFileReader)

    renderWithSuspense(<BolCapture />)
    await waitFor(() => screen.getByLabelText(/bol number/i), { timeout: 5000 })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['img'], 'bol.jpg', { type: 'image/jpeg' })],
      configurable: true,
    })
    fireEvent.change(fileInput)

    await waitFor(() => screen.getByText(/image captured successfully/i), { timeout: 5000 })

    // The retake button is the icon-only button inside the captured-image row
    const retake = screen.getByText(/image captured successfully/i)
      .closest('div')!
      .querySelector('button')!
    fireEvent.click(retake)

    await waitFor(() =>
      expect(screen.getByText(/capture bol image/i)).toBeInTheDocument()
    )
  })
})

// ─── BOL List — fuel-rec/list.tsx ─────────────────────────────────────────────

describe('BOL List — fuel-rec/list.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockUseAuth.mockReturnValue({
      user: {
        access: {
          accounting: {
            fuelRec: { bol: true, list: true, requestAgain: true, delete: true },
          },
        },
      },
    })
    mockUseLoaderData.mockReturnValue({
      site: 'Rankin',
      from: '2026-03-07',
      to: '2026-03-13',
      data: { site: 'Rankin', from: '2026-03-07', to: '2026-03-13', count: 2, entries: sampleEntries },
    })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve(''), json: () => Promise.resolve({}),
    })
  })

  it('renders the SitePicker', async () => {
    renderWithSuspense(<BolList />)
    await waitFor(
      () => expect(screen.getByTestId('site-picker')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders the DatePickerWithRange', async () => {
    renderWithSuspense(<BolList />)
    await waitFor(
      () => expect(screen.getByTestId('date-range-picker')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows "Pick a site to view BOL entries" when no site is selected', async () => {
    mockUseLoaderData.mockReturnValue({
      site: '', from: '2026-03-07', to: '2026-03-13', data: null,
    })
    renderWithSuspense(<BolList />)
    await waitFor(
      () => expect(screen.getByText(/pick a site to view bol entries/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows entry count and date range', async () => {
    renderWithSuspense(<BolList />)
    await waitFor(
      () => expect(screen.getByText(/showing 2 entries for rankin/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows "No entries found" when entries list is empty', async () => {
    mockUseLoaderData.mockReturnValue({
      site: 'Rankin',
      from: '2026-03-07',
      to: '2026-03-13',
      data: { site: 'Rankin', from: '2026-03-07', to: '2026-03-13', count: 0, entries: [] },
    })
    renderWithSuspense(<BolList />)
    await waitFor(
      () => expect(screen.getByText(/no entries found/i)).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('renders table headers when entries are present', async () => {
    renderWithSuspense(<BolList />)
    await waitFor(() => {
      expect(screen.getByText('Date')).toBeInTheDocument()
      expect(screen.getByText('BOL Number')).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('renders entry dates and BOL numbers', async () => {
    renderWithSuspense(<BolList />)
    await waitFor(
      () => expect(screen.getByText('2026-03-13')).toBeInTheDocument(),
      { timeout: 5000 }
    )
    expect(screen.getByText('BOL-001')).toBeInTheDocument()
    expect(screen.getByText('2026-03-12')).toBeInTheDocument()
    expect(screen.getByText('BOL-002')).toBeInTheDocument()
  })

  it('renders a PDF download button for each entry', async () => {
    renderWithSuspense(<BolList />)
    await waitFor(
      () => expect(screen.getAllByText('PDF')).toHaveLength(2),
      { timeout: 5000 }
    )
  })

  it('shows the Delete button when user has delete permission', async () => {
    renderWithSuspense(<BolList />)
    await waitFor(
      () => expect(screen.getAllByTitle('Delete')).toHaveLength(2),
      { timeout: 5000 }
    )
  })

  it('hides the Delete button when user lacks delete permission', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        access: { accounting: { fuelRec: { requestAgain: true, delete: false } } },
      },
    })
    renderWithSuspense(<BolList />)
    await waitFor(
      () => expect(screen.queryByTitle('Delete')).not.toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows the "Request Again" button when user has requestAgain permission', async () => {
    renderWithSuspense(<BolList />)
    await waitFor(
      () => expect(screen.getAllByTitle('Request Again')).toHaveLength(2),
      { timeout: 5000 }
    )
  })

  it('hides the "Request Again" button when user lacks requestAgain permission', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        access: { accounting: { fuelRec: { requestAgain: false, delete: true } } },
      },
    })
    renderWithSuspense(<BolList />)
    await waitFor(
      () => expect(screen.queryByTitle('Request Again')).not.toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('shows comment badge when entry has comments', async () => {
    renderWithSuspense(<BolList />)
    // entry-2 has 1 comment → badge "1" should be visible
    await waitFor(
      () => expect(screen.getByText('1')).toBeInTheDocument(),
      { timeout: 5000 }
    )
  })

  it('removes entry from table after successful delete', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') })

    renderWithSuspense(<BolList />)
    const deleteButtons = await waitFor(
      () => screen.getAllByTitle('Delete'),
      { timeout: 5000 }
    )
    fireEvent.click(deleteButtons[0])

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('entry-1'),
        expect.objectContaining({ method: 'DELETE' })
      )
    )
    await waitFor(() => expect(screen.queryByText('BOL-001')).not.toBeInTheDocument())
  })

  it('does not call delete API when confirm is cancelled', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
    renderWithSuspense(<BolList />)
    const deleteButtons = await waitFor(
      () => screen.getAllByTitle('Delete'),
      { timeout: 5000 }
    )
    fireEvent.click(deleteButtons[0])
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('fuel-rec/entry-1'),
      expect.anything()
    )
  })

  it('opens the comments dialog when comment button is clicked', async () => {
    renderWithSuspense(<BolList />)
    const commentButtons = await waitFor(
      () => screen.getAllByTitle('Comments'),
      { timeout: 5000 }
    )
    fireEvent.click(commentButtons[1]) // entry-2 has an existing comment
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    )
  })

  it('shows existing comment text in dialog', async () => {
    renderWithSuspense(<BolList />)
    const commentButtons = await waitFor(
      () => screen.getAllByTitle('Comments'),
      { timeout: 5000 }
    )
    fireEvent.click(commentButtons[1])
    await waitFor(() => expect(screen.getByText('Needs retake')).toBeInTheDocument())
  })

  it('calls POST API when a new comment is submitted', async () => {
    const updatedComments = [
      { text: 'Needs retake', createdAt: '2026-03-12T10:00:00Z', user: 'admin' },
      { text: 'New comment text', createdAt: '2026-03-13T10:00:00Z', user: 'admin' },
    ]
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ comments: updatedComments }),
    })

    renderWithSuspense(<BolList />)
    const commentButtons = await waitFor(
      () => screen.getAllByTitle('Comments'),
      { timeout: 5000 }
    )
    fireEvent.click(commentButtons[0]) // open comment dialog for entry-1

    const textarea = await waitFor(() =>
      screen.getByPlaceholderText(/write a comment/i)
    )
    fireEvent.change(textarea, { target: { value: 'New comment text' } })

    const addBtn = screen.getByText(/add comment/i)
    fireEvent.click(addBtn)

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('entry-1/comment'),
        expect.objectContaining({ method: 'POST' })
      )
    )
  })

  it('sends request-again API call when Request Again button is clicked', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve(''),
    })
    vi.stubGlobal('alert', vi.fn())

    renderWithSuspense(<BolList />)
    const requestAgainButtons = await waitFor(
      () => screen.getAllByTitle('Request Again'),
      { timeout: 5000 }
    )
    fireEvent.click(requestAgainButtons[0])

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/fuel-rec/request-again',
        expect.objectContaining({ method: 'POST' })
      )
    )
  })
})
