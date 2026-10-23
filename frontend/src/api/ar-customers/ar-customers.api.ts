import { apiClient } from "@/api/core/clients";
import { requestConfig } from "@/api/core/request-context";
import type { RequestOptions } from "@/api/core/types";
import type { ArCustomer, QuickSelectEntry } from "./ar-customers.types";
export const arCustomersApi = {
  async list(options: RequestOptions): Promise<ArCustomer[]> {
    return (await apiClient.get("/ar-customers", requestConfig(options))).data;
  },
  async listQuickSelect(
    stationName: string,
    options: RequestOptions,
  ): Promise<QuickSelectEntry[]> {
    return (
      await apiClient.get("/ar-customers/quick-select", {
        ...requestConfig(options),
        params: { stationName },
      })
    ).data;
  },
  async addQuickSelect(
    id: string,
    stationName: string,
    options: RequestOptions,
  ): Promise<void> {
    await apiClient.post(
      `/ar-customers/${id}/quick-select`,
      { stationName },
      requestConfig(options),
    );
  },
  async moveQuickSelect(
    stationName: string,
    id: string,
    direction: "up" | "down",
    options: RequestOptions,
  ): Promise<QuickSelectEntry[]> {
    return (
      await apiClient.put(
        "/ar-customers/quick-select/move",
        { stationName, id, direction },
        requestConfig(options),
      )
    ).data;
  },
  async removeQuickSelect(
    id: string,
    stationName: string,
    options: RequestOptions,
  ): Promise<void> {
    await apiClient.delete(`/ar-customers/${id}/quick-select`, {
      ...requestConfig(options),
      params: { stationName },
    });
  },
  async updateQuickSelectLabel(
    id: string,
    stationName: string,
    label: string,
    options: RequestOptions,
  ): Promise<void> {
    await apiClient.put(
      `/ar-customers/${id}/quick-select/label`,
      { stationName, label },
      requestConfig(options),
    );
  },
  async updateFleetCard(
    id: string,
    fleetCardNumber: string,
    options: RequestOptions,
  ): Promise<void> {
    await apiClient.put(
      `/ar-customers/${id}/fleet-card`,
      { fleetCardNumber },
      requestConfig(options),
    );
  },
};
