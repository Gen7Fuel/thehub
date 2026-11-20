import type { FuelGradeOption } from '@/api/fuel-management/fuel-grades.service'
import { getFuelGradeDisplay, getGradeLabelColor } from '@/lib/fuelGradeDisplay'
import { cn } from '@/lib/utils'

export function FuelGradeLabel({
  grade, grades, tank = false, className, fallbackColor,
}: {
  grade: string
  grades: readonly FuelGradeOption[]
  tank?: boolean
  className?: string
  fallbackColor?: string
}) {
  const { name, label, color: backgroundColor } = getFuelGradeDisplay(grade, grades, fallbackColor)

  return (
    <span
      className={cn('inline-block w-fit rounded px-1.5 py-0.5 text-[10px] font-black', className)}
      style={{ backgroundColor, color: getGradeLabelColor(backgroundColor) }}
      title={name}
    >
      {tank && grade === 'Regular' ? 'RUL | E15' : label}
    </span>
  )
}
