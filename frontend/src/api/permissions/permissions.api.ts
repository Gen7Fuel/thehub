import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { Permission, PermissionInput } from './permissions.types'

const permissionRequest = (message: string, action: 'create' | 'read' | 'update' | 'delete') =>
  requestConfig({
    permission: 'settings',
    actionContext: {
      action,
      resourceType: 'permission',
      source: 'settings.permissions',
      message,
    },
  })

export const permissionsApi = {
  async list(): Promise<Permission[]> {
    const response = await apiClient.get<Permission[]>(
      '/permissions',
      permissionRequest('Permission modules viewed in Settings', 'read'),
    )
    return response.data
  },

  async get(id: string): Promise<Permission> {
    const response = await apiClient.get<Permission>(
      `/permissions/${id}`,
      permissionRequest('Permission tree opened in Settings', 'read'),
    )
    return response.data
  },

  async create(input: PermissionInput): Promise<Permission> {
    const response = await apiClient.post<{ data: Permission }>(
      '/permissions',
      input,
      permissionRequest(`Permission module ${input.module_name} creation requested`, 'create'),
    )
    return response.data.data
  },

  async update(id: string, input: PermissionInput): Promise<Permission> {
    const response = await apiClient.put<{ data: Permission }>(
      `/permissions/${id}`,
      input,
      permissionRequest(`Permission tree ${input.module_name} update requested`, 'update'),
    )
    return response.data.data
  },

  async remove(id: string, moduleName: string): Promise<void> {
    await apiClient.delete(
      `/permissions/${id}`,
      permissionRequest(`Permission module ${moduleName} deletion requested`, 'delete'),
    )
  },
}
