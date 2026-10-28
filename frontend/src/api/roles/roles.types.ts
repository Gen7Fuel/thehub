export interface RolePermissionNode {
  name: string
  permId: number
  value?: boolean
  children?: RolePermissionNode[]
}

export interface PermissionTemplate {
  _id: string
  module_name: string
  module_permId: number
  structure: RolePermissionNode[]
}

export interface Role {
  _id: string
  role_name: string
  description?: string
  inStoreAccount: boolean
  permissions: RolePermissionNode[]
}

export type RoleInput = Omit<Role, '_id'>

export interface RoleUser {
  _id: string
  firstName: string
  lastName: string
  email: string
  is_active?: boolean
  role?: string | { _id: string; role_name?: string } | null
}
