import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
import type { MyIssuesQuery, MyIssuesReadModel } from './audit-tracker.types'

export const auditTrackerApi = {
  async myIssues(query: MyIssuesQuery, options: RequestOptions): Promise<MyIssuesReadModel> {
    return (
      await apiClient.get('/station-audits/tracker/my-issues', {
        ...requestConfig(options),
        params: query,
      })
    ).data
  },
}
