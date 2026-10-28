import type { ActionType, RequestOptions } from '@/api/core/types'
export const actionOptions = (permission: string, source: string, action: ActionType, resourceType: string, message: string): RequestOptions => ({
  permission,
  actionContext: { action, resourceType, source, message },
})
