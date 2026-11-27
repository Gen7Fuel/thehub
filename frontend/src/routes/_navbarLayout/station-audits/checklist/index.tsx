import { useCallback } from 'react'
import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router'
import { StationAuditSectionNavigationPage } from '@/components/custom/station-audits/SectionNavigationPage'
import { useAuth } from '@/context/AuthContext'
import { defaultStoreAuditFrequency, storeAuditFrequencies } from '@/lib/stationAuditPermissions'

export const Route = createFileRoute('/_navbarLayout/station-audits/checklist/')({
  validateSearch: (search: Record<string, unknown>) => ({
    site: typeof search.site === 'string' ? search.site : undefined,
  }),
  component: SectionNavigationPage,
})

function SectionNavigationPage() {
  const { user } = useAuth()
  const navigate = useNavigate({ from: Route.fullPath })
  const { site } = Route.useSearch()
  const defaultFrequency = defaultStoreAuditFrequency(user?.access)
  const visibleFrequencies = storeAuditFrequencies(user?.access).filter(
    (frequency): frequency is 'daily' | 'weekly' | 'monthly' => frequency !== 'all',
  )
  const onSiteChange = useCallback(
    (nextSite: string) => navigate({ search: { site: nextSite }, replace: true }),
    [navigate],
  )
  const onNoAccess = useCallback(() => navigate({ to: '/no-access' }), [navigate])
  const onSectionOpen = useCallback((sectionId: string) => navigate({
    to: '/station-audits/checklist/$sectionId',
    params: { sectionId },
    search: { site, frequency: defaultFrequency! },
  }), [defaultFrequency, navigate, site])

  if (!user) return null
  if (!defaultFrequency) return <Navigate to="/no-access" replace />

  return (
    <StationAuditSectionNavigationPage
      auditType="store"
      site={site}
      onSectionOpen={onSectionOpen}
      onSiteChange={onSiteChange}
      onNoAccess={onNoAccess}
      visibleFrequencies={visibleFrequencies}
    />
  )
}
