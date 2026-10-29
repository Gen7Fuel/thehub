import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { eventsService } from '../events.service'

describe('eventsService request metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockResolvedValue({ data: { success: true, data: [] } })
    mocks.post.mockResolvedValue({ data: { success: true, data: {} } })
    mocks.delete.mockResolvedValue({ data: { success: true } })
  })

  it('describes the site and month used to view the calendar', async () => {
    await eventsService.list('Rankin', '2026-10')

    expect(mocks.get).toHaveBeenCalledWith('/events', expect.objectContaining({
      params: { site: 'Rankin', month: '2026-10' },
      headers: expect.objectContaining({
        'X-Required-Permission': 'events',
        'X-Action-Source': 'events.calendar',
        'X-Action-Type': 'read',
        'X-Action-Resource': 'event',
        'X-Action-Message': 'Events calendar viewed for Rankin for 2026-10',
      }),
    }))
  })

  it('annotates event creation with its business purpose', async () => {
    await eventsService.create({
      site: 'Rankin',
      date: '2026-11-05',
      title: 'Inventory review',
      description: 'Review inventory variance',
    })

    expect(mocks.post.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Action-Source': 'events.calendar',
      'X-Action-Type': 'create',
      'X-Action-Message': 'Event creation requested for Rankin on 2026-11-05 — Inventory review',
    }))
  })

  it('uses event details instead of only a Mongo ID for delete intent', async () => {
    await eventsService.remove({
      _id: 'event-1',
      site: 'Rankin',
      date: '2026-11-05',
      title: 'Inventory review',
    })

    expect(mocks.delete).toHaveBeenCalledWith('/events/event-1', expect.objectContaining({
      headers: expect.objectContaining({
        'X-Action-Type': 'delete',
        'X-Action-Message': 'Event deletion requested for Rankin on 2026-11-05 — Inventory review',
      }),
    }))
  })
})
