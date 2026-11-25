import nodemailer from 'nodemailer'
import { createApp } from './app'
import { IdempotencyStore } from './store'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Bound every stage so a stalled SMTP server cannot hold a request or worker job open.
  dnsTimeout: 10_000,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS ?? 60_000), // idle time; allows large attachments
})

transporter.verify().then(() => {
  console.log('[email-service] SMTP connection verified')
}).catch((err: Error) => {
  console.error('[email-service] SMTP verification failed:', err.message)
  process.exit(1)
})

let store: IdempotencyStore
try {
  store = new IdempotencyStore(process.env.IDEMPOTENCY_DIR ?? '/var/lib/email-relay')
} catch (err: any) {
  console.error('[email-service] idempotency journal unavailable:', err.message)
  process.exit(1)
}

const app = createApp({
  mailer: transporter,
  store,
  apiKey: process.env.EMAIL_SERVICE_API_KEY,
  defaultFrom: process.env.SMTP_FROM ?? `Gen7 Fuel <${process.env.SMTP_USER}>`,
  requireKey: process.env.REQUIRE_IDEMPOTENCY_KEY === 'true',
})

const port = Number(process.env.PORT ?? 2525)
console.log(`[email-service] listening on port ${port}`)

export default { port, fetch: app.fetch }
