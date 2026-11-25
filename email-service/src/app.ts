import { createHash } from 'node:crypto'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import type { IdempotencyStore } from './store'

interface Attachment {
  filename: string
  content: string       // base64-encoded
  encoding?: string     // defaults to 'base64'
  contentType?: string  // e.g. 'application/pdf', 'image/png'
}

interface SendRequest {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  cc?: string | string[]
  bcc?: string | string[]
  from?: string
  attachments?: Attachment[]
}

export interface Mailer {
  sendMail(message: any): Promise<{ messageId: string }>
  verify(): Promise<unknown>
}

export interface Options {
  mailer: Mailer
  store: IdempotencyStore
  apiKey: string | undefined
  defaultFrom: string
  requireKey?: boolean
  verifyCacheMs?: number
  now?: () => number
  log?: (line: string) => void
}

const KEY = /^[A-Za-z0-9._:-]{1,128}$/

/**
 * True only when the SMTP server explicitly refused the message, so nothing was delivered.
 * Connection errors are NOT in this set: a server that accepts the message and then drops the
 * connection also surfaces as ECONNECTION, so those outcomes stay unknown.
 */
export function definitelyNotSent(error: any): boolean {
  if (error?.code === 'EAUTH' || error?.code === 'EENVELOPE') return true
  return error?.code === 'EMESSAGE' && typeof error.responseCode === 'number' && error.responseCode >= 400
}

function fingerprint(body: SendRequest): string {
  return createHash('sha256').update(JSON.stringify(body, Object.keys(body).sort())).digest('hex')
}

const list = (value: string | string[] | undefined) => (value ? (Array.isArray(value) ? value.join(', ') : value) : undefined)

export function createApp(options: Options) {
  const { mailer, store, apiKey, defaultFrom } = options
  const now = options.now ?? Date.now
  const log = options.log ?? ((line: string) => console.log(`[email-service] ${line}`))
  const verifyCacheMs = options.verifyCacheMs ?? 15_000
  let verifiedAt = 0

  const app = new Hono()

  app.use('*', async (c, next) => {
    const start = Date.now()
    await next()
    log(`${c.req.method} ${c.req.path} ${c.res.status} ${Date.now() - start}ms`)
  })

  const requireApiKey: MiddlewareHandler = async (c, next) => {
    const key = c.req.header('X-API-Key')
    if (!key || key !== apiKey) return c.json({ ok: false, error: 'unauthorized' }, 401)
    await next()
  }

  const rateBuckets = new Map<string, number[]>()
  const RATE_WINDOW_MS = 60_000
  const RATE_LIMIT = 20

  const sendLimiter: MiddlewareHandler = async (c, next) => {
    const key = c.req.header('X-API-Key') ?? c.req.header('x-forwarded-for') ?? 'default'
    const t = now()
    const timestamps = (rateBuckets.get(key) ?? []).filter(x => t - x < RATE_WINDOW_MS)
    if (timestamps.length >= RATE_LIMIT) return c.json({ ok: false, error: 'rate limit exceeded' }, 429)
    timestamps.push(t)
    rateBuckets.set(key, timestamps)
    await next()
  }

  app.get('/health', c => c.json({ ok: true, service: 'email-service', ts: new Date().toISOString() }))

  app.post('/send', sendLimiter, requireApiKey, async (c) => {
    let body: SendRequest
    try {
      body = await c.req.json()
    } catch {
      return c.json({ ok: false, error: 'invalid JSON body' }, 400)
    }

    const { to, subject, html, text, cc, bcc, from, attachments } = body
    if (!to || !subject || (!html && !text))
      return c.json({ ok: false, error: 'missing required fields: to, subject, and html or text' }, 400)

    const key = c.req.header('Idempotency-Key')
    if (key !== undefined && !KEY.test(key))
      return c.json({ ok: false, error: 'invalid Idempotency-Key' }, 400)
    if (key === undefined && options.requireKey)
      return c.json({ ok: false, error: 'Idempotency-Key required' }, 400)

    const message = {
      from: from ?? defaultFrom,
      to: list(to),
      cc: list(cc),
      bcc: list(bcc),
      subject,
      html,
      text,
      attachments: attachments?.map(a => ({
        filename: a.filename,
        content: Buffer.from(a.content, (a.encoding ?? 'base64') as BufferEncoding),
        contentType: a.contentType,
      })),
    }

    if (key === undefined) {
      // Legacy callers without a key keep the original behaviour (and no duplicate protection).
      try {
        const info = await mailer.sendMail(message)
        return c.json({ ok: true, messageId: info.messageId })
      } catch (err: any) {
        log(`send error: ${err.message}`)
        return c.json({ ok: false, error: `SMTP error: ${err.message}` }, 500)
      }
    }

    // A server that is down fails here, before any state is recorded, and is safe to retry.
    if (now() - verifiedAt > verifyCacheMs) {
      try {
        await mailer.verify()
        verifiedAt = now()
      } catch (err: any) {
        log(`smtp unavailable: ${err.code ?? 'error'}`)
        return c.json({ ok: false, error: 'smtp_unavailable', retryable: true }, 503)
      }
    }

    let decision
    try {
      decision = store.begin(key, fingerprint(body))
    } catch {
      return c.json({ ok: false, error: 'idempotency journal unavailable', retryable: true }, 503)
    }
    if (decision.action === 'replay')
      return c.json({ ok: true, messageId: decision.entry.messageId, duplicate: true })
    if (decision.action === 'blocked') {
      const detail = {
        in_flight: 'a request with this key is still being sent',
        ambiguous_delivery: 'an earlier attempt with this key may have been delivered; reconcile before resending',
        key_reuse: 'this Idempotency-Key was already used for a different message',
      }[decision.reason]
      return c.json({ ok: false, error: decision.reason, detail }, decision.reason === 'key_reuse' ? 422 : 409)
    }

    try {
      const info = await mailer.sendMail(message)
      try { store.markSent(key, info.messageId) } catch { log(`journal write failed after delivery for ${key}`) }
      return c.json({ ok: true, messageId: info.messageId })
    } catch (err: any) {
      const refused = definitelyNotSent(err)
      try {
        if (refused) store.release(key)
        else store.markUncertain(key)
      } catch { /* the pending entry already blocks a repeat */ }
      log(`send error (${refused ? 'not sent' : 'outcome unknown'}) ${err.code ?? ''}: ${err.message}`)
      if (refused) return c.json({ ok: false, error: `SMTP error: ${err.message}`, retryable: false }, 500)
      return c.json({ ok: false, error: 'ambiguous_delivery', detail: 'delivery outcome unknown; reconcile before resending' }, 502)
    }
  })

  // Operator reconciliation for an uncertain key. Responses never include message content.
  app.get('/send/:key', requireApiKey, c => {
    const entry = store.get(c.req.param('key'))
    return entry
      ? c.json({ ok: true, state: entry.state, messageId: entry.messageId, at: entry.at })
      : c.json({ ok: false, error: 'unknown key' }, 404)
  })

  app.delete('/send/:key', requireApiKey, c =>
    store.clearUncertain(c.req.param('key'))
      ? c.json({ ok: true })
      : c.json({ ok: false, error: 'only an uncertain key can be cleared' }, 409))

  return app
}
