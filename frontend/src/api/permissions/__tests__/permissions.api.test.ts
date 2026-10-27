import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/api/core/clients', () => ({
  apiClient: mocks,
}))

import { permissionsApi } from '../permissions.service'

describe('permissionsApi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('annotates permission list reads', async () => {
    mocks.get.mockResolvedValue({ data: [] })

    await permissionsApi.list()

    expect(mocks.get).toHaveBeenCalledWith(
      '/permissions',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Required-Permission': 'settings',
          'X-Action-Type': 'read',
          'X-Action-Resource': 'permission',
          'X-Action-Source': 'settings.permissions',
          'X-Action-Message': 'Permission modules viewed in Settings',
        }),
      }),
    )
  })

  it('includes the module name when creating a permission tree', async () => {
    mocks.post.mockResolvedValue({ data: { data: { _id: 'permission-1' } } })
    const input = { module_name: 'kardpoll', structure: [] }

    await permissionsApi.create(input)

    expect(mocks.post).toHaveBeenCalledWith(
      '/permissions',
      input,
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Action-Type': 'create',
          'X-Action-Message': 'Permission module kardpoll creation requested',
        }),
      }),
    )
  })

  it('describes permission tree updates', async () => {
    mocks.put.mockResolvedValue({ data: { data: { _id: 'permission-1' } } })
    const input = { module_name: 'kardpoll', structure: [] }

    await permissionsApi.update('permission-1', input)

    expect(mocks.put).toHaveBeenCalledWith(
      '/permissions/permission-1',
      input,
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Action-Type': 'update',
          'X-Action-Message': 'Permission tree kardpoll update requested',
        }),
      }),
    )
  })

  it('includes the module name when deleting a permission tree', async () => {
    mocks.delete.mockResolvedValue({ data: undefined })

    await permissionsApi.remove('permission-1', 'kardpoll')

    expect(mocks.delete).toHaveBeenCalledWith(
      '/permissions/permission-1',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Action-Type': 'delete',
          'X-Action-Message': 'Permission module kardpoll deletion requested',
        }),
      }),
    )
  })
})
