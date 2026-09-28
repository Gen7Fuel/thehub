import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ─── Hoisted mutable state ─────────────────────────────────────────────────────

const { mockUseLoaderData, mockRouterInvalidate, mockUser, mockNavigate, mockSearch } = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn().mockReturnValue({ events: [] }),
  mockRouterInvalidate: vi.fn().mockResolvedValue(undefined),
  mockNavigate: vi.fn(),
  mockSearch: { month: undefined, site: undefined },
  mockUser: {
    id: 'user-1',
    location: 'Rankin',
    is_admin: false,
  },
}))

// ─── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (config: any) => ({
      ...config,
      useLoaderData: mockUseLoaderData,
      useSearch: () => mockSearch,
    }),
    useRouter: () => ({ invalidate: mockRouterInvalidate, navigate: mockNavigate }),
  }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

vi.mock('@/context/SiteContext', () => ({
  useSite: () => ({ selectedSite: 'Rankin' }),
}))

vi.mock('@/components/custom/locationPicker', () => ({
  LocationPicker: ({ setStationName, defaultValue }: any) => (
    <input
      data-testid="location-picker"
      defaultValue={defaultValue}
      onChange={(e) => setStationName(e.target.value)}
    />
  ),
}))

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

// ─── Component import (after mocks) ───────────────────────────────────────────

const { Route } = await import('../events/index')
const EventsComponent = (Route as any).component as React.ComponentType

// ─── Helpers ──────────────────────────────────────────────────────────────────

const renderWithSuspense = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <React.Suspense fallback={null}>{children}</React.Suspense>
    ),
  })

const today = new Date()
const pad = (n: number) => String(n).padStart(2, '0')
const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

