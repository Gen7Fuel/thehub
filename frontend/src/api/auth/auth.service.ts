import { authApi } from './auth.api'
import type { RequestOptions } from '@/api/core/types'

const context = (action: 'read' | 'update', resourceType: string, message: string): RequestOptions => ({
  actionContext: {
    action,
    resourceType,
    source: 'settings.reset-password',
    message,
  },
})

export const authService = {
  identifyAccount<T = { inStoreAccount: boolean }>(email: string) {
    return authApi.identify<T>(email, {
      ...context('read', 'user-account', 'Password reset account type checked'),
      auth: false,
    })
  },

  changePasswordSelf<T = { success: boolean }>(currentPassword: string, newPassword: string) {
    return authApi.changePasswordSelf<T>(
      currentPassword,
      newPassword,
      {
        permission: 'passwordReset',
        ...context('update', 'user-credential', 'Self-service credential update requested'),
      },
    )
  },
}
