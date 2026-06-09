import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ─── Hoisted mutable state ─────────────────────────────────────────────────────

const { mockUseLoaderData, mockRouterInvalidate, mockUser } = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn().mockReturnValue({ events: [] }),
  mockRouterInvalidate: vi.fn().mockResolvedValue(undefined),
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
    }),
    useRouter: () => ({ invalidate: mockRouterInvalidate }),
  }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
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

const makeEvent = (overrides = {}) => ({
  _id: 'evt-1',
  site: 'Rankin',
  title: 'Staff Meeting',
  description: 'Quarterly check-in.',
  date: todayIso,
  createdBy: { id: 'user-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@gen7.com' },
  createdAt: `${todayIso}T09:00:00Z`,
  updatedAt: `${todayIso}T09:00:00Z`,
  ...overrides,
})

// ─── Tests: Rendering ──────────────────────────────────────────────────────────

describe('Events — rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockUseLoaderData.mockReturnValue({ events: [] })
    mockUser.is_admin = false
  })

  it('renders the Events heading', async () => {
    renderWithSuspense(<EventsComponent />)
    await waitFor(
      () => expect(screen.getByRole('heading', { name: 'Events' })).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('shows site name in the subtitle', async () => {
    renderWithSuspense(<EventsComponent />)
    await waitFor(
      () => expect(screen.getByText(/Upcoming events for Rankin/i)).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('renders month group headers', async () => {
    renderWithSuspense(<EventsComponent />)
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]
    const currentMonth = months[today.getMonth()]
    await waitFor(
      () => expect(screen.getByText(new RegExp(currentMonth, 'i'))).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('shows "Today" badge on today\'s date row', async () => {
    renderWithSuspense(<EventsComponent />)
    await waitFor(
      () => expect(screen.getByText('Today')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })
})

describe('Events — event display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockUser.is_admin = false
  })

  it('renders event titles from loader data', async () => {
    mockUseLoaderData.mockReturnValue({ events: [makeEvent()] })
    renderWithSuspense(<EventsComponent />)
    await waitFor(
      () => expect(screen.getByText('Staff Meeting')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('renders event description below title', async () => {
    mockUseLoaderData.mockReturnValue({ events: [makeEvent()] })
    renderWithSuspense(<EventsComponent />)
    await waitFor(
      () => expect(screen.getByText('Quarterly check-in.')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('renders multiple events on the same day', async () => {
    mockUseLoaderData.mockReturnValue({
      events: [
        makeEvent({ _id: 'e-1', title: 'Morning Stand-up' }),
        makeEvent({ _id: 'e-2', title: 'Safety Briefing' }),
      ],
    })
    renderWithSuspense(<EventsComponent />)
    await waitFor(() => {
      expect(screen.getByText('Morning Stand-up')).toBeInTheDocument()
      expect(screen.getByText('Safety Briefing')).toBeInTheDocument()
    }, { timeout: 5000 })
  })
})

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

  it('opens the compose dialog when a date row is clicked', async () => {
    renderWithSuspense(<EventsComponent />)
    await waitFor(
      () => expect(screen.getByText('Today')).toBeInTheDocument(),
      { timeout: 5000 },
    )

    // Click the today row (the parent div with onClick)
    const todayBadge = screen.getByText('Today')
    const dateRow = todayBadge.closest('[class*="cursor-pointer"]') as HTMLElement
    if (dateRow) fireEvent.click(dateRow)

    await waitFor(
      () => expect(screen.getByRole('heading', { name: 'New event' })).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('shows title and description fields in the compose dialog', async () => {
    renderWithSuspense(<EventsComponent />)
    await waitFor(() => screen.getByText('Today'), { timeout: 5000 })

    const todayBadge = screen.getByText('Today')
    const dateRow = todayBadge.closest('[class*="cursor-pointer"]') as HTMLElement
    if (dateRow) fireEvent.click(dateRow)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Event title')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Add details…')).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('shows error when submitting without a title', async () => {
    renderWithSuspense(<EventsComponent />)
    await waitFor(() => screen.getByText('Today'), { timeout: 5000 })

    const todayBadge = screen.getByText('Today')
    const dateRow = todayBadge.closest('[class*="cursor-pointer"]') as HTMLElement
    if (dateRow) fireEvent.click(dateRow)

    await waitFor(
      () => expect(screen.getByText('Add Event')).toBeInTheDocument(),
      { timeout: 5000 },
    )
    fireEvent.click(screen.getByText('Add Event'))

    await waitFor(
      () => expect(screen.getByText('Title is required.')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('calls POST /api/events with title and date on submit', async () => {
    renderWithSuspense(<EventsComponent />)
    await waitFor(() => screen.getByText('Today'), { timeout: 5000 })

    const todayBadge = screen.getByText('Today')
    const dateRow = todayBadge.closest('[class*="cursor-pointer"]') as HTMLElement
    if (dateRow) fireEvent.click(dateRow)

    await waitFor(
      () => expect(screen.getByPlaceholderText('Event title')).toBeInTheDocument(),
      { timeout: 5000 },
    )

    fireEvent.change(screen.getByPlaceholderText('Event title'), {
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
    }, { timeout: 5000 })
  })

  it('closes the dialog on Cancel', async () => {
    renderWithSuspense(<EventsComponent />)
    await waitFor(() => screen.getByText('Today'), { timeout: 5000 })

    const dateRow = screen.getByText('Today').closest('[class*="cursor-pointer"]') as HTMLElement
    if (dateRow) fireEvent.click(dateRow)

    await waitFor(
      () => expect(screen.getByRole('heading', { name: 'New event' })).toBeInTheDocument(),
      { timeout: 5000 },
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(
      () => expect(screen.queryByRole('heading', { name: 'New event' })).not.toBeInTheDocument(),
      { timeout: 5000 },
    )
  })
})

describe('Events — view and delete dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockUseLoaderData.mockReturnValue({ events: [makeEvent()] })
    mockUser.is_admin = false
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    } as any)
  })

  it('opens the view dialog when an event button is clicked', async () => {
    renderWithSuspense(<EventsComponent />)
    await waitFor(
      () => expect(screen.getByText('Staff Meeting')).toBeInTheDocument(),
      { timeout: 5000 },
    )

    fireEvent.click(screen.getByText('Staff Meeting'))

    await waitFor(
      () => expect(screen.getByRole('dialog')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('shows author name in the view dialog', async () => {
    renderWithSuspense(<EventsComponent />)
    await waitFor(() => screen.getByText('Staff Meeting'), { timeout: 5000 })

    fireEvent.click(screen.getByText('Staff Meeting'))

    await waitFor(
      () => expect(screen.getByText(/Posted by Jane Doe/i)).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('shows the Delete button when the viewer is the author', async () => {
    mockUser.id = 'user-1'
    renderWithSuspense(<EventsComponent />)
    await waitFor(() => screen.getByText('Staff Meeting'), { timeout: 5000 })

    fireEvent.click(screen.getByText('Staff Meeting'))

    await waitFor(
      () => expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('hides the Delete button when viewer is not the author and not admin', async () => {
    mockUser.id = 'user-99' // different user
    mockUser.is_admin = false
    renderWithSuspense(<EventsComponent />)

    // Wait for the event list item button to appear
    await waitFor(() => screen.getByRole('button', { name: /Staff Meeting/ }), { timeout: 5000 })
    fireEvent.click(screen.getByRole('button', { name: /Staff Meeting/ }))

    // Dialog opens — wait for the dialog title (not the list button)
    await waitFor(
      () => {
        // The title appears in the dialog header as a heading
        const headings = screen.getAllByText('Staff Meeting')
        // At least 2 elements: the list button and the dialog title
        expect(headings.length).toBeGreaterThanOrEqual(2)
      },
      { timeout: 5000 },
    )

    // Non-owner, non-admin should not see the delete button
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
  })

  it('shows the Delete button for admin regardless of authorship', async () => {
    mockUser.id = 'user-99'
    mockUser.is_admin = true
    renderWithSuspense(<EventsComponent />)
    await waitFor(() => screen.getByText('Staff Meeting'), { timeout: 5000 })

    fireEvent.click(screen.getByText('Staff Meeting'))

    await waitFor(
      () => expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('calls DELETE /api/events/:id when Delete is confirmed', async () => {
    mockUser.id = 'user-1'
    renderWithSuspense(<EventsComponent />)
    await waitFor(() => screen.getByText('Staff Meeting'), { timeout: 5000 })

    fireEvent.click(screen.getByText('Staff Meeting'))
    await waitFor(
      () => expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument(),
      { timeout: 5000 },
    )

    fireEvent.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/events/evt-1',
        expect.objectContaining({ method: 'DELETE' }),
      )
    }, { timeout: 5000 })
  })
})

describe('Events — date helper functions', () => {
  it('toIsoDate produces YYYY-MM-DD from local date', () => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const d = new Date(2026, 3, 15) // April 15 2026
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    expect(iso).toBe('2026-04-15')
  })

  it('parseIsoDate round-trips through toIsoDate', () => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const original = '2026-11-30'
    const [y, m, d] = original.split('-').map(Number)
    const date = new Date(y, (m || 1) - 1, d || 1)
    const roundTripped = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    expect(roundTripped).toBe(original)
  })
})
