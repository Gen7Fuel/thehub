import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() }))
vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { usersApi } from '../users.service'

describe('usersApi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('annotates protected user detail reads', async () => {
    mocks.get.mockResolvedValue({ data: { _id: 'user-1' } })
    await usersApi.get('user-1')
    expect(mocks.get).toHaveBeenCalledWith('/users/user-1', expect.objectContaining({
      headers: expect.objectContaining({
        'X-Required-Permission': 'settings',
        'X-Action-Type': 'read',
        'X-Action-Source': 'settings.users',
      }),
    }))
  })

  it('never puts a password in action metadata', async () => {
    mocks.post.mockResolvedValue({ data: { success: true } })
    await usersApi.resetPassword('user-1', 'Jane Doe', 'secret-value')
    const [, body, options] = mocks.post.mock.calls[0]
    expect(body.newPassword).toBe('secret-value')
    expect(JSON.stringify(options.headers)).not.toContain('secret-value')
    expect(options.headers['X-Action-Message']).toBe('Credential reset requested for Jane Doe')
  })

  it('distinguishes role and permission changes', async () => {
    mocks.put.mockResolvedValue({ data: { success: true } })
    await usersApi.updateRole('user-1', 'Jane Doe', 'role-1')
    await usersApi.updatePermissions('user-1', 'Jane Doe', [], 'role-1')
    expect(mocks.put.mock.calls[0][2].headers['X-Action-Resource']).toBe('user-role')
    expect(mocks.put.mock.calls[1][2].headers['X-Action-Resource']).toBe('user-permission')
  })
})
