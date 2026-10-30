import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { authService } from '../auth.service'

describe('authService request metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.post.mockResolvedValue({ data: { inStoreAccount: true, success: true } })
  })

  it('checks account type without requiring authentication', async () => {
    await authService.identifyAccount('user@example.com')

    expect(mocks.post).toHaveBeenCalledWith('/auth/identify', { email: 'user@example.com' }, expect.objectContaining({
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
})
