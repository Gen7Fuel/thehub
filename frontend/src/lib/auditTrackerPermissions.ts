export type AuditTrackerPermission = 'myIssues' | 'departmentIssues' | 'report'
export type AuditTrackerMyIssuesAction = 'updateStatus' | 'escalateIssue' | 'postComments'

export function hasAuditTrackerAccess(access: Record<string, any> | undefined) {
  return access?.auditTracker?.value === true
}

export function hasAuditTrackerMyIssuesAction(
  access: Record<string, any> | undefined,
  action: AuditTrackerMyIssuesAction,
) {
  const value = access?.auditTracker?.myIssues?.[action]
  return value === true || value?.value === true
}

export function hasAuditTrackerPermission(
  access: Record<string, any> | undefined,
  permission: AuditTrackerPermission,
) {
  const value = access?.auditTracker?.[permission]
  return value === true || value?.value === true
}
