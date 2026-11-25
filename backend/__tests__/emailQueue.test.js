import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'

// Prevent Queue/Worker from opening Redis connections when the module loads.
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockReturnValue({}),
  Worker: vi.fn().mockReturnValue({ on: vi.fn() }),
}))

// Prevent ioredis from attempting a real TCP connection.
vi.mock('ioredis', () => ({
  default: vi.fn().mockReturnValue({ quit: vi.fn(), on: vi.fn(), disconnect: vi.fn() }),
}))

// Match the require path used inside emailQueue.js (no .js extension).
vi.mock('../utils/redisClient', () => ({}))

import { resolveAttachments, processEmailJob } from '../queues/emailQueue.js'

// ─── resolveAttachments ───────────────────────────────────────────────────────

describe('resolveAttachments', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns empty array when called with no arguments', async () => {
    expect(await resolveAttachments()).toEqual([])
  })

  it('returns empty array for an empty list', async () => {
    expect(await resolveAttachments([])).toEqual([])
  })

  it('passes through an already-base64 attachment unchanged', async () => {
    const att = { filename: 'report.pdf', content: 'abc123==', encoding: 'base64' }
    expect(await resolveAttachments([att])).toEqual([att])
  })

  it('converts a Buffer content attachment to base64', async () => {
    const buf = Buffer.from('PDF bytes here')
    const result = await resolveAttachments([
      { filename: 'doc.pdf', content: buf, contentType: 'application/pdf' },
    ])
    expect(result[0]).toEqual({
      filename: 'doc.pdf',
      content: buf.toString('base64'),
      encoding: 'base64',
      contentType: 'application/pdf',
    })
  })

  it('reads a path attachment from disk and converts to base64', async () => {
    const fileBytes = Buffer.from('ZIP file bytes')
    vi.spyOn(fs.promises, 'readFile').mockResolvedValueOnce(fileBytes)

    const result = await resolveAttachments([
      { filename: 'data.zip', path: '/tmp/data.zip' },
    ])

    expect(fs.promises.readFile).toHaveBeenCalledWith('/tmp/data.zip')
    expect(result[0]).toEqual({
      filename: 'data.zip',
      content: fileBytes.toString('base64'),
      encoding: 'base64',
    })
  })

  it('handles mixed types (path, Buffer, base64) in one call', async () => {
    const zipBytes = Buffer.from('zip')
    vi.spyOn(fs.promises, 'readFile').mockResolvedValueOnce(zipBytes)

    const rawBuf = Buffer.from('pdf')
    const result = await resolveAttachments([
      { filename: 'a.zip', path: '/tmp/a.zip' },
      { filename: 'b.pdf', content: rawBuf, contentType: 'application/pdf' },
      { filename: 'c.xlsx', content: 'already==', encoding: 'base64' },
    ])

    expect(result[0].content).toBe(zipBytes.toString('base64'))
    expect(result[1].content).toBe(rawBuf.toString('base64'))
    expect(result[2].content).toBe('already==')
  })
})

// ─── processEmailJob ──────────────────────────────────────────────────────────

describe('processEmailJob', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    process.env.EMAIL_SERVICE_URL = 'http://email-service:2525'
    process.env.EMAIL_SERVICE_API_KEY = 'test-key'
  })

  afterEach(() => vi.unstubAllGlobals())

  const makeJob = (data) => ({ id: '1', data })

  it('POSTs to EMAIL_SERVICE_URL/send with the correct headers', async () => {
    fetch.mockResolvedValueOnce({ ok: true })

    await processEmailJob(makeJob({ to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' }))

    expect(fetch).toHaveBeenCalledWith('http://email-service:2525/send', expect.objectContaining({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-key',
        'Idempotency-Key': 'emailQueue:1',
      },
    }))
  })

  it('derives a stable Idempotency-Key from the job id and creation time', async () => {
    fetch.mockResolvedValue({ ok: true })
    const job = { id: '42', timestamp: 1764100000000, data: { to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' } }

    await processEmailJob(job)
    await processEmailJob(job) // a stalled-job re-run of the same job

    const keys = fetch.mock.calls.map(call => call[1].headers['Idempotency-Key'])
    expect(keys).toEqual(['emailQueue:42:1764100000000', 'emailQueue:42:1764100000000'])
    expect(keys[0]).toMatch(/^[A-Za-z0-9._:-]{1,128}$/) // the relay's accepted key format

    await processEmailJob({ ...job, id: '43' })
    expect(fetch.mock.calls[2][1].headers['Idempotency-Key']).toBe('emailQueue:43:1764100000000')
  })

  it('bounds the request with a timeout signal', async () => {
    fetch.mockResolvedValueOnce({ ok: true })

    await processEmailJob(makeJob({ to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' }))

    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })

  it('fails the job, naming the key, when delivery may already have happened', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: vi.fn().mockResolvedValueOnce({ ok: false, error: 'ambiguous_delivery' }),
    })

    await expect(
      processEmailJob(makeJob({ to: 'a@b.com', subject: 'Test', html: '<p>x</p>' }))
    ).rejects.toThrow('ambiguous_delivery (Idempotency-Key emailQueue:1)')
  })

  it('treats a replayed duplicate as success', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValueOnce({ ok: true, duplicate: true }) })

    await expect(
      processEmailJob(makeJob({ to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' }))
    ).resolves.toBeUndefined()
  })

  it('sends to, subject, and body in the request payload', async () => {
    fetch.mockResolvedValueOnce({ ok: true })

    await processEmailJob(makeJob({ to: 'a@b.com', subject: 'Hello', text: 'body', cc: ['x@y.com'] }))

    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.to).toBe('a@b.com')
    expect(body.subject).toBe('Hello')
    expect(body.text).toBe('body')
    expect(body.cc).toEqual(['x@y.com'])
  })

  it('omits the attachments key when there are no attachments', async () => {
    fetch.mockResolvedValueOnce({ ok: true })

    await processEmailJob(makeJob({ to: 'a@b.com', subject: 'No attach', html: '<p>ok</p>' }))

    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body).not.toHaveProperty('attachments')
  })

  it('includes resolved attachments in the request payload', async () => {
    fetch.mockResolvedValueOnce({ ok: true })

    const att = { filename: 'r.pdf', content: 'base64==', encoding: 'base64' }
    await processEmailJob(makeJob({
      to: 'a@b.com',
      subject: 'Report',
      html: '<p>see attached</p>',
      attachments: [att],
    }))

    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.attachments).toHaveLength(1)
    expect(body.attachments[0].filename).toBe('r.pdf')
    expect(body.attachments[0].content).toBe('base64==')
  })

  it('throws the error message from the service on a non-OK response', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValueOnce({ ok: false, error: 'unauthorized' }),
    })

    await expect(
      processEmailJob(makeJob({ to: 'a@b.com', subject: 'Test', html: '<p>x</p>' }))
    ).rejects.toThrow('unauthorized')
  })

  it('falls back to "email-service responded <status>" when the error body cannot be parsed', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: vi.fn().mockRejectedValueOnce(new Error('not json')),
    })

    await expect(
      processEmailJob(makeJob({ to: 'a@b.com', subject: 'Test', html: '<p>x</p>' }))
    ).rejects.toThrow('email-service responded 503')
  })
})
