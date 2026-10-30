import { filesApi } from '@/api/files/files.api'
import { actionOptions } from '@/api/resources/action-options'
import { safesheetsApi } from './safesheets.api'

const permission = 'accounting.safesheet'
const read = (source: string, resourceType: string, message: string) =>
  actionOptions(permission, source, 'read', resourceType, message)
const update = (source: string, resourceType: string, message: string) =>
  actionOptions(permission, source, 'update', resourceType, message)
const remove = (source: string, resourceType: string, message: string) =>
  actionOptions('accounting.safesheet.deleteEntry', source, 'delete', resourceType, message)

export const safesheetService = {
  get<T = unknown>(site: string, from: string, to: string, sortAssigned: boolean) {
    return safesheetsApi.get<T>(
      site,
      { from, to, sortAssigned },
      read('safesheet.page', 'safesheet', `Safesheet viewed for ${site} from ${from} to ${to}`),
    )
  },

  addEntry<T = unknown>(site: string, input: { date: string; description?: string; cashIn?: number; cashExpenseOut?: number; cashDepositBank?: number }) {
    return safesheetsApi.addEntry<T>(
      site,
      input,
      update('safesheet.page', 'safesheet-entry', `Safesheet entry addition requested for ${site}`),
    )
  },

  updateEntry<T = unknown>(site: string, entryId: string, input: Record<string, unknown>) {
    return safesheetsApi.updateEntry<T>(
      site,
      entryId,
      input,
      update('safesheet.page', 'safesheet-entry', `Safesheet entry ${entryId} update requested for ${site}`),
    )
  },

  deleteEntry<T = unknown>(site: string, entryId: string) {
    return safesheetsApi.deleteEntry<T>(
      site,
      entryId,
      remove('safesheet.page', 'safesheet-entry', `Safesheet entry ${entryId} deletion requested for ${site}`),
    )
  },

  uploadPhoto(file: File, site: string, entryId: string) {
    return filesApi.upload(file, {
      auth: false,
      actionContext: {
        action: 'create',
        resourceType: 'safesheet-photo',
        source: 'safesheet.page',
        message: `Safesheet photo upload requested for entry ${entryId} at ${site}`,
      },
    })
  },
}
