import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import nodemailer from 'nodemailer'
import { createApp, definitelyNotSent, type Mailer } from './app'
import { IdempotencyStore } from './store'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'relay-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

const payload = { to: 'a@example.test', subject: 'Report', text: 'body' }
const post = (app: ReturnType<typeof createApp>, body: object = payload, headers: Record<string, string> = {}) =>
  app.request('/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-API-Key': 'secret', ...headers },
    body: JSON.stringify(body),
  })

function stubMailer(behaviour: { send?: (n: number) => Promise<{ messageId: string }>; verify?: () => Promise<unknown> } = {}) {
  const calls = { send: 0, verify: 0 }
  const mailer: Mailer = {
    async sendMail() { calls.send += 1; return (behaviour.send ?? (async n => ({ messageId: `<m${n}>` })))(calls.send) },
    async verify() { calls.verify += 1; return (behaviour.verify ?? (async () => true))() },
  }
  return { mailer, calls }
}

const build = (mailer: Mailer, extra: Partial<Parameters<typeof createApp>[0]> = {}, store = new IdempotencyStore(dir)) =>
  createApp({ mailer, store, apiKey: 'secret', defaultFrom: 'Gen7 <noreply@example.test>', log: () => {}, ...extra })

const smtpError = (code: string, extra: object = {}) => Object.assign(new Error(code), { code, ...extra })

describe('classification', () => {
  test('only explicit server refusals mean not delivered', () => {
    expect(definitelyNotSent(smtpError('EAUTH', { responseCode: 535 }))).toBe(true)
    expect(definitelyNotSent(smtpError('EENVELOPE', { responseCode: 550 }))).toBe(true)
    expect(definitelyNotSent(smtpError('EMESSAGE', { responseCode: 554 }))).toBe(true)
    expect(definitelyNotSent(smtpError('EMESSAGE'))).toBe(false)
    // These also describe "accepted the message, then the connection dropped".
    for (const code of ['ECONNECTION', 'ESOCKET', 'ETIMEDOUT']) expect(definitelyNotSent(smtpError(code, { command: 'CONN' }))).toBe(false)
  })
})

describe('POST /send without a key (legacy)', () => {
  test('sends and keeps the original error shape', async () => {
    const { mailer, calls } = stubMailer({ send: async () => { throw smtpError('ECONNECTION') } })
    const app = build(mailer)
    const response = await post(app)
    expect(response.status).toBe(500)
    expect((await response.json()).error).toStartWith('SMTP error:')
    expect(calls.verify).toBe(0)
  })

  test('REQUIRE_IDEMPOTENCY_KEY rejects a missing key', async () => {
    const { mailer, calls } = stubMailer()
    const response = await post(build(mailer, { requireKey: true }))
    expect(response.status).toBe(400)
    expect(calls.send).toBe(0)
  })
})

