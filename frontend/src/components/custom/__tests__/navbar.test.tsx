import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'

const { mockNavigate, mockState, mockAxiosGet, mockAxiosPost, mockSocket } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockState: { access: {} as any, unreadCount: 0 },
  mockAxiosGet: vi.fn(),
  mockAxiosPost: vi.fn(),
  mockSocket: { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: false },
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useMatchRoute: () => () => false,
  useLocation: () => ({ pathname: '/po' }),
  Link: ({ to, children, className }: any) => <a href={to} className={className}>{children}</a>,
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', access: mockState.access },
    refreshTokenFromBackend: vi.fn(),
  }),
}))

vi.mock('@/lib/websocket', () => ({ getSocket: () => mockSocket }))
vi.mock('@/lib/orderRecIndexedDB', () => ({ clearLocalDB: vi.fn() }))

// Keep `cn` real — ui/button builds every className through it.
vi.mock('@/lib/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/utils')>()),
  isTokenExpired: () => false,
  triggerBackgroundSync: vi.fn(),
}))

vi.mock('axios', () => ({
  default: { get: mockAxiosGet, post: mockAxiosPost },
}))

import Navbar from '../navbar'

const FULL_ACCESS = {
  toggleFuelPriceTicker: true,
  notification: { value: true },
  dashboard: true,
  settings: { value: true },
  passwordReset: true,
}

// The mobile panel and the Help dialog both carry role="dialog"; the panel is
// the one labelled "Menu".
const queryPanel = () => screen.queryByRole('dialog', { name: 'Menu' })
const getPanel = () => screen.getByRole('dialog', { name: 'Menu' })
const getTrigger = () => screen.getByRole('button', { name: /menu/i })

const openMenu = () => fireEvent.click(getTrigger())

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockState.access = {}
  mockState.unreadCount = 0
  window.innerWidth = 375
  mockAxiosGet.mockImplementation((url: string) =>
    Promise.resolve({ data: url.includes('unread-count') ? { count: mockState.unreadCount } : [] })
  )
  mockAxiosPost.mockResolvedValue({})
})

