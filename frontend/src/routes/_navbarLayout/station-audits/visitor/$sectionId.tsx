import { useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { StationAuditSectionChecklistPage } from '@/components/custom/station-audits/SectionChecklistPage'
import type { StationAuditFrequency } from '@/api/station-audits/station-audits.types'

export const Route = createFileRoute('/_navbarLayout/station-audits/visitor/$sectionId')({
  validateSearch: (search: Record<string, unknown>) => ({
    site: typeof search.site === 'string' ? search.site : undefined,
    frequency: ['daily', 'weekly', 'monthly'].includes(String(search.frequency))
      ? search.frequency as StationAuditFrequency
      : 'all' as StationAuditFrequency,
  }),
  component: VisitorSectionChecklistPage,
})

function VisitorSectionChecklistPage() {
  const { sectionId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const onInitializeSite = useCallback(
    (site: string) => navigate({ search: { ...search, site }, replace: true }),
    [navigate, search],
  )
  const onSiteChange = useCallback(
    (site: string) => navigate({ search: { ...search, site }, replace: true }),
    [navigate, search],
  )
  const onFrequencyChange = useCallback(
    (frequency: StationAuditFrequency) => navigate({ search: { ...search, frequency }, replace: true }),
    [navigate, search],
  )
  const onNoAccess = useCallback(() => navigate({ to: '/no-access' }), [navigate])
  const onNotFound = useCallback(
    () => navigate({ to: '/station-audits/visitor', search: { site: search.site } }),
    [navigate, search.site],
  )
  const onBack = useCallback(
    () => navigate({ to: '/station-audits/visitor', search: { site: search.site } }),
    [navigate, search.site],
  )

  return (
    <StationAuditSectionChecklistPage
      sectionId={sectionId}
      site={search.site}
      frequency={search.frequency}
      auditType="visitor"
      onBack={onBack}
      onInitializeSite={onInitializeSite}
      onSiteChange={onSiteChange}
      onFrequencyChange={onFrequencyChange}
      onNoAccess={onNoAccess}
      onNotFound={onNotFound}
    />
  )
}
