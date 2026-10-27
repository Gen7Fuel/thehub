import { describe, expect, it } from 'vitest'
import auditDiff from '../utils/auditDiff.js'

const { computeAuditDiff, buildAuditMessage } = auditDiff

describe('generalized audit diff', () => {
  it('compares nested permission trees by permId without logging version fields', () => {
    const before = {
      module_name: 'kardpoll',
      __v: 2,
      structure: [{ permId: 50001, name: 'reports', children: [] }],
    }
    const after = {
      module_name: 'kardpoll',
      __v: 3,
      structure: [
        { permId: 50001, name: 'reporting', children: [] },
        { permId: 50002, name: 'export', children: [] },
      ],
    }

    const result = computeAuditDiff(before, after, { arrayKeys: { structure: 'permId' } })

    expect(result.changes).toEqual([
      { operation: 'replace', path: 'structure[permId=50001].name', before: 'reports', after: 'reporting' },
      {
        operation: 'add',
        path: 'structure[permId=50002]',
        after: { permId: 50002, name: 'export', children: [] },
      },
    ])
    expect(result.changeSummary).toEqual({ added: 1, removed: 0, replaced: 1, total: 2 })
    expect(buildAuditMessage({
      action: 'update',
      resourceType: 'permission',
      resourceLabel: 'kardpoll',
      changeSummary: result.changeSummary,
      changes: result.changes,
    })).toBe('Permission kardpoll updated — 1 added, 1 changed: structure[permId=50001].name: reports to reporting, export')
  })

  it('redacts secrets and limits the number of recorded changes', () => {
    const result = computeAuditDiff(
      { password: 'old', first: 1, second: 2 },
      { password: 'new', first: 2, second: 3 },
      { maxChanges: 2 },
    )

    expect(result.changes[0]).toEqual({
      operation: 'replace',
      path: 'password',
      before: '[REDACTED]',
      after: '[REDACTED]',
    })
    expect(result.changes).toHaveLength(2)
    expect(result.changesTruncated).toBe(true)
  })

  it('creates one summary message for a bulk operation', () => {
    expect(buildAuditMessage({
      action: 'update',
      resourceType: 'purchase-order',
      bulk: { affectedCount: 50 },
    })).toBe('50 Purchase Order records updated')
  })
})
