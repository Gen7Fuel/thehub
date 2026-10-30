import { authApi } from './auth.api'
import { locationsApi } from '@/api/locations/locations.api'
import type { ActionType, RequestOptions } from '@/api/core/types'

const context = (source: string, action: ActionType, resourceType: string, message: string): RequestOptions => ({
  actionContext: {
    action,
    resourceType,
    source,
    message,
  },
})

export const authService = {
  identifyAccount<T = { inStoreAccount: boolean }>(email: string) {
    return authApi.identifyLogin<T>(email, {
      ...context('settings.reset-password', 'read', 'user-account', 'Password reset account type checked'),
      auth: false,
    })
  },

  changePasswordSelf<T = { success: boolean }>(currentPassword: string, newPassword: string) {
    return authApi.changePasswordSelf<T>(
      currentPassword,
      newPassword,
      {
        permission: 'passwordReset',
        ...context('settings.reset-password', 'update', 'user-credential', 'Self-service credential update requested'),
      },
    )
  },

  identifyLogin<T = { inStoreAccount: boolean; maintenance?: { active: boolean; endTime: string } }>(email: string) {
    return authApi.identifyLogin<T>(email, {
      ...context('login.page', 'read', 'user-account', `Login account type checked for ${email}`),
      auth: false,
    })
  },

  login<T = { token: string }>(email: string, password: string) {
    return authApi.login<T>(email, password, {
      ...context('login.page', 'read', 'user', `Login requested for ${email}`),
      auth: false,
    })
  },

  register<T = unknown>(input: { email: string; password: string; firstName: string; lastName: string; stationName: string }) {
    return authApi.register<T>(input, {
      ...context('register.page', 'create', 'user', `New user registration requested for ${input.email}`),
      auth: false,
    })
  },

  listRegistrationLocations<T = unknown[]>() {
    return locationsApi.list({
      auth: false,
      ...context('register.page', 'read', 'location', 'Registration site locations viewed'),
    }) as Promise<T>
  },
}
