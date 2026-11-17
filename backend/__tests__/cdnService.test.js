import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import { once } from 'node:events'
import service from '../utils/cdnService.js'
import uploads from '../utils/uploadToCdn.js'

const { cdnServiceBaseUrl, cdnServiceUrl } = service
const { uploadToCdn, downloadFromCdn } = uploads

beforeEach(() => vi.stubEnv('CDN_SERVICE_URL', ''))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('CDN transport configuration', () => {
  it('keeps the VPS default and legacy report overrides', () => {
    expect(cdnServiceUrl('upload')).toBe('http://cdn:5001/cdn/upload')
    expect(cdnServiceBaseUrl('https://legacy.example/')).toBe('https://legacy.example')
  })

  it.each(['https://azure.example', 'http://cdn-rollback-vps:5001'])('routes uploads, PNG conversion and downloads to %s', (base) => {
    vi.stubEnv('CDN_SERVICE_URL', `${base}///`)
    expect(cdnServiceUrl('upload')).toBe(`${base}/cdn/upload`)
    expect(cdnServiceUrl('upload-png')).toBe(`${base}/cdn/upload-png`)
    expect(cdnServiceUrl('download/example.png')).toBe(`${base}/cdn/download/example.png`)
    expect(cdnServiceBaseUrl('https://legacy.example')).toBe(base)
  })

  it.each(['cdn:5001', 'ftp://files.example', 'https://user:secret@example.com', 'https://example.com?token=secret', 'https://example.com#fragment'])('rejects invalid or credential-bearing configuration without echoing it', (base) => {
    vi.stubEnv('CDN_SERVICE_URL', base)
    expect(() => cdnServiceBaseUrl()).toThrow(/CDN service URL/)
    try { cdnServiceBaseUrl() } catch (error) {
      expect(error.message).not.toContain('secret')
    }
  })

  it('uploads multipart bytes and downloads through the configured transport while retaining public links', async () => {
    const requests = []
    const bytes = Buffer.from('synthetic-image-content')
    const server = createServer(async (req, res) => {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      requests.push({ url: req.url, method: req.method, type: req.headers['content-type'], body: Buffer.concat(chunks) })
      if (req.method === 'POST') {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ filename: 'example.png' }))
      } else {
        res.setHeader('Content-Type', 'image/png')
        res.end(bytes)
      }
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    try {
      vi.stubEnv('CDN_SERVICE_URL', `http://127.0.0.1:${server.address().port}/`)
      expect(await uploadToCdn(bytes, 'proof.png')).toBe('https://app.gen7fuel.com/cdn/download/example.png')
      expect(await downloadFromCdn('example image.png')).toEqual({ filename: 'example image.png', content: bytes, contentType: 'image/png' })
      expect(requests[0].url).toBe('/cdn/upload')
      expect(requests[0].type).toContain('multipart/form-data; boundary=')
      expect(requests[0].body.toString()).toContain('filename="proof.png"')
      expect(requests[0].body.includes(bytes)).toBe(true)
      expect(requests[1].url).toBe('/cdn/download/example%20image.png')
    } finally {
      await new Promise((resolve) => { server.close(resolve); server.closeAllConnections() })
    }
  })

  it('preserves failure handling without retrying writes against the old VPS', async () => {
    vi.stubEnv('CDN_SERVICE_URL', 'https://azure.example')
    const fetch = vi.fn().mockResolvedValue(new Response('paused', { status: 503 }))
    vi.stubGlobal('fetch', fetch)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await uploadToCdn(Buffer.from('test'), 'proof.png')).toBeNull()
    expect(await downloadFromCdn('example.png')).toBeNull()
    expect(await downloadFromCdn('')).toBeNull()
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['https://azure.example/cdn/upload', 'https://azure.example/cdn/download/example.png'])
  })
})
