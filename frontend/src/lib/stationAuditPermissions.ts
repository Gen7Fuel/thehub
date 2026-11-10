import type { StationAuditFrequency } from '@/api/station-audits/station-audits.types'

export function hasStationAuditChecklist(access: Record<string, any> | undefined) {
  return access?.stationAudit?.checklist?.value === true
}

export function hasStationAuditVisitor(access: Record<string, any> | undefined) {
  const value = access?.stationAudit?.visitor
  return value === true || value?.value === true
}

export function storeAuditFrequencies(access: Record<string, any> | undefined): StationAuditFrequency[] {
  const checklist = access?.stationAudit?.checklist
  const frequencies: StationAuditFrequency[] = []
  const daily = checklist?.dailyAudits === true || checklist?.dailyAudits?.value === true
  const weekly = checklist?.weeklyAudits === true || checklist?.weeklyAudits?.value === true
  const monthly = checklist?.monthlyAudits === true || checklist?.monthlyAudits?.value === true
  if (daily && weekly && monthly) frequencies.push('all')
  if (daily) frequencies.push('daily')
  if (weekly) frequencies.push('weekly')
  if (monthly) frequencies.push('monthly')
  return frequencies
}

export function defaultStoreAuditFrequency(access: Record<string, any> | undefined): StationAuditFrequency | null {
  return storeAuditFrequencies(access)[0] || null
}
