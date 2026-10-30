import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

describe('small module change logging contracts', () => {
  it('logs invoice create and update from full document snapshots', () => {
    const source = read('routes/invoiceUploadRoutes.js')
    expect(source).toContain('action: "create", resourceType: "invoice-upload"')
    expect(source).toContain('action: "update", resourceType: "invoice-upload"')
    expect(source).toContain('before, after: existingInvoice.toObject()')
  })

  it('logs support creation, status, REST replies, and socket replies', () => {
    const routes = read('routes/supportRoutes.js')
    const socket = read('socket/ticketSocket.js')
    expect(routes).toContain("action: 'create', resourceType: 'support-ticket'")
    expect(routes.match(/resourceType: 'support-ticket'/g)?.length).toBeGreaterThanOrEqual(3)
    expect(socket).toContain("path: 'support:send-message'")
    expect(socket).toContain('before, after: ticket.toObject()')
  })

  it('records both the sale and the customer upsert', () => {
    const source = read('routes/statusSalesRoutes.js')
    expect(source).toContain("resourceType: 'status-sale'")
    expect(source).toContain("resourceType: 'status-customer'")
    expect(source).toContain("before: customerBefore, after: customer.toObject()")
  })
})