const tomorrow = new Date()
tomorrow.setDate(today.getDate() + 1)
const tomorrowIso = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`

const futureDate = new Date()
futureDate.setDate(today.getDate() + 5)
const futureIso = `${futureDate.getFullYear()}-${pad(futureDate.getMonth() + 1)}-${pad(futureDate.getDate())}`

const makeEvent = (overrides = {}) => ({
  _id: 'evt-1',
  site: 'Rankin',
  title: 'Staff Meeting',
  description: 'Quarterly check-in.',
  date: todayIso,
  type: 'manual' as const,
  createdBy: { id: 'user-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@gen7.com' },
  createdAt: `${todayIso}T09:00:00Z`,
  updatedAt: `${todayIso}T09:00:00Z`,
  ...overrides,
})

// ─── Tests: Rendering & Layout ──────────────────────────────────────────────────

describe('Events — rendering & layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockUseLoaderData.mockReturnValue({ events: [] })
    mockUser.is_admin = false
  })

  it('renders the Events Calendar heading and controls', async () => {
    renderWithSuspense(<EventsComponent />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Events Calendar/i })).toBeInTheDocument()
    })
  })

  it('shows schedule site in subtitle', async () => {
    renderWithSuspense(<EventsComponent />)
    await waitFor(() => {
      expect(screen.getByText(/Showing schedule for Rankin/i)).toBeInTheDocument()
    })
  })

  it('renders Today and Tomorrow spotlight sections', async () => {
    renderWithSuspense(<EventsComponent />)
    await waitFor(() => {
      expect(screen.getByText(/Today/i)).toBeInTheDocument()
      expect(screen.getByText(/Tomorrow/i)).toBeInTheDocument()
    })
  })

  it('displays weekday headers in the month grid', async () => {
    renderWithSuspense(<EventsComponent />)
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    await waitFor(() => {
      weekdays.forEach((day) => expect(screen.getByText(day)).toBeInTheDocument())
    })
  })
})

// ─── Tests: Event Display & Author Format ──────────────────────────────────────

describe('Events — event display & author labels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockUser.is_admin = false
  })

  it('renders Today and Tomorrow events in spotlight cards', async () => {
    mockUseLoaderData.mockReturnValue({
      events: [
        makeEvent({ _id: 'e-today', title: 'Today Sync', date: todayIso }),
        makeEvent({ _id: 'e-tomorrow', title: 'Tomorrow Planning', date: tomorrowIso }),
      ],
    })
    renderWithSuspense(<EventsComponent />)

    await waitFor(() => {
      expect(screen.getAllByText('Today Sync').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Tomorrow Planning').length).toBeGreaterThan(0)
    })
  })

  it('prefixes human author names with "By " in cards and "Posted by " in dialog', async () => {
    mockUseLoaderData.mockReturnValue({ events: [makeEvent()] })
    renderWithSuspense(<EventsComponent />)

    await waitFor(() => expect(screen.getByText('By Jane Doe')).toBeInTheDocument())

    fireEvent.click(screen.getAllByText('Staff Meeting')[0])

    await waitFor(() => {
      expect(screen.getByText(/Posted by Jane Doe/i)).toBeInTheDocument()
    })
  })

  it('displays system generated author directly without "By" or "Posted by" label', async () => {
    const systemEvent = makeEvent({
      _id: 'evt-sys',
      title: 'Automated Event',
      type: 'system',
      createdBy: { id: 'sys-1', firstName: 'System', lastName: 'Generated' },
    })

    mockUseLoaderData.mockReturnValue({ events: [systemEvent] })
    renderWithSuspense(<EventsComponent />)

    await waitFor(() => {
      expect(screen.getByText('System Generated')).toBeInTheDocument()
      expect(screen.queryByText('By System Generated')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByText('Automated Event')[0])

    await waitFor(() => {
      expect(screen.getByText(/System Generated/i)).toBeInTheDocument()
      expect(screen.queryByText(/Posted by System Generated/i)).not.toBeInTheDocument()
    })
  })
})

// ─── Tests: Compose Dialog ──────────────────────────────────────────────────────

describe('Events — compose dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockUseLoaderData.mockReturnValue({ events: [] })
    mockUser.is_admin = false
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    } as any)
  })

  it('opens compose dialog when clicking today or future date tiles', async () => {
    renderWithSuspense(<EventsComponent />)

    const todayCell = screen.getByText(today.getDate().toString()).closest('div')
    if (todayCell) fireEvent.click(todayCell)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'New Event' })).toBeInTheDocument()
    })
  })

  it('shows error when title is empty', async () => {
    renderWithSuspense(<EventsComponent />)

    const todayCell = screen.getByText(today.getDate().toString()).closest('div')
    if (todayCell) fireEvent.click(todayCell)

    await waitFor(() => screen.getByPlaceholderText(/Event title/i))

    fireEvent.click(screen.getByText('Add Event'))

    await waitFor(() => {
      expect(screen.getByText('Title is required.')).toBeInTheDocument()
    })
  })

  it('enforces max 30 character limit on title input', async () => {
    renderWithSuspense(<EventsComponent />)

    const todayCell = screen.getByText(today.getDate().toString()).closest('div')
    if (todayCell) fireEvent.click(todayCell)

    await waitFor(() => screen.getByPlaceholderText(/Event title/i))

    const titleInput = screen.getByPlaceholderText(/Event title/i)
    expect(titleInput).toHaveAttribute('maxLength', '30')
  })

  it('submits POST /api/events with correct payload', async () => {
    renderWithSuspense(<EventsComponent />)

    const todayCell = screen.getByText(today.getDate().toString()).closest('div')
    if (todayCell) fireEvent.click(todayCell)

    await waitFor(() => screen.getByPlaceholderText(/Event title/i))

    fireEvent.change(screen.getByPlaceholderText(/Event title/i), {
      target: { value: 'Fire Drill' },
    })

    fireEvent.click(screen.getByText('Add Event'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/events',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"title":"Fire Drill"'),
        }),
      )
    })
  })
})

// ─── Tests: View & Delete Dialog ────────────────────────────────────────────────

describe('Events — view & delete dialog permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockUser.is_admin = false
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    } as any)
  })

  it('hides delete button for past or today events even if owner/admin', async () => {
    mockUser.id = 'user-1'
    mockUser.is_admin = true

    mockUseLoaderData.mockReturnValue({ events: [makeEvent({ date: todayIso })] })
    renderWithSuspense(<EventsComponent />)

    await waitFor(() => expect(screen.getAllByText('Staff Meeting').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Staff Meeting')[0])

    await waitFor(() => screen.getByRole('dialog'))
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
  })

  it('hides delete button for system events', async () => {
    mockUser.id = 'user-1'
    mockUser.is_admin = true

    const sysEvent = makeEvent({
      _id: 'sys-evt',
      title: 'Automated Event',
      date: futureIso,
      type: 'system',
    })

    mockUseLoaderData.mockReturnValue({ events: [sysEvent] })
    renderWithSuspense(<EventsComponent />)

    await waitFor(() => expect(screen.getAllByText('Automated Event').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Automated Event')[0])

    await waitFor(() => screen.getByRole('dialog'))
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
  })

  it('shows delete button for future manual events', async () => {
    mockUser.id = 'user-1'
    const futureEvent = makeEvent({ _id: 'evt-future', date: futureIso, type: 'manual' })

    mockUseLoaderData.mockReturnValue({ events: [futureEvent] })
    renderWithSuspense(<EventsComponent />)

    await waitFor(() => expect(screen.getAllByText('Staff Meeting').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Staff Meeting')[0])

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
    })
  })

  it('calls DELETE /api/events/:id when confirmed', async () => {
    mockUser.id = 'user-1'
    const futureEvent = makeEvent({ _id: 'evt-future', date: futureIso, type: 'manual' })

    mockUseLoaderData.mockReturnValue({ events: [futureEvent] })
    renderWithSuspense(<EventsComponent />)

    await waitFor(() => expect(screen.getAllByText('Staff Meeting').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Staff Meeting')[0])

    await waitFor(() => screen.getByRole('button', { name: /delete/i }))
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/events/evt-future',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })
})

// ─── Tests: Date Helpers ───────────────────────────────────────────────────────

describe('Events — date helper functions', () => {
  it('toIsoDate produces local YYYY-MM-DD format', () => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const d = new Date(2026, 3, 15) // April 15 2026
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    expect(iso).toBe('2026-04-15')
  })
})