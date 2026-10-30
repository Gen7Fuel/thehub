import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { invoiceUploadService } from '../invoice-upload.service'
import { supportService } from '../../support/support.service'
import { statusSalesService } from '../../status-sales/status-sales.service'

describe('Upload Invoice, Support, and Status API contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.values(mocks).forEach(mock => mock.mockResolvedValue({ data: {} }))
  })

  it('annotates invoice entry, list, and update purposes with their existing permissions', async () => {
    await invoiceUploadService.create({ siteName: 'Rankin', vendorName: 'Acme', docNumber: 'INV-1' })
    await invoiceUploadService.list({}, 'all sites', '2026-10-01', '2026-10-31')
    await invoiceUploadService.update('invoice-1', { siteName: 'Rankin', vendorName: 'Acme', docNumber: 'INV-1' })
    expect(mocks.post.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'uploadInvoice', 'X-Action-Source': 'upload-invoice.form', 'X-Action-Type': 'create',
    }))
    expect(mocks.get.mock.calls[0][1].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'uploadInvoice.list', 'X-Action-Source': 'upload-invoice.list',
    }))
    expect(mocks.put.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'uploadInvoice.list', 'X-Action-Source': 'upload-invoice.detail',
    }))
  })

  it('returns normalized support ticket data and records the module purpose', async () => {
    mocks.get.mockResolvedValueOnce({ data: { data: { tickets: [{ _id: 'ticket-1' }] } } })
    mocks.post.mockResolvedValueOnce({ data: { data: { _id: 'ticket-2' } } })
    expect(await supportService.list()).toEqual([{ _id: 'ticket-1' }])
    expect(await supportService.create({ site: 'Rankin', priority: 'high', text: 'Pump is offline' })).toEqual({ _id: 'ticket-2' })
    expect(mocks.get.mock.calls[0][1].headers['X-Action-Source']).toBe('support.list')
    expect(mocks.post.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'support', 'X-Action-Source': 'support.new', 'X-Action-Type': 'create',
    }))
  })

  it('uses readable Status purposes without exposing the full card number in the message', async () => {
    await statusSalesService.customer('1234567890')
    await statusSalesService.create({ stationName: 'Rankin', statusCardNumber: '1234567890', amount: 50 })
    expect(mocks.get.mock.calls[0][1].headers['X-Action-Message']).toContain('ending 7890')
    expect(mocks.get.mock.calls[0][1].headers['X-Action-Message']).not.toContain('1234567890')
    expect(mocks.post.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'status', 'X-Action-Source': 'status.form', 'X-Action-Type': 'create',
    }))
  })

  it('prevents active pages from reintroducing direct API calls', () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url))
    const src = path.resolve(testDir, '../../..')
    const directories = ['routes/_navbarLayout/upload-invoice', 'routes/_navbarLayout/support', 'routes/_navbarLayout/status']
    for (const directory of directories) {
      for (const filename of fs.readdirSync(path.join(src, directory)).filter(name => name.endsWith('.tsx'))) {
        const relative = `${directory}/${filename}`
        const source = fs.readFileSync(path.join(src, relative), 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
        expect(source, relative).not.toMatch(/["'`]\/api\/(?:invoice-upload|support|status-sales)/)
      }
    }
  })
})
