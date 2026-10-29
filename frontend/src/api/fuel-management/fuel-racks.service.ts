import { actionOptions } from '@/api/resources/action-options'
import { createFuelResourceApi } from './resource.api'

const api = createFuelResourceApi('/fuel-racks')
const permission = 'fuelManagement.manage'
const read = (source: string, message: string) => actionOptions(permission, source, 'read', 'fuel-rack', message)
const mutate = (action: 'create' | 'update' | 'delete', message: string) => actionOptions(permission, 'fuel-management.manage.racks', action, 'fuel-rack', message)

export const fuelRacksService = {
  list<T = unknown>(source = 'fuel-management.manage.racks', purpose = 'Fuel racks viewed') {
    return api.get<T>('', undefined, read(source, purpose))
  },
  get<T = unknown>(id: string, source = 'fuel-management.manage.racks') {
    return api.get<T>(`/${encodeURIComponent(id)}`, undefined, read(source, `Fuel rack ${id} opened`))
  },
  create<T = unknown>(input: unknown, name?: string) {
    return api.post<T>('', input, mutate('create', `Fuel rack creation requested${name ? ` for ${name}` : ''}`))
  },
  update<T = unknown>(id: string, input: unknown, name?: string) {
    return api.put<T>(`/${encodeURIComponent(id)}`, input, mutate('update', `Fuel rack update requested for ${name || id}`))
  },
  remove<T = unknown>(id: string, name?: string) {
    return api.remove<T>(`/${encodeURIComponent(id)}`, mutate('delete', `Fuel rack deletion requested for ${name || id}`))
  },
}
