import { apiClient } from "@/api/core/clients";
import { requestConfig } from "@/api/core/request-context";
import type { RequestOptions } from "@/api/core/types";
export const authApi = {
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
