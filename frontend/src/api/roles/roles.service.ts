// Settings Roles orchestration: endpoint definitions live in resource API modules.
import { permissionsApi as permissionsResourceApi } from '@/api/permissions/permissions.api'
import { actionOptions } from '@/api/resources/action-options'
import { usersApi as usersResourceApi } from '@/api/users/users.api'
import type { PermissionTemplate, Role, RoleInput, RoleUser } from './roles.types'
import { rolesApi as rolesResourceApi } from './roles.api'

type RoleUpdatePurpose = 'definition' | 'account-type'

const actionConfig = (
  action: 'create' | 'read' | 'update' | 'delete',
  resourceType: string,
  message: string,
) => actionOptions('settings', 'settings.roles', action, resourceType, message)

export const rolesApi = {
  async list(): Promise<Role[]> {
    return rolesResourceApi.list(actionConfig('read', 'role', 'Role list viewed in Settings'))
  },

  async get(id: string): Promise<Role> {
    return rolesResourceApi.get(id, actionConfig('read', 'role', 'Role configuration opened in Settings'))
  },

  async listPermissionTemplates(): Promise<PermissionTemplate[]> {
    return permissionsResourceApi.list(actionConfig('read', 'permission', 'Permission templates viewed while creating a role')) as Promise<PermissionTemplate[]>
  },

  async listAssignableUsers(roleName: string): Promise<RoleUser[]> {
    return usersResourceApi.listWithRoles(actionConfig('read', 'user', `Users viewed while configuring role ${roleName}`)) as Promise<RoleUser[]>
  },

  async create(input: Omit<RoleInput, 'inStoreAccount'> & { inStoreAccount?: boolean }): Promise<Role> {
    return rolesResourceApi.create(input, actionConfig('create', 'role', `Role ${input.role_name} creation requested`))
  },

  async update(id: string, input: RoleInput, purpose: RoleUpdatePurpose): Promise<Role> {
    const message = purpose === 'account-type'
      ? `Account type update requested for role ${input.role_name}`
      : `Role ${input.role_name} permissions and details update requested`
    return rolesResourceApi.update(id, input, actionConfig('update', 'role', message))
  },

  async remove(id: string, roleName: string): Promise<void> {
    await rolesResourceApi.remove(id, actionConfig('delete', 'role', `Role ${roleName} deletion requested`))
  },

  async assignUsers(id: string, roleName: string, userIds: string[]): Promise<void> {
    await rolesResourceApi.assignUsers(id, userIds, actionConfig('update', 'role-assignment', `User assignments update requested for role ${roleName}`))
  },
}
