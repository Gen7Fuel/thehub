import { actionOptions } from '@/api/resources/action-options'
import { createFuelResourceApi } from './resource.api'

const api = createFuelResourceApi('/fuel-suppliers')
const permission = 'fuelManagement.manage'
const read = (source: string, message: string) => actionOptions(permission, source, 'read', 'fuel-supplier', message)
const mutate = (action: 'create' | 'update' | 'delete', message: string) => actionOptions(permission, 'fuel-management.manage.suppliers', action, 'fuel-supplier', message)

export const fuelSuppliersService = {
  list<T = unknown>(associatedRack?: string, source = 'fuel-management.manage.suppliers', purpose = 'Fuel suppliers viewed') {
    return api.get<T>('', associatedRack ? { associatedRack } : undefined, read(source, purpose))
  },
  get<T = unknown>(id: string) {
    return api.get<T>(`/${encodeURIComponent(id)}`, undefined, read('fuel-management.manage.suppliers', `Fuel supplier ${id} opened for editing`))
  },
  create<T = unknown>(input: unknown, name?: string) {
    return api.post<T>('', input, mutate('create', `Fuel supplier creation requested${name ? ` for ${name}` : ''}`))
  },
  update<T = unknown>(id: string, input: unknown, name?: string) {
    return api.put<T>(`/${encodeURIComponent(id)}`, input, mutate('update', `Fuel supplier update requested for ${name || id}`))
  },
  remove<T = unknown>(id: string, name?: string) {
    return api.remove<T>(`/${encodeURIComponent(id)}`, mutate('delete', `Fuel supplier deletion requested for ${name || id}`))
  },
}
