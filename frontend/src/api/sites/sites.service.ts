// Settings Sites orchestration: endpoint definitions live in resource API modules.
import { locationsApi } from '@/api/locations/locations.api'
import { actionOptions } from '@/api/resources/action-options'
import { safesheetsApi } from '@/api/safesheets/safesheets.api'
import { usersApi as usersResourceApi } from '@/api/users/users.api'
import type { SettingsUser, Site, SiteInput } from '@/api/locations/locations.types'

type SiteUpdatePurpose = 'details' | 'pushover' | 'registers'

const actionConfig = (
  action: 'create' | 'read' | 'update',
  resourceType: string,
  message: string,
) => actionOptions('settings', 'settings.sites', action, resourceType, message)

const updateMessages: Record<SiteUpdatePurpose, (site: string) => string> = {
  details: (site) => `Site settings update requested for ${site}`,
  pushover: (site) => `Pushover configuration update requested for ${site}`,
  registers: (site) => `Register configuration update requested for ${site}`,
}

export const sitesApi = {
  async list(): Promise<Site[]> {
    return locationsApi.listSettings(actionConfig('read', 'location', 'Site list viewed in Settings'))
  },

  async get(id: string): Promise<Site> {
    return locationsApi.getSettings(id, actionConfig('read', 'location', 'Site configuration opened in Settings'))
  },

  async create(input: SiteInput): Promise<Site> {
    return locationsApi.create(input, actionConfig('create', 'location', `Site ${input.stationName} creation requested`))
  },

  async update(id: string, input: Partial<SiteInput>, purpose: SiteUpdatePurpose): Promise<Site> {
    return locationsApi.update(id, input, actionConfig('update', 'location', updateMessages[purpose](input.stationName || id)))
  },

  async listAssignableUsers(site: string): Promise<SettingsUser[]> {
    return usersResourceApi.listWithRoles(actionConfig('read', 'user', `Users viewed while configuring site ${site}`)) as Promise<SettingsUser[]>
  },

  async assignUsers(id: string, stationName: string, userIds: string[]): Promise<void> {
    await locationsApi.assignUsers(id, stationName, userIds, actionConfig('update', 'site-access', `Site access assignments update requested for ${stationName}`))
  },

  async hasSafesheet(stationName: string): Promise<boolean> {
    return safesheetsApi.exists(stationName, actionConfig('read', 'safesheet', `Safesheet availability checked while configuring ${stationName}`))
  },

  async createSafesheet(stationName: string, initialBalance: number): Promise<void> {
    await safesheetsApi.create(stationName, initialBalance, actionConfig('create', 'safesheet', `Safesheet creation requested while configuring ${stationName}`))
  },
}
