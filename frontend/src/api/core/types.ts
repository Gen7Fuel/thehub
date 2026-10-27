export type ActionType =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'

export interface ActionContext {
  action: ActionType
  resourceType: string
  source: string
  message: string
}

export interface RequestOptions {
  actionContext?: ActionContext
  permission?: string
  signal?: AbortSignal
  auth?: boolean
}
