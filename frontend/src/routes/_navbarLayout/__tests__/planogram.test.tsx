import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

// ─── Hoisted mutable state ─────────────────────────────────────────────────────

const { mockNavigate, mockAxiosPost, mockAxiosGet, mockToastError } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockAxiosPost: vi.fn(),
  mockAxiosGet: vi.fn(),
  mockToastError: vi.fn(),
}))

// ─── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (config: any) => ({
      ...config,
      fullPath: '/_navbarLayout/planogram',
    }),
    useNavigate: () => mockNavigate,
  }
})

vi.mock('axios', () => ({
  default: { post: mockAxiosPost, get: mockAxiosGet, isAxiosError: vi.fn(() => false) },
}))

vi.mock('sonner', () => ({
  Toaster: () => null,
  toast: { error: mockToastError, success: vi.fn() },
}))

vi.mock('@/components/custom/locationPicker', () => ({
  LocationPicker: ({ setStationName }: any) => (
    <button data-testid="location-picker" onClick={() => setStationName('Silver Grizzly')}>
      Location
    </button>
  ),
}))

// A file is "dropped" by invoking the onDrop the component handed to the hook.
let dropFiles: ((files: Array<File>) => void) | null = null
vi.mock('react-dropzone', () => ({
  useDropzone: ({ onDrop }: any) => {
    dropFiles = onDrop
    return {
      getRootProps: () => ({ 'data-testid': 'dropzone' }),
      getInputProps: () => ({ type: 'file', accept: '.xlsx' }),
      isDragActive: false,
    }
  },
}))

// ─── Component import (after mocks) ───────────────────────────────────────────

import { Route as PlanogramRoute } from '../planogram'

const Planogram = (PlanogramRoute as any).component as React.ComponentType

const renderWithSuspense = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <React.Suspense fallback={null}>{children}</React.Suspense>
    ),
  })

