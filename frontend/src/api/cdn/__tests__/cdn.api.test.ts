import { beforeEach, describe, expect, it, vi } from 'vitest'

const client = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }))
vi.mock('@/api/core/clients', () => ({ cdnClient: client }))
import { cdnService } from '../cdn.service'

beforeEach(() => vi.resetAllMocks())

describe('CDN requests', () => {
  it('uploads audit photos as multipart without requiring authentication', async () => {
    const form = new FormData()
    form.append('file', new File(['image'], 'photo.jpg'))
    client.post.mockResolvedValue({ data: { filename: 'stored.jpg' } })
    expect(await cdnService.uploadAuditPhoto(form)).toEqual({ filename: 'stored.jpg' })
    expect(client.post).toHaveBeenCalledWith('/upload', form, expect.objectContaining({ authRequired: false }))
  })

  it('keeps base64 uploads authenticated and bounded to sixty seconds', async () => {
    client.post.mockResolvedValue({ data: { filename: 'stored.jpg' } })
    await cdnService.uploadBase64Image('data:image/png;base64,abc', 'receipt.jpg')
    expect(client.post).toHaveBeenCalledWith('/upload-base64', {
      base64Data: 'data:image/png;base64,abc', fileName: 'receipt.jpg',
    }, expect.objectContaining({ timeout: 60000, authRequired: true }))
  })

  it('downloads the original image URL without adding a CDN prefix or an auth token', async () => {
    const blob = new Blob(['image'])
    client.get.mockResolvedValue({ data: blob })
    const url = 'https://files.example.com/cdn/download/photo.jpg'
    expect(await cdnService.downloadImage(url)).toBe(blob)
    expect(client.get).toHaveBeenCalledWith(url, expect.objectContaining({
      baseURL: '', responseType: 'blob', authRequired: false,
    }))
  })
})
