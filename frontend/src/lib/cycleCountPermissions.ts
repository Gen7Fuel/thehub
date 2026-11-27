export const cycleCountPages = [
  { permission: 'count', to: '/cycle-count/count', label: 'Count' },
  { permission: 'inventory', to: '/cycle-count/inventory', label: 'Inventory' },
  { permission: 'report', to: '/cycle-count/report', label: 'Report' },
  { permission: 'manageCount', to: '/cycle-count/manage', label: 'Manage Counts' },
] as const

type CycleCountPagePermission = (typeof cycleCountPages)[number]['permission']

export function hasCycleCountPageAccess(
  access: Record<string, any> | undefined,
  permission: CycleCountPagePermission,
) {
  const module = access?.cycleCount
  const page = module?.[permission]
  return module?.value === true && (page === true || page?.value === true)
}
