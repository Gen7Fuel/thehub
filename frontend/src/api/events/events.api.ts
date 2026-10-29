import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
import type { CreateEventInput, EventListResponse, EventMutationResponse } from './events.types'

export const eventsApi = {
  async list(site: string | undefined, month: string | undefined, options: RequestOptions): Promise<EventListResponse> {
    return (await apiClient.get('/events', {
      ...requestConfig(options),
      params: {
        ...(site ? { site } : {}),
        ...(month ? { month } : {}),
      },
    })).data
  },

  async create(input: CreateEventInput, options: RequestOptions): Promise<EventMutationResponse> {
    return (await apiClient.post('/events', input, requestConfig(options))).data
  },

  async remove(id: string, options: RequestOptions): Promise<EventMutationResponse> {
    return (await apiClient.delete(`/events/${encodeURIComponent(id)}`, requestConfig(options))).data
  },
}
