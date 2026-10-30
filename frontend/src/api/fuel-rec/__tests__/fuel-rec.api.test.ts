import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { fuelRecService } from '../fuel-rec.service'

describe('Fuel Rec API contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const mock of Object.values(mocks)) mock.mockResolvedValue({ data: {} })
  })

  it('annotates BOL capture and list reads with readable business context', async () => {
    const form = new FormData()
    await fuelRecService.capture(form, { site: 'Rankin', date: '2026-10-30', bolNumber: 'BOL-17' })
    await fuelRecService.list('Rankin', '2026-10-24', '2026-10-30')

    expect(mocks.post.mock.calls[0]).toEqual([
      '/fuel-rec/capture',
      form,
      expect.objectContaining({ headers: expect.objectContaining({
        'X-Required-Permission': 'accounting.fuelRec.bol',
        'X-Action-Type': 'create',
        'X-Action-Source': 'fuel-rec',
        'X-Action-Message': 'Fuel BOL BOL-17 captured for Rankin on 2026-10-30',
      }) }),
    ])
    expect(mocks.get.mock.calls[0]).toEqual([
      '/fuel-rec/list',
      expect.objectContaining({
        params: { site: 'Rankin', from: '2026-10-24', to: '2026-10-30' },
        headers: expect.objectContaining({
          'X-Action-Type': 'read',
          'X-Action-Message': 'Fuel BOL entries viewed for Rankin from 2026-10-24 to 2026-10-30',
        }),
      }),
    ])
    expect(mocks.get.mock.calls[0][1].headers).not.toHaveProperty('X-Required-Permission')
  })

  it('reuses the centralized Locations API', async () => {
    await fuelRecService.listLocations()

    expect(mocks.get).toHaveBeenCalledWith('/locations', expect.objectContaining({
      headers: expect.objectContaining({
        'X-Action-Source': 'fuel-rec',
        'X-Action-Resource': 'location',
      }),
    }))
  })

  it('covers retake, comment, link, unlink, and delete operations', async () => {
    const entry = { _id: 'bol-1', site: 'Rankin', date: '2026-10-30', bolNumber: 'BOL-17' }
    const order = { _id: 'order-1', poNumber: 'PO-44' }

    await fuelRecService.requestAgain(entry)
    await fuelRecService.addComment(entry, 'BOL Posted')
    await fuelRecService.getLinkablePos(entry, 7)
    await fuelRecService.linkPo(entry, order)
    await fuelRecService.unlinkPo(entry, order)
    await fuelRecService.remove(entry)

    expect(mocks.post.mock.calls[0][0]).toBe('/fuel-rec/request-again')
    expect(mocks.post.mock.calls[1][0]).toBe('/fuel-rec/bol-1/comment')
    expect(mocks.get.mock.calls[0][1].params).toEqual({ daysBack: 7 })
    expect(mocks.post.mock.calls[2][2].headers['X-Action-Message']).toContain('linked to PO PO-44')
    expect(mocks.post.mock.calls[3][2].headers['X-Action-Message']).toContain('unlinked from PO PO-44')
    expect(mocks.delete.mock.calls[0][1].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'accounting.fuelRec.delete',
      'X-Action-Type': 'delete',
    }))

    for (const call of mocks.post.mock.calls) {
      if (call[0] === '/fuel-rec/capture') continue
      expect(call[2].headers).not.toHaveProperty('X-Required-Permission')
    }
  })

  it('prevents Fuel Rec pages from reintroducing direct backend API calls', () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url))
    const routeRoot = path.resolve(testDir, '../../../routes/_navbarLayout/fuel-rec')
    const files = [
      path.resolve(routeRoot, '../fuel-rec.tsx'),
      path.join(routeRoot, 'index.tsx'),
      path.join(routeRoot, 'list.tsx'),
    ]

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      expect(source, path.basename(file)).not.toMatch(/["'`]\/api\//)
      expect(source, path.basename(file)).not.toMatch(/axios\.(get|post|put|patch|delete)\s*\(/)
    }
  })
})
