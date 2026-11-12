import { actionOptions } from '@/api/resources/action-options'
import { auditTrackerApi } from './audit-tracker.api'
import type { MyIssuesQuery } from './audit-tracker.types'

export const auditTrackerService = {
  myIssues(query: MyIssuesQuery) {
    return auditTrackerApi.myIssues(
      query,
      actionOptions(
        'auditTracker.myIssues',
        'audit-tracker.my-issues',
        'read',
        'station-audit-issue',
        'Assigned open Station Audit issues viewed',
      ),
    )
  },
}
