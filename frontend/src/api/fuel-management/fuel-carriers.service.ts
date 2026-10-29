import { actionOptions } from '@/api/resources/action-options'
import { createFuelResourceApi } from './resource.api'

const api = createFuelResourceApi('/fuel-carriers')
const permission = 'fuelManagement.manage'
const read = (source: string, message: string) => actionOptions(permission, source, 'read', 'fuel-carrier', message)
const mutate = (action: 'create' | 'update' | 'delete', message: string) => actionOptions(permission, 'fuel-management.manage.carriers', action, 'fuel-carrier', message)

export const fuelCarriersService = {
  list<T = unknown>(source = 'fuel-management.manage.carriers', purpose = 'Fuel carriers viewed') {
    return api.get<T>('', undefined, read(source, purpose))
  },
  get<T = unknown>(id: string) {
    return api.get<T>(`/${encodeURIComponent(id)}`, undefined, read('fuel-management.manage.carriers', `Fuel carrier ${id} opened for editing`))
  },
  create<T = unknown>(input: unknown, name?: string) {
    return api.post<T>('', input, mutate('create', `Fuel carrier creation requested${name ? ` for ${name}` : ''}`))
  },
  update<T = unknown>(id: string, input: unknown, name?: string) {
    return api.put<T>(`/${encodeURIComponent(id)}`, input, mutate('update', `Fuel carrier update requested for ${name || id}`))
  },
  remove<T = unknown>(id: string, name?: string) {
    return api.remove<T>(`/${encodeURIComponent(id)}`, mutate('delete', `Fuel carrier deletion requested for ${name || id}`))
  },
}
