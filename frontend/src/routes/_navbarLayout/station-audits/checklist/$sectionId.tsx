import { useCallback } from 'react'
import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router'
import { StationAuditSectionChecklistPage } from '@/components/custom/station-audits/SectionChecklistPage'
import { useAuth } from '@/context/AuthContext'
import { defaultStoreAuditFrequency, storeAuditFrequencies } from '@/lib/stationAuditPermissions'
import type { StationAuditFrequency } from '@/api/station-audits/station-audits.types'

export const Route = createFileRoute('/_navbarLayout/station-audits/checklist/$sectionId')({
  validateSearch: (search: Record<string, unknown>) => ({
    site: typeof search.site === 'string' ? search.site : undefined,
    frequency: ['daily', 'weekly', 'monthly'].includes(String(search.frequency))
      ? search.frequency as StationAuditFrequency
      : 'all' as StationAuditFrequency,
  }),
  component: SectionChecklistPage,
})

function SectionChecklistPage() {
  const { user } = useAuth()
  const { sectionId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const availableFrequencies = storeAuditFrequencies(user?.access)
  const defaultFrequency = defaultStoreAuditFrequency(user?.access)
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
    () => navigate({ to: '/station-audits/checklist', search: { site: search.site } }),
    [navigate, search.site],
  )
  const onBack = useCallback(
    () => navigate({ to: '/station-audits/checklist', search: { site: search.site } }),
    [navigate, search.site],
  )

  if (!user) return null
  if (!defaultFrequency) return <Navigate to="/no-access" replace />
  if (!availableFrequencies.includes(search.frequency)) {
    return <Navigate
      to="/station-audits/checklist/$sectionId"
      params={{ sectionId }}
      search={{ ...search, frequency: defaultFrequency }}
      replace
    />
  }

  return (
    <StationAuditSectionChecklistPage
      sectionId={sectionId}
      site={search.site}
      frequency={search.frequency}
      availableFrequencies={availableFrequencies}
      auditType="store"
      onBack={onBack}
      onInitializeSite={onInitializeSite}
      onSiteChange={onSiteChange}
      onFrequencyChange={onFrequencyChange}
      onNoAccess={onNoAccess}
      onNotFound={onNotFound}
    />
  )
}
