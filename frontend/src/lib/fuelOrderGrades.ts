import type { FuelGradeOption } from '@/api/fuel-management/fuel-grades.service'

interface FuelOrderItem {
  grade: string
  ltrs: number
}

export function getOrderTankGrade(grade: string): string {
  return grade === 'E15' ? 'Regular' : grade
}

export function getOrderGradeItems(
  catalog: readonly FuelGradeOption[],
  stationGrades: readonly string[],
  rackGrades: readonly string[],
  badgeGrades: readonly string[],
  quantities: readonly FuelOrderItem[],
): FuelOrderItem[] {
  const litersByGrade = new Map(quantities.map(item => [item.grade, item.ltrs]))

  return catalog
    .filter(grade => grade.active && rackGrades.includes(grade.key) && badgeGrades.includes(grade.key)
      && stationGrades.includes(getOrderTankGrade(grade.key)))
    .map(grade => ({ grade: grade.key, ltrs: litersByGrade.get(grade.key) ?? 0 }))
}
