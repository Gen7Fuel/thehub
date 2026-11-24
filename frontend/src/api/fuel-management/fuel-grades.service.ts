import type { RequestOptions } from '@/api/core/types'
import { createFuelResourceApi } from './resource.api'

export interface FuelGradeInput {
  name: string
  shortName: string
  color: string
  sortOrder: number
  cstoreFuelTypes?: string[]
}

export interface FuelGrade extends FuelGradeInput {
  _id: string
  key: string
  active: boolean
}

export type FuelGradeOption = Pick<FuelGrade, 'key' | 'name' | 'shortName' | 'color' | 'active'>

const api = createFuelResourceApi('/fuel-grades')
const options = (action: 'read' | 'create' | 'update', message: string): RequestOptions => ({
  actionContext: { action, source: 'fuel-management.manage.grades', resourceType: 'fuel-grade', message },
})

export const fuelGradesService = {
  list() {
    return api.get<FuelGrade[]>('', undefined, options('read', 'Fuel grades viewed'))
  },
  create(input: FuelGradeInput) {
    return api.post<FuelGrade>('', input, options('create', 'Fuel grade creation requested'))
  },
  update(id: string, input: FuelGradeInput | { active: boolean }) {
    return api.patch<FuelGrade>(`/${encodeURIComponent(id)}`, input, options('update', 'Fuel grade update requested'))
  },
}

export const fuelGradeOptionsQuery = {
  queryKey: ['fuel-grades', 'options'] as const,
  queryFn: () => api.get<FuelGradeOption[]>('/options', undefined, options('read', 'Fuel grade options viewed')),
}
