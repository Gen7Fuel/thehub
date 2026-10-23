import type { RolePermissionNode } from '@/api/roles/roles.types'

export interface SettingsUser {
  _id: string
  email: string
  firstName: string
  lastName: string
  is_active: boolean
  is_loggedIn: boolean
  is_logged_in?: boolean
  last_login?: string
  role?: { _id: string; role_name: string; inStoreAccount?: boolean } | null
  merged_permissions?: RolePermissionNode[]
  site_access: Record<string, boolean>
  [key: string]: unknown
}
