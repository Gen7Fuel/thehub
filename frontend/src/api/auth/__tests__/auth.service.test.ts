import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  authPost: vi.fn(),
}))

vi.mock('@/api/core/clients', () => ({
  apiClient: mocks,
  authClient: { post: mocks.authPost },
}))

import { authService } from '../auth.service'

describe('authService request metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.post.mockResolvedValue({ data: { inStoreAccount: true, success: true } })
    mocks.authPost.mockResolvedValue({ data: { inStoreAccount: true, token: 'token', success: true } })
  })

  it('checks account type without requiring authentication', async () => {
    await authService.identifyAccount('user@example.com')

    expect(mocks.authPost).toHaveBeenCalledWith('/identify', { email: 'user@example.com' }, expect.objectContaining({
      authRequired: false,
      headers: expect.objectContaining({
        'X-Action-Type': 'read',
        'X-Action-Source': 'settings.reset-password',
        'X-Action-Resource': 'user-account',
      }),
    }))
  })

  it('annotates self-service credential changes with the existing permission', async () => {
    await authService.changePasswordSelf('old-password', 'new-password')

    expect(mocks.post).toHaveBeenCalledWith('/auth/change-password-self', {
      currentPassword: 'old-password',
      newPassword: 'new-password',
    }, expect.objectContaining({
      headers: expect.objectContaining({
        'X-Required-Permission': 'passwordReset',
        'X-Action-Type': 'update',
        'X-Action-Source': 'settings.reset-password',
        'X-Action-Resource': 'user-credential',
      }),
    }))
  })

  it('uses the auth service for login identification without requiring auth', async () => {
    await authService.identifyLogin('user@example.com')

    expect(mocks.authPost).toHaveBeenCalledWith('/identify', { email: 'user@example.com' }, expect.objectContaining({
      authRequired: false,
      headers: expect.objectContaining({
        'X-Action-Type': 'read',
        'X-Action-Source': 'login.page',
        'X-Action-Resource': 'user-account',
      }),
    }))
  })

  it('sends the password only as the auth request body, never in action metadata', async () => {
    await authService.login('user@example.com', 'secret-password')

    const [, body, config] = mocks.authPost.mock.calls[0]
    expect(body).toEqual({ email: 'user@example.com', password: 'secret-password' })
    expect(JSON.stringify(config.headers)).not.toContain('secret-password')
  })

  it('annotates registration and does not put credentials in action metadata', async () => {
    await authService.register({
      email: 'new@example.com',
      password: 'secret-password',
      firstName: 'New',
      lastName: 'User',
      stationName: 'Rankin',
    })

    const [, body, config] = mocks.authPost.mock.calls[0]
    expect(body.password).toBe('secret-password')
    expect(config.headers['X-Action-Source']).toBe('register.page')
    expect(JSON.stringify(config.headers)).not.toContain('secret-password')
  })
})
