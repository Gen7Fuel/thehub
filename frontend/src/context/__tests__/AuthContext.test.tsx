import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const { mockPrefetchArCustomers, mockJwtDecode } = vi.hoisted(() => ({
  mockPrefetchArCustomers: vi.fn(),
  mockJwtDecode: vi.fn(),
}))

vi.mock('@/lib/arCustomersCache', () => ({
  prefetchArCustomers: mockPrefetchArCustomers,
}))

vi.mock('jwt-decode', () => ({
  jwtDecode: mockJwtDecode,
}))

import { AuthProvider, useAuth } from '../AuthContext'

function Consumer() {
  const { user } = useAuth()
  return <div data-testid="user">{user ? user.email : 'no-user'}</div>
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('AuthProvider — AR customer prefetch on login', () => {
  it('prefetches AR customers once a valid token resolves to a user (fresh login / returning session)', async () => {
    localStorage.setItem('token', 'a-token')
    mockJwtDecode.mockReturnValue({ id: 'u1', email: 'user@example.com', permissions: [], site_access: {} })

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )

    await waitFor(() => expect(mockPrefetchArCustomers).toHaveBeenCalled())
  })

  it('does not prefetch AR customers when there is no token (logged out / login page)', async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )

    await waitFor(() => expect(mockJwtDecode).not.toHaveBeenCalled())
    expect(mockPrefetchArCustomers).not.toHaveBeenCalled()
  })
})
