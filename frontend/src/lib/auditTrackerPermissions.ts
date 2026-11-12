export type AuditTrackerPermission = 'myIssues' | 'departmentIssues' | 'report'

export function hasAuditTrackerAccess(access: Record<string, any> | undefined) {
  return access?.auditTracker?.value === true
}

export function hasAuditTrackerPermission(
  access: Record<string, any> | undefined,
  permission: AuditTrackerPermission,
) {
  const value = access?.auditTracker?.[permission]
  return value === true || value?.value === true
}
