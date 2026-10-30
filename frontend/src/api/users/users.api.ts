import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
import type { SettingsUser } from './users.types'
export type PermissionUser = Pick<SettingsUser, '_id' | 'firstName' | 'lastName' | 'email'> & {
  roleName: string | null
  value: boolean
}
export type PermissionUserChange = { userId: string; value: boolean }
export const usersApi = {
  async list(options: RequestOptions): Promise<SettingsUser[]> { return (await apiClient.get('/users', requestConfig(options))).data },
  async get(id: string, options: RequestOptions): Promise<SettingsUser> { return (await apiClient.get(`/users/${id}`, requestConfig(options))).data },
  async listWithRoles(options: RequestOptions): Promise<SettingsUser[]> { return (await apiClient.get('/users/populate-roles', requestConfig(options))).data },
  async setActive(id: string, isActive: boolean, options: RequestOptions): Promise<SettingsUser> { return (await apiClient.patch(`/users/${id}/active`, { is_active: isActive }, requestConfig(options))).data.user },
  async updateSiteAccess(id: string, siteAccess: Record<string, boolean>, options: RequestOptions): Promise<void> { await apiClient.put(`/users/${id}/site-access`, { siteAccess }, requestConfig(options)) },
  async updateRole(id: string, roleId: string, options: RequestOptions): Promise<void> { await apiClient.put(`/users/${id}/role`, { roleId }, requestConfig(options)) },
  async updatePermissions(id: string, mergedPermissions: unknown[], roleId: string, options: RequestOptions): Promise<void> { await apiClient.put(`/users/${id}/permissions`, { mergedPermissions, roleId }, requestConfig(options)) },
  async logout(id: string, options: RequestOptions): Promise<void> { await apiClient.post(`/users/${id}/logout`, {}, requestConfig(options)) },
  async logoutMultiple(options: RequestOptions): Promise<void> { await apiClient.post('/users/logout-multiple', {}, requestConfig(options)) },
  async listByPermission(permId: number, options: RequestOptions): Promise<PermissionUser[]> {
    return (await apiClient.get(`/users/by-permission/${permId}`, requestConfig(options))).data
  },
  async updateByPermission(permId: number, changes: PermissionUserChange[], options: RequestOptions): Promise<void> {
    await apiClient.put(`/users/by-permission/${permId}`, { changes }, requestConfig(options))
  },
}
