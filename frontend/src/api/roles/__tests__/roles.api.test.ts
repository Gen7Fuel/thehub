import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { rolesApi } from '../roles.service'

describe('rolesApi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('annotates Settings role reads', async () => {
    mocks.get.mockResolvedValue({ data: [] })

    await rolesApi.list()

    expect(mocks.get).toHaveBeenCalledWith(
      '/roles',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Required-Permission': 'settings',
          'X-Action-Type': 'read',
          'X-Action-Resource': 'role',
          'X-Action-Source': 'settings.roles',
          'X-Action-Message': 'Role list viewed in Settings',
        }),
      }),
    )
  })

  it('distinguishes account type updates from permission updates', async () => {
    mocks.put.mockResolvedValue({ data: { role: { _id: 'role-1' } } })
    const input = {
      role_name: 'Manager',
      description: '',
      inStoreAccount: true,
      permissions: [],
    }

    await rolesApi.update('role-1', input, 'account-type')

    expect(mocks.put).toHaveBeenCalledWith(
      '/roles/role-1',
      input,
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Action-Message': 'Account type update requested for role Manager',
        }),
      }),
    )
  })

  it('annotates user assignments as role-assignment changes', async () => {
    mocks.put.mockResolvedValue({ data: {} })

    await rolesApi.assignUsers('role-1', 'Manager', ['user-1'])

    expect(mocks.put).toHaveBeenCalledWith(
      '/roles/role-1/assign-users',
      { userIds: ['user-1'] },
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Action-Type': 'update',
          'X-Action-Resource': 'role-assignment',
        }),
      }),
    )
  })
})
