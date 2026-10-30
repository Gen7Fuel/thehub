import type { RequestOptions } from '@/api/core/types'
import { supportApi } from './support.api'

const ctx = (source: string, action: 'read' | 'create', message: string): RequestOptions => ({
  permission: 'support', actionContext: { source, action, resourceType: 'support-ticket', message },
})

export const supportService = {
  async list<T = unknown[]>(site?: string): Promise<T> {
    const response = await supportApi.list<{ data?: { tickets?: T } }>({ ...(site ? { site } : {}) }, ctx('support.list', 'read', `Support tickets viewed${site ? ` for ${site}` : ''}`))
    return response.data?.tickets ?? ([] as T)
  },
  async get<T>(id: string): Promise<T | null> {
    const response = await supportApi.get<{ success: boolean; data: T }>(id, ctx('support.detail', 'read', `Support ticket ${id} opened`))
    return response.success ? response.data : null
  },
  async create<T extends { site?: string; priority?: string; text?: string }, R = any>(input: T): Promise<R> {
    const response = await supportApi.create<T, { data: R }>(input, ctx('support.new', 'create', `${input.priority || 'Normal'} priority support ticket submitted for ${input.site || 'unknown site'}: ${input.text?.slice(0, 80) || 'No description'}`))
    return response.data
  },
}
