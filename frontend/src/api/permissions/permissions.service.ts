// Settings Permissions orchestration: endpoint definitions live in the resource API.
import { actionOptions } from '@/api/resources/action-options'
import type { Permission, PermissionInput } from './permissions.types'
import { permissionsApi as permissionsResourceApi } from './permissions.api'

const permissionRequest = (message: string, action: 'create' | 'read' | 'update' | 'delete') =>
  actionOptions('settings', 'settings.permissions', action, 'permission', message)

export const permissionsApi = {
  async list(): Promise<Permission[]> {
    return permissionsResourceApi.list(permissionRequest('Permission modules viewed in Settings', 'read'))
  },

  async get(id: string): Promise<Permission> {
    return permissionsResourceApi.get(id, permissionRequest('Permission tree opened in Settings', 'read'))
  },

  async create(input: PermissionInput): Promise<Permission> {
    return permissionsResourceApi.create(input, permissionRequest(`Permission module ${input.module_name} creation requested`, 'create'))
  },

  async update(id: string, input: PermissionInput): Promise<Permission> {
    return permissionsResourceApi.update(id, input, permissionRequest(`Permission tree ${input.module_name} update requested`, 'update'))
  },

  async remove(id: string, moduleName: string): Promise<void> {
    await permissionsResourceApi.remove(id, permissionRequest(`Permission module ${moduleName} deletion requested`, 'delete'))
  },
}
