import { describe, expect, it } from 'vitest'
import {
  hasAuditTrackerAccess,
  hasAuditTrackerMyIssuesAction,
  hasAuditTrackerPermission,
} from '../auditTrackerPermissions'

describe('audit tracker permissions', () => {
  it('requires the auditTracker root value', () => {
    expect(hasAuditTrackerAccess({ auditTracker: { value: true } })).toBe(true)
    expect(hasAuditTrackerAccess({ auditTracker: { myIssues: true } })).toBe(false)
  })

  it('supports boolean and nested-value module permissions', () => {
    const access = {
      auditTracker: {
        value: true,
        myIssues: { value: true },
        departmentIssues: true,
        report: { value: false },
      },
    }

    expect(hasAuditTrackerPermission(access, 'myIssues')).toBe(true)
    expect(hasAuditTrackerPermission(access, 'departmentIssues')).toBe(true)
    expect(hasAuditTrackerPermission(access, 'report')).toBe(false)
  })

  it('checks each My Issues action independently', () => {
    const access = {
      auditTracker: {
        value: true,
        myIssues: {
          value: true,
          updateStatus: true,
          escalateIssue: { value: true },
          postComments: false,
        },
      },
    }

    expect(hasAuditTrackerMyIssuesAction(access, 'updateStatus')).toBe(true)
    expect(hasAuditTrackerMyIssuesAction(access, 'escalateIssue')).toBe(true)
    expect(hasAuditTrackerMyIssuesAction(access, 'postComments')).toBe(false)
  })
})
