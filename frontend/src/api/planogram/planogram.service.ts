import { actionOptions } from '@/api/resources/action-options'
import { planogramApi } from './planogram.api'

export const planogramService = {
  get<T>(site: string) { return planogramApi.get<T>(site, actionOptions('planogram.view', 'planogram', 'read', 'planogram', `Planogram metadata viewed for ${site}`)) },
  upload<T>(site: string, file: File, confirm = false) { return planogramApi.upload<T>(site, file, confirm, actionOptions('planogram.upload', 'planogram', 'update', 'planogram', `Planogram replacement requested for ${site} using ${file.name}${confirm ? ' with shrink confirmation' : ''}`)) },
}
