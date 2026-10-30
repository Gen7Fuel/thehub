import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))
import { planogramService } from '../planogram.service'
import { cashSummaryService } from '../../cash-summary/cash-summary.service'
import { sageService } from '../../sage/sage.service'

describe('Callback, Planogram, and InfoNet API contracts', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue({ data: {} }); mocks.post.mockResolvedValue({ data: {} }) })

  it('annotates each page with its exact purpose', async () => {
    await sageService.exchangeToken('oauth-code')
    await planogramService.get('Rankin')
    await planogramService.upload('Rankin', new File(['x'], 'rankin.xlsx'))
    await cashSummaryService.getInfoNetReport('Rankin', '2026-10-01', '2026-10-31')
    expect(mocks.post.mock.calls[0][2].headers['X-Action-Source']).toBe('sage.callback')
    expect(mocks.get.mock.calls[0][1].headers).toEqual(expect.objectContaining({ 'X-Required-Permission': 'planogram.view', 'X-Action-Source': 'planogram' }))
    expect(mocks.post.mock.calls[1][2].headers).toEqual(expect.objectContaining({ 'X-Required-Permission': 'planogram.upload', 'X-Action-Type': 'update' }))
    expect(mocks.get.mock.calls[1][1].headers).toEqual(expect.objectContaining({ 'X-Required-Permission': 'accounting.infonetReport', 'X-Action-Source': 'infonet-report' }))
  })

  it('keeps active pages free of direct backend calls', () => {
    const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
    for (const file of ['routes/_navbarLayout/callback.tsx', 'routes/_navbarLayout/planogram.tsx', 'routes/_navbarLayout/infonet-report.tsx']) {
      const source = fs.readFileSync(path.join(src, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(source, file).not.toMatch(/["'`]\/api\//)
    }
  })
})
