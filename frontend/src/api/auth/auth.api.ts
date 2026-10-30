import { apiClient, authClient } from "@/api/core/clients";
import { requestConfig } from "@/api/core/request-context";
import type { RequestOptions } from "@/api/core/types";
export const authApi = {
  async identifyLogin<T = { inStoreAccount: boolean; maintenance?: unknown }>(email: string, options: RequestOptions): Promise<T> {
    return (await authClient.post('/identify', { email }, requestConfig(options))).data
  },
  async login<T = { token: string }>(email: string, password: string, options: RequestOptions): Promise<T> {
    return (await authClient.post('/login', { email, password }, requestConfig(options))).data
  },
  async register<T = unknown>(input: { email: string; password: string; firstName: string; lastName: string; stationName: string }, options: RequestOptions): Promise<T> {
    return (await authClient.post('/register', input, requestConfig(options))).data
  },
  async logout(options: RequestOptions): Promise<void> {
    await apiClient.post('/auth/logout', {}, requestConfig(options))
  },
  async changePasswordSelf<T = { success: boolean }>(currentPassword: string, newPassword: string, options: RequestOptions): Promise<T> {
    return (await apiClient.post('/auth/change-password-self', { currentPassword, newPassword }, requestConfig(options))).data
  },
  async verifyPassword(
    password: string,
    options: RequestOptions,
  ): Promise<void> {
    await apiClient.post(
      "/auth/verify-password",
      { password },
      requestConfig(options),
    );
  },
  async resetPassword(
    userId: string,
    newPassword: string,
    options: RequestOptions,
  ): Promise<void> {
    await apiClient.post(
      "/auth/reset-password",
      { userId, newPassword },
      requestConfig(options),
    );
  },
};
