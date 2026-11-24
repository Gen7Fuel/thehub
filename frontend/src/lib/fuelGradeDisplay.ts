import type { FuelGradeOption } from '@/api/fuel-management/fuel-grades.service'

export function getFuelGradeDisplay(
  grade: string,
  grades: readonly FuelGradeOption[],
  fallbackColor = '#475569',
) {
  const entry = grades.find(option => option.key === grade)
  return {
    name: entry?.name ?? grade,
    label: entry?.shortName || entry?.name || grade,
    color: entry?.color ?? fallbackColor,
  }
}

export function getGradeLabelColor(hex: string) {
  const [red, green, blue] = [1, 3, 5].map(offset => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
  return luminance > 0.179 ? '#000000' : '#ffffff'
}

export function sortByFuelGrade<T extends { grade: string }>(
  items: readonly T[],
  grades: readonly FuelGradeOption[],
): T[] {
  const positions = new Map(grades.map(({ key }, index) => [key, index]))
  return [...items].sort((a, b) =>
    (positions.get(a.grade) ?? grades.length) - (positions.get(b.grade) ?? grades.length),
  )
}
