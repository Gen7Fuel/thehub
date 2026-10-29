import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { auditService } from '../audit.service'

const expectHeaders = (headers: unknown, expected: Record<string, string>) => {
  expect(headers).toEqual(expect.objectContaining(expected))
}

describe('auditService request metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockResolvedValue({ data: [] })
    mocks.post.mockResolvedValue({ data: {} })
    mocks.put.mockResolvedValue({ data: {} })
    mocks.delete.mockResolvedValue({ data: { success: true } })
  })

  it('identifies checklist reads separately from interface reads', async () => {
    await auditService.listChecklistTemplates()
    expectHeaders(mocks.get.mock.calls[0][1].headers, {
      'X-Required-Permission': 'stationAudit',
      'X-Action-Source': 'station-audit.checklist',
      'X-Action-Type': 'read',
      'X-Action-Resource': 'audit-template',
      'X-Action-Message': 'Station Audit checklists viewed',
    })

    await auditService.listInterfaceIssues({ site: 'Rankin' })
    expectHeaders(mocks.get.mock.calls[1][1].headers, {
      'X-Required-Permission': 'stationAudit.interface',
      'X-Action-Source': 'station-audit.interface',
      'X-Action-Message': 'All open Station Audit issues viewed for Rankin in the audit interface',
    })
  })

  it('includes checklist names and readable periods in audit reads', async () => {
    await auditService.getChecklistItems(
      { site: 'Rankin', templateId: 'template-1' },
      { checklistName: 'Site Interior', periodLabel: 'day Oct 28, 2026' },
    )
    expectHeaders(mocks.get.mock.calls[0][1].headers, {
      'X-Action-Message': 'Station Audit checklist Site Interior opened for Rankin — day Oct 28, 2026',
    })

    await auditService.compareAudits(
      { site: 'Rankin', template: 'template-1' },
      { checklistName: 'Inventory', periodLabel: 'week Oct 25, 2026 to Oct 31, 2026' },
    )
    expectHeaders(mocks.get.mock.calls[1][1].headers, {
      'X-Action-Message': 'Store and visitor audits compared for Rankin — Inventory — week Oct 25, 2026 to Oct 31, 2026',
    })
  })

  it('uses names and distinct language for template and option-set reads', async () => {
    await auditService.getTemplateForAdmin('template-1', 'Site Exterior')
    expectHeaders(mocks.get.mock.calls[0][1].headers, {
      'X-Action-Message': 'Station Audit checklist template Site Exterior opened for editing',
    })

    await auditService.getSelectTemplate('select-1', 'Status')
    expectHeaders(mocks.get.mock.calls[1][1].headers, {
      'X-Action-Message': 'Audit status/dropdown option set Status opened for editing',
    })
  })

  it('annotates template mutations with the administration source', async () => {
    await auditService.updateTemplate('template-1', { name: 'Safety' }, 'Safety')
    expectHeaders(mocks.put.mock.calls[0][2].headers, {
      'X-Required-Permission': 'stationAudit.template',
      'X-Action-Source': 'station-audit.templates',
      'X-Action-Type': 'update',
      'X-Action-Resource': 'audit-template',
      'X-Action-Message': 'Station Audit template Safety update requested',
    })
  })

  it('uses one update intent for each aggregated audit submission', async () => {
    await auditService.saveChecklist({ site: 'Rankin', items: [] })
    expectHeaders(mocks.post.mock.calls[0][2].headers, {
      'X-Action-Source': 'station-audit.checklist',
      'X-Action-Type': 'update',
      'X-Action-Resource': 'audit-instance',
      'X-Action-Message': 'Station Audit submission requested for Rankin',
    })

    await auditService.saveVisitorAudit({ site: 'Rankin', items: [] })
    expectHeaders(mocks.post.mock.calls[1][2].headers, {
      'X-Action-Source': 'station-audit.visitor',
      'X-Action-Type': 'update',
      'X-Action-Message': 'Visitor Audit submission requested for Rankin',
    })
  })

  it('labels Dashboard statistics as Dashboard traffic', async () => {
    await auditService.getDashboardStats('Rankin', { daily: '2026-10-28' })
    expectHeaders(mocks.get.mock.calls[0][1].headers, {
      'X-Required-Permission': 'dashboard',
      'X-Action-Source': 'dashboard.station-audit',
      'X-Action-Message': 'Station Audit statistics viewed on Dashboard for Rankin',
    })
  })
})