describe('POST /send with an Idempotency-Key', () => {
  const headers = { 'Idempotency-Key': 'emailQueue:42' }

  test('a repeat after success replays the result without sending again', async () => {
    const { mailer, calls } = stubMailer()
    const app = build(mailer)
    const first = await post(app, payload, headers)
    const second = await post(app, payload, headers)
    expect(await first.json()).toEqual({ ok: true, messageId: '<m1>' })
    expect(await second.json()).toEqual({ ok: true, messageId: '<m1>', duplicate: true })
    expect(calls.send).toBe(1)
  })

  test('reusing a key for a different message is refused', async () => {
    const { mailer, calls } = stubMailer()
    const app = build(mailer)
    await post(app, payload, headers)
    const response = await post(app, { ...payload, subject: 'Other' }, headers)
    expect(response.status).toBe(422)
    expect((await response.json()).error).toBe('key_reuse')
    expect(calls.send).toBe(1)
  })

  test('an explicit refusal is not sent and can be retried with the same key', async () => {
    const { mailer, calls } = stubMailer({ send: async n => { if (n === 1) throw smtpError('EENVELOPE', { responseCode: 550 }); return { messageId: '<ok>' } } })
    const app = build(mailer)
    expect((await post(app, payload, headers)).status).toBe(500)
    const retry = await post(app, payload, headers)
    expect(await retry.json()).toEqual({ ok: true, messageId: '<ok>' })
    expect(calls.send).toBe(2)
  })

  test('an unknown outcome blocks a repeat until an operator clears it', async () => {
    const { mailer, calls } = stubMailer({ send: async n => { if (n === 1) throw smtpError('ECONNECTION', { command: 'CONN' }); return { messageId: '<resent>' } } })
    const app = build(mailer)
    const failed = await post(app, payload, headers)
    expect(failed.status).toBe(502)
    expect((await failed.json()).error).toBe('ambiguous_delivery')

    const blocked = await post(app, payload, headers)
    expect(blocked.status).toBe(409)
    expect((await blocked.json()).error).toBe('ambiguous_delivery')
    expect(calls.send).toBe(1)

    const auth = { 'X-API-Key': 'secret' }
    expect((await (await app.request('/send/emailQueue:42', { headers: auth })).json()).state).toBe('uncertain')
    expect((await app.request('/send/emailQueue:42', { method: 'DELETE' })).status).toBe(401)
    expect((await app.request('/send/emailQueue:42', { method: 'DELETE', headers: auth })).status).toBe(200)

    const resent = await post(app, payload, headers)
    expect(await resent.json()).toEqual({ ok: true, messageId: '<resent>' })
    expect(calls.send).toBe(2)
  })

  test('a sent key cannot be cleared by the operator endpoint', async () => {
    const { mailer } = stubMailer()
    const app = build(mailer)
    await post(app, payload, headers)
    expect((await app.request('/send/emailQueue:42', { method: 'DELETE', headers: { 'X-API-Key': 'secret' } })).status).toBe(409)
  })

  test('a down SMTP server fails before any state is recorded', async () => {
    const { mailer, calls } = stubMailer({ verify: async () => { throw smtpError('ECONNECTION') } })
    const store = new IdempotencyStore(dir)
    const app = build(mailer, {}, store)
    const response = await post(app, payload, headers)
    expect(response.status).toBe(503)
    expect(calls.send).toBe(0)
    expect(store.get('emailQueue:42')).toBeUndefined()
  })

  test('a concurrent request with the same key is held while the first is in flight', async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const { mailer, calls } = stubMailer({ send: async () => { await gate; return { messageId: '<slow>' } } })
    const app = build(mailer)
    const first = post(app, payload, headers)
    await Bun.sleep(20)
    const second = await post(app, payload, headers)
    expect(second.status).toBe(409)
    expect((await second.json()).error).toBe('in_flight')
    release()
    expect((await first).status).toBe(200)
    expect(calls.send).toBe(1)
  })

  test('rejects malformed keys', async () => {
    const { mailer } = stubMailer()
    expect((await post(build(mailer), payload, { 'Idempotency-Key': 'bad key!' })).status).toBe(400)
  })

  test('a failure to journal the pending state stops the send', async () => {
    const { mailer, calls } = stubMailer()
    const store = new IdempotencyStore(dir)
    store.begin = () => { throw new Error('disk full') }
    const response = await post(build(mailer, {}, store), payload, headers)
    expect(response.status).toBe(503)
    expect(calls.send).toBe(0)
  })
})

describe('IdempotencyStore', () => {
  test('survives a restart and turns an in-flight key into uncertain', () => {
    const first = new IdempotencyStore(dir)
    first.begin('a', 'h1')
    first.begin('b', 'h2'); first.markSent('b', '<b>')
    const second = new IdempotencyStore(dir)
    expect(second.get('a')?.state).toBe('uncertain')
    expect(second.get('b')).toMatchObject({ state: 'sent', messageId: '<b>' })
    expect(second.begin('a', 'h1')).toMatchObject({ action: 'blocked', reason: 'ambiguous_delivery' })
    expect(second.begin('b', 'h2')).toMatchObject({ action: 'replay' })
  })

  test('tolerates a torn final journal line', () => {
    const first = new IdempotencyStore(dir)
    first.begin('a', 'h1'); first.markSent('a', '<a>')
    writeFileSync(join(dir, 'journal.jsonl'), readFileSync(join(dir, 'journal.jsonl'), 'utf8') + '{"key":"zz","ha')
    expect(new IdempotencyStore(dir).get('a')?.state).toBe('sent')
  })

  test('expires old keys', () => {
    let clock = 1_000
    const store = new IdempotencyStore(dir, 100, () => clock)
    store.begin('a', 'h'); store.markSent('a', '<a>')
    clock += 101
    expect(store.begin('a', 'h')).toEqual({ action: 'send' })
    expect(new IdempotencyStore(dir, 100, () => clock + 500).get('a')).toBeUndefined()
  })

  test('journal holds no message content', () => {
    const store = new IdempotencyStore(dir)
    store.begin('k', 'hash'); store.markSent('k', '<id>')
    expect(readFileSync(join(dir, 'journal.jsonl'), 'utf8')).not.toContain('Report')
  })
})

