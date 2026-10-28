import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
import type {
  BulletinListResponse,
  BulletinMutationResponse,
  CreateBulletinPostInput,
} from './bulletin.types'

export const bulletinApi = {
  async list(options: RequestOptions): Promise<BulletinListResponse> {
    return (await apiClient.get('/bulletin', requestConfig(options))).data
  },

  async create(input: CreateBulletinPostInput, options: RequestOptions): Promise<BulletinMutationResponse> {
    return (await apiClient.post('/bulletin', input, requestConfig(options))).data
  },

  async remove(id: string, options: RequestOptions): Promise<BulletinMutationResponse> {
    return (await apiClient.delete(`/bulletin/${id}`, requestConfig(options))).data
  },
}
