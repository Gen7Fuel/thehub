import { actionOptions } from '@/api/resources/action-options'
import { stationAuditsApi, type StationAuditChecklistQuery } from './station-audits.api'

const source = 'station-audits.checklist'

export const stationAuditsService = {
  listSections(query: Pick<StationAuditChecklistQuery, 'site' | 'type' | 'date'>) {
    return stationAuditsApi.listSections(
      query,
      actionOptions(
        'stationAudit',
        source,
        'read',
        'station-audit-section',
        `New Station Audit sections viewed for ${query.site}`,
      ),
    )
  },
  getSectionChecklists(sectionId: string, query: StationAuditChecklistQuery) {
    return stationAuditsApi.getSectionChecklists(
      sectionId,
      query,
      actionOptions(
        'stationAudit',
        source,
        'read',
        'station-audit-checklist',
        `New Station Audit checklists viewed for ${query.site}`,
      ),
    )
  },
}