// Note on the environment: jsdom applies no CSS, so the `md:hidden` /
// `hidden md:flex` classes that actually gate mobile vs desktop are inert
// here and BOTH the desktop button row and the hamburger are in the tree.
// These tests therefore cover the menu's logic, not its breakpoint — the
// breakpoint is pure CSS by design, which is also why no matchMedia stub is
// needed (src/test/setup.ts has none). Menu queries are scoped to the panel
// so they can't accidentally match the desktop row or its hover tooltip.
describe('Navbar mobile menu', () => {
  it('starts closed', () => {
    render(<Navbar />)

    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false')
    expect(getTrigger()).toHaveAccessibleName('Open menu')
    expect(queryPanel()).not.toBeInTheDocument()
  })

  it('opens the panel and flips the trigger to a close control', () => {
    render(<Navbar />)

    openMenu()

    expect(getPanel()).toBeInTheDocument()
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'true')
    expect(getTrigger()).toHaveAccessibleName('Close menu')
  })

  it('closes again when the cross is clicked', async () => {
    render(<Navbar />)

    openMenu()
    fireEvent.click(getTrigger())

    await waitFor(() => expect(queryPanel()).not.toBeInTheDocument())
    expect(getTrigger()).toHaveAccessibleName('Open menu')
  })

  // Parity guard: the mobile list is declared separately from the desktop
  // button row, so this is what catches the two drifting apart.
  it('shows only the ungated items when the user has no permissions', () => {
    render(<Navbar />)

    openMenu()
    const rows = within(getPanel()).getAllByRole('button')

    expect(rows.map((r) => r.textContent)).toEqual(['Help', 'Logout'])
  })

  it('shows every item, in navbar order, when the user has all permissions', () => {
    mockState.access = FULL_ACCESS
    render(<Navbar />)

    openMenu()
    const rows = within(getPanel()).getAllByRole('button')

    expect(rows.map((r) => r.textContent)).toEqual([
      'Show Fuel Price TickerOff',
      'Notifications',
      'Help',
      'Dashboard',
      'Settings',
      'Reset Password',
      'Logout',
    ])
  })

  it('navigates and closes when an item is selected', async () => {
    mockState.access = FULL_ACCESS
    render(<Navbar />)

    openMenu()
    fireEvent.click(within(getPanel()).getByRole('button', { name: 'Settings' }))

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/settings' })
    await waitFor(() => expect(queryPanel()).not.toBeInTheDocument())
  })

  it('logs out and redirects from the logout item', async () => {
    // handleLogout only calls the API when there's a token to invalidate.
    localStorage.setItem('token', 'a-token')
    render(<Navbar />)

    openMenu()
    fireEvent.click(within(getPanel()).getByRole('button', { name: 'Logout' }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' }))
    expect(mockAxiosPost).toHaveBeenCalledWith('/api/auth/logout', {}, expect.anything())
  })

  it('closes on Escape', async () => {
    render(<Navbar />)

    openMenu()
    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => expect(queryPanel()).not.toBeInTheDocument())
  })

  it('locks background scroll while open and restores it on close', async () => {
    render(<Navbar />)

    openMenu()
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.documentElement.style.overflow).toBe('hidden')

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => expect(queryPanel()).not.toBeInTheDocument())
    expect(document.body.style.overflow).toBe('')
    expect(document.documentElement.style.overflow).toBe('')
  })

  // Growing past md must close instantly rather than animating — the panel is
  // md:hidden, so an animated close would be invisible while the scroll lock
  // stayed on for another 200ms.
  it('closes immediately and releases the scroll lock when resized past md', () => {
    render(<Navbar />)

    openMenu()
    act(() => {
      window.innerWidth = 1024
      window.dispatchEvent(new Event('resize'))
    })

    expect(queryPanel()).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
  })

  it('toggles the fuel ticker without closing the menu', () => {
    mockState.access = FULL_ACCESS
    const onTickerToggle = vi.fn()
    window.addEventListener('fuelTickerToggle', onTickerToggle)
    render(<Navbar />)

    openMenu()
    fireEvent.click(within(getPanel()).getByRole('button', { name: /Show Fuel Price Ticker/ }))

    expect(localStorage.getItem('showFuelTicker')).toBe('true')
    expect(onTickerToggle).toHaveBeenCalled()
    // Stays open, and the row reflects the new state.
    expect(getPanel()).toBeInTheDocument()
    expect(within(getPanel()).getByRole('button', { name: /Hide Fuel Price Ticker/ })).toBeInTheDocument()

    window.removeEventListener('fuelTickerToggle', onTickerToggle)
  })

  it('surfaces unread notifications on the hamburger and on the row', async () => {
    mockState.access = FULL_ACCESS
    mockState.unreadCount = 3
    render(<Navbar />)

    await waitFor(() => expect(screen.getByTestId('mobile-menu-unread-dot')).toBeInTheDocument())

    openMenu()
    expect(within(getPanel()).getByRole('button', { name: /Notifications/ })).toHaveTextContent('3')
  })

  it('shows no unread dot when there is nothing unread', async () => {
    mockState.access = FULL_ACCESS
    render(<Navbar />)

    await waitFor(() => expect(mockAxiosGet).toHaveBeenCalled())
    expect(screen.queryByTestId('mobile-menu-unread-dot')).not.toBeInTheDocument()
  })

  it('closes the menu and opens the help dialog from the help item', async () => {
    render(<Navbar />)

    openMenu()
    fireEvent.click(within(getPanel()).getByRole('button', { name: 'Help' }))

    // Titled from the current route ('/po' per the useLocation mock).
    expect(await screen.findByText('Purchase Orders')).toBeInTheDocument()
    await waitFor(() => expect(queryPanel()).not.toBeInTheDocument())
  })
})