// End to end against real nodemailer: the server accepts the message and drops the
// connection before acknowledging, which looks like a plain connection error to nodemailer.
describe('accepted-but-unacknowledged delivery', () => {
  function fakeSmtp(dropAfterData: boolean) {
    const delivered: string[] = []
    const server = net.createServer(socket => {
      let inData = false
      let buffer = ''
      let message = ''
      socket.write('220 fake ESMTP\r\n')
      socket.on('data', chunk => {
        buffer += chunk.toString()
        for (let i = buffer.indexOf('\r\n'); i >= 0; i = buffer.indexOf('\r\n')) {
          const line = buffer.slice(0, i)
          buffer = buffer.slice(i + 2)
          if (inData) {
            if (line === '.') {
              inData = false
              delivered.push(message)
              if (dropAfterData) return socket.destroy()
              socket.write('250 2.0.0 queued\r\n')
            } else message += line + '\n'
            continue
          }
          const command = line.split(' ')[0].toUpperCase()
          if (command === 'EHLO') socket.write('250-fake\r\n250 AUTH PLAIN LOGIN\r\n')
          else if (command === 'AUTH') socket.write('235 ok\r\n')
          else if (command === 'DATA') { inData = true; message = ''; socket.write('354 go\r\n') }
          else if (command === 'QUIT') { socket.write('221 bye\r\n'); socket.end() }
          else socket.write('250 ok\r\n')
        }
      })
    })
    return new Promise<{ port: number; delivered: string[]; close: () => void }>(resolve =>
      server.listen(0, '127.0.0.1', () => resolve({ port: (server.address() as net.AddressInfo).port, delivered, close: () => server.close() })))
  }

  test('a repeat does not deliver a second copy', async () => {
    const smtp = await fakeSmtp(true)
    const transport = nodemailer.createTransport({
      host: '127.0.0.1', port: smtp.port, secure: false, ignoreTLS: true, auth: { user: 'u', pass: 'p' },
      connectionTimeout: 2000, greetingTimeout: 2000, socketTimeout: 2000,
    })
    try {
      const app = build(transport as unknown as Mailer)
      const headers = { 'Idempotency-Key': 'emailQueue:7' }
      expect((await post(app, payload, headers)).status).toBe(502)
      expect((await post(app, payload, headers)).status).toBe(409)
      expect(smtp.delivered.length).toBe(1)
    } finally {
      transport.close()
      smtp.close()
    }
  })

  test('a normal delivery is sent once and a repeat is a replay', async () => {
    const smtp = await fakeSmtp(false)
    const transport = nodemailer.createTransport({
      host: '127.0.0.1', port: smtp.port, secure: false, ignoreTLS: true, auth: { user: 'u', pass: 'p' },
      connectionTimeout: 2000, greetingTimeout: 2000, socketTimeout: 2000,
    })
    try {
      const app = build(transport as unknown as Mailer)
      const headers = { 'Idempotency-Key': 'emailQueue:8' }
      expect((await post(app, payload, headers)).status).toBe(200)
      expect((await (await post(app, payload, headers)).json()).duplicate).toBe(true)
      expect(smtp.delivered.length).toBe(1)
    } finally {
      transport.close()
      smtp.close()
    }
  })
})
