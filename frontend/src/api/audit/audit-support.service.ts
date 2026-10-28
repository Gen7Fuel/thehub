import { locationsApi } from '@/api/locations/locations.api'
import { actionOptions } from '@/api/resources/action-options'
import { vendorsApi } from '@/api/vendors/vendors.api'

const source = 'station-audit.templates'

export const auditSupportService = {
  listSites<T = unknown[]>() {
    return locationsApi.list(actionOptions('stationAudit.template', source, 'read', 'location', 'Sites viewed while configuring Station Audit templates')) as Promise<T>
  },
  getSite<T = unknown>(site: string, context: 'checklist' | 'interface' | 'visitor' = 'checklist') {
    return locationsApi.getByName(site, actionOptions(
      context === 'interface' ? 'stationAudit.interface' : context === 'visitor' ? 'stationAudit.visitor' : 'stationAudit',
      `station-audit.${context}`,
      'read',
      'location',
      `Site details viewed while using ${context} audit for ${site}`,
    )) as Promise<T>
  },
  listVendors<T = unknown[]>() {
    return vendorsApi.list<T>(actionOptions('stationAudit.template', source, 'read', 'vendor', 'Vendors viewed while configuring Station Audit templates'))
  },
}
