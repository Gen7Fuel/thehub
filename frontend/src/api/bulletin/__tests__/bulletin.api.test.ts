import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { bulletinService } from '../bulletin.service'

describe('bulletinService request metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockResolvedValue({ data: { success: true, data: [] } })
    mocks.post.mockResolvedValue({ data: { success: true, data: {} } })
    mocks.delete.mockResolvedValue({ data: { success: true } })
  })

  it('annotates Bulletin Board reads for the assigned site', async () => {
    await bulletinService.list()

    expect(mocks.get.mock.calls[0][1].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'bulletin',
      'X-Action-Source': 'bulletin.board',
      'X-Action-Type': 'read',
      'X-Action-Resource': 'bulletin-post',
      'X-Action-Message': 'Bulletin Board posts viewed for assigned site',
    }))
  })

  it('does not copy bulletin text into create headers', async () => {
    const text = 'Private operational reminder for tomorrow morning'
    await bulletinService.create({ text }, 'Rankin')

    const headers = mocks.post.mock.calls[0][2].headers
    expect(headers).toEqual(expect.objectContaining({
      'X-Action-Source': 'bulletin.board',
      'X-Action-Type': 'create',
      'X-Action-Message': 'Bulletin post creation requested for Rankin',
    }))
    expect(JSON.stringify(headers)).not.toContain(text)
  })

  it('uses a human-readable post label for delete intent', async () => {
    await bulletinService.remove('post-1', 'posted by Jane Smith on 10/28/2026')

    expect(mocks.delete.mock.calls[0][1].headers).toEqual(expect.objectContaining({
      'X-Action-Source': 'bulletin.board',
      'X-Action-Type': 'delete',
      'X-Action-Message': 'Bulletin post deletion requested — posted by Jane Smith on 10/28/2026',
    }))
  })
})
