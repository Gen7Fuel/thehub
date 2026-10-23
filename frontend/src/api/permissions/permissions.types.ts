export interface PermissionNode {
  permId?: number
  name: string
  children: PermissionNode[]
}

export interface Permission {
  _id: string
  module_name: string
  module_permId: number
  structure: PermissionNode[]
}

export interface PermissionInput {
  module_name: string
  structure: PermissionNode[]
}