const xlsxFile = () =>
  new File(['fake'], 'Silver Grizzly Back Wall Planogram.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Planogram upload page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dropFiles = null
    mockAxiosGet.mockResolvedValue({ data: { exists: false } })
    localStorage.setItem('token', 'test-token')
  })

  it('renders the heading and the dropzone', async () => {
    renderWithSuspense(<Planogram />)
    await waitFor(() => expect(screen.getByText('Planogram')).toBeInTheDocument(), {
      timeout: 5000,
    })
    expect(screen.getByTestId('dropzone')).toBeInTheDocument()
    expect(screen.getByText(/Only Excel files are accepted/i)).toBeInTheDocument()
  })

  it('shows the selected file once one is dropped', async () => {
    renderWithSuspense(<Planogram />)
    await waitFor(() => expect(screen.getByTestId('dropzone')).toBeInTheDocument(), {
      timeout: 5000,
    })

    dropFiles!([xlsxFile()])

    await waitFor(() =>
      expect(screen.getByText('Silver Grizzly Back Wall Planogram.xlsx')).toBeInTheDocument(),
    )
  })

  it('refuses to upload without a site and never calls the API', async () => {
    renderWithSuspense(<Planogram />)
    await waitFor(() => expect(screen.getByTestId('dropzone')).toBeInTheDocument(), {
      timeout: 5000,
    })

    dropFiles!([xlsxFile()])
    await waitFor(() => screen.getByRole('button', { name: /^Upload$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Upload$/i }))

    await waitFor(() => expect(mockToastError).toHaveBeenCalled())
    expect(mockAxiosPost).not.toHaveBeenCalled()
  })

  it('sends the site in the query string, not the form body', async () => {
    mockAxiosPost.mockResolvedValue({
      data: {
        message: 'ok',
        site: 'Silver Grizzly',
        gtinCount: 60,
        previousCount: 0,
        sheetNames: ['Aisle 1'],
        perSheet: [{ sheet: 'Aisle 1', accepted: 60 }],
        rejectedCells: 3,
        headerDetected: true,
        suspiciousGtins: [],
      },
    })

    renderWithSuspense(<Planogram />)
    await waitFor(() => expect(screen.getByTestId('location-picker')).toBeInTheDocument(), {
      timeout: 5000,
    })

    fireEvent.click(screen.getByTestId('location-picker'))
    dropFiles!([xlsxFile()])
    await waitFor(() => screen.getByRole('button', { name: /^Upload$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Upload$/i }))

    await waitFor(() => expect(mockAxiosPost).toHaveBeenCalled())
    const [url, body, opts] = mockAxiosPost.mock.calls[0]
    expect(url).toContain('site=Silver%20Grizzly')
    expect(body).toBeInstanceOf(FormData)
    expect(opts.headers['X-Required-Permission']).toBe('planogram.upload')
  })

  it('reports the saved GTIN count and any placeholder GTINs', async () => {
    mockAxiosPost.mockResolvedValue({
      data: {
        message: 'ok',
        site: 'Silver Grizzly',
        gtinCount: 60,
        previousCount: 0,
        sheetNames: ['Aisle 1'],
        perSheet: [{ sheet: 'Aisle 1', accepted: 60 }],
        rejectedCells: 3,
        headerDetected: true,
        suspiciousGtins: ['00000000000338'],
      },
    })

    renderWithSuspense(<Planogram />)
    await waitFor(() => expect(screen.getByTestId('location-picker')).toBeInTheDocument(), {
      timeout: 5000,
    })
    fireEvent.click(screen.getByTestId('location-picker'))
    dropFiles!([xlsxFile()])
    await waitFor(() => screen.getByRole('button', { name: /^Upload$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Upload$/i }))

    await waitFor(() =>
      expect(screen.getByText(/60 GTINs saved for Silver Grizzly/i)).toBeInTheDocument(),
    )
    expect(screen.getByText(/1 placeholder GTIN/i)).toBeInTheDocument()
  })

  // A big shrink is the signal for a wrong or truncated file, so it must not
  // replace a good planogram without an explicit confirmation.
  it('asks for confirmation on a large shrink and resends with confirm=true', async () => {
    mockAxiosPost.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { needsConfirmation: true, previousCount: 60, newCount: 5 },
      },
    })

    renderWithSuspense(<Planogram />)
    await waitFor(() => expect(screen.getByTestId('location-picker')).toBeInTheDocument(), {
      timeout: 5000,
    })
    fireEvent.click(screen.getByTestId('location-picker'))
    dropFiles!([xlsxFile()])
    await waitFor(() => screen.getByRole('button', { name: /^Upload$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Upload$/i }))

    await waitFor(() =>
      expect(screen.getByText(/This file has 5 GTINs, replacing 60/i)).toBeInTheDocument(),
    )

    mockAxiosPost.mockResolvedValueOnce({
      data: {
        message: 'ok', site: 'Silver Grizzly', gtinCount: 5, previousCount: 60,
        sheetNames: ['Aisle 1'], perSheet: [{ sheet: 'Aisle 1', accepted: 5 }],
        rejectedCells: 0, headerDetected: true, suspiciousGtins: [],
      },
    })
    fireEvent.click(screen.getByRole('button', { name: /Replace anyway/i }))

    await waitFor(() => expect(mockAxiosPost).toHaveBeenCalledTimes(2))
    expect(mockAxiosPost.mock.calls[1][0]).toContain('confirm=true')
  })

  it('explains why a file parsed to nothing', async () => {
    mockAxiosPost.mockRejectedValueOnce({
      response: {
        status: 422,
        data: {
          message: 'No valid GTINs found. The existing planogram was NOT modified.',
          sheetNames: ['Other Aggregates'],
          perSheet: [],
          rejectedCells: 2,
          headerDetected: false,
        },
      },
    })

    renderWithSuspense(<Planogram />)
    await waitFor(() => expect(screen.getByTestId('location-picker')).toBeInTheDocument(), {
      timeout: 5000,
    })
    fireEvent.click(screen.getByTestId('location-picker'))
    dropFiles!([xlsxFile()])
    await waitFor(() => screen.getByRole('button', { name: /^Upload$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Upload$/i }))

    await waitFor(() =>
      expect(screen.getByText(/existing planogram was NOT modified/i)).toBeInTheDocument(),
    )
    expect(screen.getByText(/Other Aggregates/)).toBeInTheDocument()
    expect(screen.getByText(/GTIN column header detected:\s*no/i)).toBeInTheDocument()
  })

  it('says when a site has no planogram yet', async () => {
    renderWithSuspense(<Planogram />)
    await waitFor(() => expect(screen.getByTestId('location-picker')).toBeInTheDocument(), {
      timeout: 5000,
    })
    fireEvent.click(screen.getByTestId('location-picker'))

    await waitFor(() =>
      expect(screen.getByText(/No planogram on file for Silver Grizzly/i)).toBeInTheDocument(),
    )
  })
})
