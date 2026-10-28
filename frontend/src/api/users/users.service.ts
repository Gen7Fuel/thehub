// Settings Users orchestration: endpoint definitions live in resource API modules.
import { authApi } from '@/api/auth/auth.api'
import { locationsApi } from '@/api/locations/locations.api'
import { actionOptions } from '@/api/resources/action-options'
import { rolesApi as rolesResourceApi } from '@/api/roles/roles.api'
import type { Role } from '@/api/roles/roles.types'
import type { Site } from '@/api/locations/locations.types'
import type { SettingsUser } from './users.types'
import { usersApi as usersResourceApi } from './users.api'

const config = (action: 'read' | 'update', resourceType: string, message: string) => actionOptions('settings', 'settings.users', action, resourceType, message)

export const usersApi = {
  async list(): Promise<SettingsUser[]> {
    return usersResourceApi.list(config('read', 'user', 'User list viewed in Settings'))
  },
  async get(id: string): Promise<SettingsUser> {
    return usersResourceApi.get(id, config('read', 'user', 'User configuration opened in Settings'))
  },
  async listSites(userName: string): Promise<Site[]> {
    return locationsApi.listSettings(config('read', 'location', `Sites viewed while configuring user ${userName}`))
  },
  async listRoles(userName: string): Promise<Role[]> {
    return rolesResourceApi.list(config('read', 'role', `Roles viewed while configuring user ${userName}`))
  },
  async setActive(id: string, name: string, isActive: boolean): Promise<SettingsUser> {
    return usersResourceApi.setActive(id, isActive, config('update', 'user', `${name} account ${isActive ? 'activation' : 'deactivation'} requested`))
  },
  async updateSiteAccess(id: string, name: string, siteAccess: Record<string, boolean>): Promise<void> {
    await usersResourceApi.updateSiteAccess(id, siteAccess, config('update', 'user-site-access', `Site access update requested for ${name}`))
  },
  async updateRole(id: string, name: string, roleId: string): Promise<void> {
    await usersResourceApi.updateRole(id, roleId, config('update', 'user-role', `Role change requested for ${name}`))
  },
  async updatePermissions(id: string, name: string, mergedPermissions: unknown[], roleId: string): Promise<void> {
    await usersResourceApi.updatePermissions(id, mergedPermissions, roleId, config('update', 'user-permission', `Permission overrides update requested for ${name}`))
  },
  async resetPassword(id: string, name: string, newPassword: string): Promise<void> {
    await authApi.resetPassword(id, newPassword, config('update', 'user-credential', `Credential reset requested for ${name}`))
  },
  async verifyAdministrator(password: string, purpose: string): Promise<void> {
    await authApi.verifyPassword(password, config('read', 'administrator-verification', purpose))
  },
  async logout(id: string, name: string): Promise<void> {
    await usersResourceApi.logout(id, config('update', 'user-session', `Administrative logout requested for ${name}`))
  },
  async logoutAll(): Promise<void> {
    await usersResourceApi.logoutMultiple(config('update', 'user-session', 'Administrative logout requested for all non-admin users'))
  },
}
