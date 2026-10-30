import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const { mockJwtDecode } = vi.hoisted(() => ({
  mockJwtDecode: vi.fn(),
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

describe('AuthProvider — persisted session resolution', () => {
  it('resolves a valid persisted token without triggering unrelated feature requests', async () => {
    localStorage.setItem('token', 'a-token')
    mockJwtDecode.mockReturnValue({ id: 'u1', email: 'user@example.com', permissions: [], site_access: {} })

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )

    await waitFor(() => expect(document.querySelector('[data-testid="user"]')?.textContent).toBe('user@example.com'))
  })

  it('keeps the user logged out when there is no token', async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )

    await waitFor(() => expect(mockJwtDecode).not.toHaveBeenCalled())
    expect(document.querySelector('[data-testid="user"]')?.textContent).toBe('no-user')
  })
})
