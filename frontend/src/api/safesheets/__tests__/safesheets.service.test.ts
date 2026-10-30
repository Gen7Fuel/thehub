import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  cdnPost: vi.fn(),
}))

vi.mock('@/api/core/clients', () => ({
  apiClient: { get: mocks.get, post: mocks.post, put: mocks.put, delete: mocks.delete },
  cdnClient: { post: mocks.cdnPost },
}))

import { safesheetService } from '../safesheets.service'

describe('safesheetService request metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockResolvedValue({ data: { entries: [] } })
    mocks.post.mockResolvedValue({ data: { entries: [] } })
    mocks.put.mockResolvedValue({ data: { entries: [] } })
    mocks.delete.mockResolvedValue({ data: { entries: [] } })
    mocks.cdnPost.mockResolvedValue({ data: { filename: 'safe-entry.jpg' } })
  })

  it('annotates the range read and entry mutations', async () => {
    await safesheetService.get('Rankin', '2026-10-01', '2026-10-07', true)
    await safesheetService.addEntry('Rankin', { date: '2026-10-07T12:00:00.000Z', cashIn: 20 })
    await safesheetService.updateEntry('Rankin', 'entry-1', { description: 'Updated' })
    await safesheetService.deleteEntry('Rankin', 'entry-1')

    expect(mocks.get).toHaveBeenCalledWith('/safesheets/site/Rankin', expect.objectContaining({
      params: { from: '2026-10-01', to: '2026-10-07', sortAssigned: true },
      headers: expect.objectContaining({
        'X-Required-Permission': 'accounting.safesheet',
        'X-Action-Source': 'safesheet.page',
        'X-Action-Resource': 'safesheet',
      }),
    }))
    expect(mocks.post).toHaveBeenCalledWith('/safesheets/site/Rankin/entries', expect.any(Object), expect.objectContaining({
      headers: expect.objectContaining({ 'X-Action-Type': 'update', 'X-Action-Resource': 'safesheet-entry' }),
    }))
    expect(mocks.put).toHaveBeenCalledWith('/safesheets/site/Rankin/entries/entry-1', { description: 'Updated' }, expect.objectContaining({
      headers: expect.objectContaining({ 'X-Action-Source': 'safesheet.page' }),
    }))
    expect(mocks.delete).toHaveBeenCalledWith('/safesheets/site/Rankin/entries/entry-1', expect.objectContaining({
      headers: expect.objectContaining({
        'X-Required-Permission': 'accounting.safesheet.deleteEntry',
        'X-Action-Type': 'delete',
      }),
    }))
  })

  it('uploads entry photos through the shared CDN client without changing the API path', async () => {
    const file = new File(['image'], 'entry.jpg', { type: 'image/jpeg' })
    await safesheetService.uploadPhoto(file, 'Rankin', 'entry-1')

    expect(mocks.cdnPost).toHaveBeenCalledWith('/upload', expect.any(FormData), expect.objectContaining({
      authRequired: false,
      headers: expect.objectContaining({
        'X-Action-Source': 'safesheet.page',
        'X-Action-Resource': 'safesheet-photo',
      }),
    }))
  })
})
