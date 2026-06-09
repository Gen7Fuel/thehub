import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ─── Hoisted mutable state ─────────────────────────────────────────────────────

const { mockNavigate, mockAxiosGet } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockAxiosGet: vi.fn(),
}))

// ─── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (config: any) => config,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('axios', () => ({
  default: {
    get: mockAxiosGet,
    post: vi.fn(),
  },
}))

// ─── Component import (after mocks) ───────────────────────────────────────────

const { Route } = await import('../academy/index')
const AcademyComponent = (Route as any).component as React.ComponentType

// ─── Helpers ──────────────────────────────────────────────────────────────────

const renderWithSuspense = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <React.Suspense fallback={null}>{children}</React.Suspense>
    ),
  })

const makeCourse = (overrides = {}) => ({
  _id: 'course-1',
  title: 'Customer Service Basics',
  description: 'Learn the fundamentals.',
  thumbnail: '',
  sectionCount: 3,
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Academy index — loading state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockAxiosGet.mockReturnValue(new Promise(() => {})) // never resolves
  })

  it('shows "Loading..." while fetching', async () => {
    renderWithSuspense(<AcademyComponent />)
    await waitFor(
      () => expect(screen.getByText('Loading...')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })
})

describe('Academy index — empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockAxiosGet.mockResolvedValue({ data: { courses: [] } })
  })

  it('shows "No courses available." when there are no courses', async () => {
    renderWithSuspense(<AcademyComponent />)
    await waitFor(
      () => expect(screen.getByText('No courses available.')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('renders the "Academy" heading', async () => {
    renderWithSuspense(<AcademyComponent />)
    await waitFor(
      () => expect(screen.getByRole('heading', { name: 'Academy' })).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })
})

describe('Academy index — course list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
    mockAxiosGet.mockResolvedValue({
      data: {
        courses: [
          makeCourse({ _id: 'c-1', title: 'Customer Service Basics', sectionCount: 3 }),
          makeCourse({ _id: 'c-2', title: 'Fuel Safety', description: 'Fuel handling procedures.', sectionCount: 2 }),
        ],
      },
    })
  })

  it('renders all course titles', async () => {
    renderWithSuspense(<AcademyComponent />)
    await waitFor(
      () => expect(screen.getByText('Customer Service Basics')).toBeInTheDocument(),
      { timeout: 5000 },
    )
    expect(screen.getByText('Fuel Safety')).toBeInTheDocument()
  })

  it('renders section count for each course', async () => {
    renderWithSuspense(<AcademyComponent />)
    await waitFor(
      () => expect(screen.getByText('3 sections')).toBeInTheDocument(),
      { timeout: 5000 },
    )
    expect(screen.getByText('2 sections')).toBeInTheDocument()
  })

  it('renders description when provided', async () => {
    renderWithSuspense(<AcademyComponent />)
    await waitFor(
      () => expect(screen.getByText('Fuel handling procedures.')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('shows "1 section" (singular) for a course with 1 section', async () => {
    mockAxiosGet.mockResolvedValue({
      data: { courses: [makeCourse({ _id: 'c-1', title: 'Solo Course', sectionCount: 1 })] },
    })
    renderWithSuspense(<AcademyComponent />)
    await waitFor(
      () => expect(screen.getByText('1 section')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('navigates to course detail on click', async () => {
    renderWithSuspense(<AcademyComponent />)
    await waitFor(
      () => expect(screen.getByText('Customer Service Basics')).toBeInTheDocument(),
      { timeout: 5000 },
    )
    await userEvent.click(screen.getByText('Customer Service Basics'))
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/academy/$courseId', params: { courseId: 'c-1' } }),
    )
  })
})

describe('Academy index — API calls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'my-token')
    mockAxiosGet.mockResolvedValue({ data: [] })
  })

  it('calls /api/academy/learner/courses with auth header', async () => {
    renderWithSuspense(<AcademyComponent />)
    await waitFor(() => expect(mockAxiosGet).toHaveBeenCalled(), { timeout: 5000 })
    const [url, config] = mockAxiosGet.mock.calls[0]
    expect(url).toBe('/api/academy/learner/courses')
    expect(config.headers.Authorization).toBe('Bearer my-token')
    expect(config.headers['X-Required-Permission']).toBe('academy')
  })

  it('handles flat data array (no .courses wrapper)', async () => {
    mockAxiosGet.mockResolvedValue({
      data: [makeCourse({ _id: 'c-1', title: 'Flat Course' })],
    })
    renderWithSuspense(<AcademyComponent />)
    await waitFor(
      () => expect(screen.getByText('Flat Course')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })
})

describe('Academy index — error states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
  })

  it('shows error message on API failure', async () => {
    mockAxiosGet.mockRejectedValue(new Error('Network error'))
    renderWithSuspense(<AcademyComponent />)
    await waitFor(
      () => expect(screen.getByText('Failed to load courses.')).toBeInTheDocument(),
      { timeout: 5000 },
    )
  })

  it('navigates to /no-access on 403', async () => {
    mockAxiosGet.mockRejectedValue({ response: { status: 403 } })
    renderWithSuspense(<AcademyComponent />)
    await waitFor(
      () => expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/no-access' }),
      ),
      { timeout: 5000 },
    )
  })
})
