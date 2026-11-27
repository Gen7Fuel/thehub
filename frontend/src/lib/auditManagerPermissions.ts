export type AuditManagerPermission = 'section' | 'checklist' | 'department' | 'statusOptions'

export function hasAuditManagerAccess(access: Record<string, any> | undefined) {
  return access?.auditManager?.value === true
}

export function hasAuditManagerPermission(
  access: Record<string, any> | undefined,
  permission: AuditManagerPermission,
) {
  const value = access?.auditManager?.[permission]
  return value === true || value?.value === true
}

export function hasAuditManagerAction(
  access: Record<string, any> | undefined,
  permission: AuditManagerPermission,
  action: string,
) {
  const value = access?.auditManager?.[permission]?.[action]
  return value === true || value?.value === true
}

export function hasAuditManagerNestedAction(
  access: Record<string, any> | undefined,
  permission: AuditManagerPermission,
  action: string,
  nestedAction: string,
) {
  const value = access?.auditManager?.[permission]?.[action]?.[nestedAction]
  return value === true || value?.value === true
}
