import { useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { StationAuditSectionNavigationPage } from '@/components/custom/station-audits/SectionNavigationPage'

export const Route = createFileRoute('/_navbarLayout/station-audits/visitor/')({
  validateSearch: (search: Record<string, unknown>) => ({
    site: typeof search.site === 'string' ? search.site : undefined,
  }),
  component: VisitorSectionNavigationPage,
})

function VisitorSectionNavigationPage() {
  const navigate = useNavigate({ from: Route.fullPath })
  const { site } = Route.useSearch()
  const onSiteChange = useCallback(
    (nextSite: string) => navigate({ search: { site: nextSite }, replace: true }),
    [navigate],
  )
  const onNoAccess = useCallback(() => navigate({ to: '/no-access' }), [navigate])
  const onSectionOpen = useCallback((sectionId: string) => navigate({
    to: '/station-audits/visitor/$sectionId',
    params: { sectionId },
    search: { site, frequency: 'all' },
  }), [navigate, site])

  return (
    <StationAuditSectionNavigationPage
      auditType="visitor"
      site={site}
      onSectionOpen={onSectionOpen}
      onSiteChange={onSiteChange}
      onNoAccess={onNoAccess}
    />
  )
}
