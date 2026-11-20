import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }))

vi.mock('@/api/auth/auth.service', () => ({ authService: { getSession } }))

import { AuthProvider, useAuth } from '../AuthContext'
import { ApiError } from '@/api/core/errors'

function Consumer() {
  const { user, refreshAuth, clearSession } = useAuth()
  return (
    <>
      <div data-testid="user">{user ? user.email : 'no-user'}</div>
      <div data-testid="access">{JSON.stringify(user?.access)}</div>
      <button onClick={() => void refreshAuth().catch(() => {})}>Reload access</button>
      <button onClick={clearSession}>Sign out</button>
    </>
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('AuthProvider — in-memory session', () => {
  it('loads access from the session endpoint and refreshes it without changing the token', async () => {
    localStorage.setItem('token', 'a-token')
    const profile = { id: 'u1', email: 'user@example.com', site_access: { Rankin: true } }
    getSession.mockResolvedValueOnce({ ...profile, permissions: [
      { name: 'stationAudit', value: true, children: [{ name: 'edit', value: true }] },
    ] })
    getSession.mockResolvedValueOnce({ ...profile, permissions: [
      { name: 'stationAudit', value: true, children: [{ name: 'edit', value: false }] },
    ] })

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )

    await waitFor(() => expect(document.querySelector('[data-testid="user"]')?.textContent).toBe('user@example.com'))
    expect(JSON.parse(screen.getByTestId('access').textContent!)).toEqual({
      stationAudit: { value: true, edit: true },
      site_access: { Rankin: true },
      'site_access.Rankin': true,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Reload access' }))
    await waitFor(() => expect(JSON.parse(screen.getByTestId('access').textContent!).stationAudit.edit).toBe(false))
    expect(localStorage.getItem('token')).toBe('a-token')
    expect(localStorage.getItem('hub.session')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('discards the old cache and waits for a server session after an offline reload', async () => {
    localStorage.setItem('token', 'a-token')
    localStorage.setItem('hub.session', JSON.stringify({ user: { email: 'cached@example.com' } }))
    getSession.mockRejectedValueOnce(new ApiError(new Error('Network unavailable')))
    getSession.mockResolvedValueOnce({ id: 'u1', email: 'user@example.com', permissions: [] })

    render(<AuthProvider><Consumer /></AuthProvider>)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your session.')
    expect(screen.queryByText('cached@example.com')).not.toBeInTheDocument()
    expect(localStorage.getItem('hub.session')).toBeNull()

    fireEvent(window, new Event('online'))

    expect(await screen.findByText('user@example.com')).toBeInTheDocument()
  })

  it('keeps loaded permissions in memory when a later refresh fails offline', async () => {
    localStorage.setItem('token', 'a-token')
    getSession.mockResolvedValueOnce({
      id: 'u1', email: 'user@example.com', permissions: [{ name: 'stationAudit', value: true }],
    })
    getSession.mockRejectedValueOnce(new ApiError(new Error('Network unavailable')))

    render(<AuthProvider><Consumer /></AuthProvider>)
    expect(await screen.findByText('user@example.com')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reload access' }))

    expect(getSession).toHaveBeenCalledTimes(2)
    expect(JSON.parse(screen.getByTestId('access').textContent!).stationAudit).toBe(true)
    expect(localStorage.getItem('token')).toBe('a-token')
    expect(localStorage.getItem('hub.session')).toBeNull()
  })

  it('keeps the user logged out when there is no token', () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )

    expect(getSession).not.toHaveBeenCalled()
    expect(document.querySelector('[data-testid="user"]')?.textContent).toBe('no-user')
  })
})
