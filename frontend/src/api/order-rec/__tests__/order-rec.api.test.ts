import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { orderRecService } from '../order-rec.service'
import { vendorsService } from '../../vendors/vendors.service'

describe('Order Rec and Vendor API contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.values(mocks).forEach(mock => mock.mockResolvedValue({ data: {} }))
  })

  it('preserves upload, scanner, detail, workflow, and delete permissions', async () => {
    await orderRecService.create({ site: 'Rankin' })
    await orderRecService.createScan({ site: 'Rankin' })
    await orderRecService.get('order-1')
    await orderRecService.updateStatus({ _id: 'order-1', filename: 'Order 1' }, { status: 'Placed' })
    await orderRecService.remove({ _id: 'order-1', filename: 'Order 1' })

    expect(mocks.post.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'orderRec.upload', 'X-Action-Source': 'order-rec.create',
    }))
    expect(mocks.post.mock.calls[1][2].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'orderRec.scanToOrder', 'X-Action-Source': 'order-rec.scanner',
    }))
    expect(mocks.get.mock.calls[0][1].headers['X-Required-Permission']).toBe('orderRec.id')
    expect(mocks.put.mock.calls[0][2].headers['X-Action-Source']).toBe('order-rec.workflow')
    expect(mocks.delete.mock.calls[0][1].headers['X-Required-Permission']).toBe('orderRec.id.deleteButton')
  })

  it('keeps Vendor resource calls reusable while retaining caller purpose', async () => {
    await vendorsService.list('station-audit.templates', { location: 'Rankin' }, 'Audit vendors viewed for Rankin', 'audit')
    await vendorsService.list('order-rec.workflow', { location: 'Rankin' }, undefined, 'orderRec.workflow')
    expect(mocks.get.mock.calls[0][0]).toBe('/vendors')
    expect(mocks.get.mock.calls[0][1].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'audit', 'X-Action-Source': 'station-audit.templates',
    }))
    expect(mocks.get.mock.calls[1][1].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'orderRec.workflow', 'X-Action-Source': 'order-rec.workflow',
    }))
  })

  it('prevents active module code from reintroducing direct backend calls', () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url))
    const src = path.resolve(testDir, '../../..')
    const files = [
      ...fs.readdirSync(path.join(src, 'routes/_navbarLayout/order-rec')).filter(name => name.endsWith('.tsx')).map(name => `routes/_navbarLayout/order-rec/${name}`),
      ...fs.readdirSync(path.join(src, 'routes/_navbarLayout/vendor')).filter(name => name.endsWith('.tsx')).map(name => `routes/_navbarLayout/vendor/${name}`),
      'components/custom/OrderRecCreate.tsx', 'components/custom/OrderRecChat.tsx',
      'components/custom/OrderRecVendorAssignment.tsx', 'components/custom/vendorPicker.tsx',
    ]
    for (const relative of files) {
      const source = fs.readFileSync(path.join(src, relative), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(source, relative).not.toMatch(/["'`]\/api\/(?:order-rec|vendors)/)
    }
  })
})
