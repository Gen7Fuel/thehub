// Settings Maintenance orchestration: endpoint definitions live in the resource API.
import { actionOptions } from '@/api/resources/action-options'
import { maintenanceApi as maintenanceResourceApi } from './maintenance.api'
import type { MaintenanceInput } from './maintenance.types'

const config = (action: 'read' | 'create' | 'update' | 'delete', message: string) => actionOptions('settings.maintenance', 'settings.maintenance', action, 'maintenance', message)

export const maintenanceApi = {
  async list<T>(): Promise<T[]> { return maintenanceResourceApi.list<T>(config('read', 'Maintenance schedules viewed in Settings')) },
  async get<T>(id: string): Promise<T> { return maintenanceResourceApi.get<T>(id, config('read', 'Maintenance schedule opened in Settings')) },
  async create(input: MaintenanceInput): Promise<void> { await maintenanceResourceApi.create(input, config('create', `Maintenance schedule ${input.name} creation requested`)) },
  async update(id: string, input: Partial<MaintenanceInput>, name: string, purpose: 'details' | 'start' | 'complete'): Promise<void> {
    const messages = { details: `Maintenance schedule ${name} update requested`, start: `Maintenance ${name} start requested`, complete: `Maintenance ${name} completion requested` }
    await maintenanceResourceApi.update(id, input, config('update', messages[purpose]))
  },
  async notify(id: string, name: string): Promise<void> { await maintenanceResourceApi.notify(id, config('update', `User notification requested for maintenance ${name}`)) },
  async cancel(id: string, name: string): Promise<void> { await maintenanceResourceApi.cancel(id, config('update', `Cancellation requested for maintenance ${name}`)) },
  async remove(id: string, name: string): Promise<void> { await maintenanceResourceApi.remove(id, config('delete', `Maintenance record ${name} deletion requested`)) },
}
