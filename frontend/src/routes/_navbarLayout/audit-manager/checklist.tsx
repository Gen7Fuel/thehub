import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Navigate, Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { Archive, CheckCircle2, ListChecks, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { auditManagerService } from '@/api/audit-manager/audit-manager.service'
import type { AuditManagerSection } from '@/api/audit-manager/audit-manager.types'
import { isApiError } from '@/api/core/errors'
import { useAuth } from '@/context/AuthContext'
import { hasAuditManagerAccess, hasAuditManagerPermission } from '@/lib/auditManagerPermissions'

export const Route = createFileRoute('/_navbarLayout/audit-manager/checklist')({ component: ChecklistManagementRoute })

function ChecklistManagementRoute() {
  const matchRoute = useMatchRoute()
  const isSectionPage = Boolean(matchRoute({
    to: '/audit-manager/checklist/$sectionId',
    fuzzy: true,
  }))

  return isSectionPage ? <Outlet /> : <ChecklistManagementPage />
}

function ChecklistManagementPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [sections, setSections] = useState<AuditManagerSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const canView = hasAuditManagerAccess(user?.access) && hasAuditManagerPermission(user?.access, 'checklist')

  useEffect(() => {
    if (!user || !canView) return
    let cancelled = false
    auditManagerService.checklistSections()
      .then((result) => { if (!cancelled) setSections(result.sections) })
      .catch((requestError) => {
        if (cancelled) return
        if (isApiError(requestError) && requestError.status === 403) return void navigate({ to: '/no-access' })
        setError('Unable to load the checklist sections available to your departments.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [canView, navigate, user])

  const sortedSections = useMemo(() => [...sections].sort((left, right) =>
    Number(right.active) - Number(left.active)
    || (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER)
    || left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })), [sections])

  if (!user) return null
  if (!canView) return <Navigate to="/no-access" replace />

  return <div className="mx-auto w-full max-w-6xl px-3 pb-10 sm:px-5">
    <div className="mb-5 rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-4 shadow-sm sm:p-6"><div className="flex items-start gap-3"><div className="rounded-xl bg-cyan-600 p-2.5 text-white"><ListChecks className="h-6 w-6" /></div><div><h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Checklist Management</h1><p className="mt-1 text-sm text-slate-600">Select a section to review the checklist metadata available to your departments.</p></div></div></div>
    {loading && <div className="flex min-h-60 items-center justify-center rounded-2xl border border-dashed bg-white"><Loader2 className="mr-2 h-5 w-5 animate-spin text-cyan-600" />Loading sections…</div>}
    {!loading && error && <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">{error}</div>}
    {!loading && !error && sortedSections.length === 0 && <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-slate-500">No checklist sections are assigned to your departments.</div>}
    {!loading && !error && sortedSections.length > 0 && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{sortedSections.map((section) => <button key={section._id} type="button" className="group h-full text-left" onClick={() => navigate({ to: '/audit-manager/checklist/$sectionId', params: { sectionId: section._id } })}><Card className={`h-full transition group-hover:-translate-y-0.5 group-hover:border-cyan-300 group-hover:shadow-md ${section.active ? '' : 'bg-slate-50 opacity-60'}`}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><CardTitle className="text-lg">{section.name}</CardTitle>{section.active ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Archive className="h-5 w-5 text-slate-400" />}</div>{section.description && <p className="line-clamp-2 text-sm font-normal text-slate-500">{section.description}</p>}</CardHeader><CardContent><div className="mb-4 flex flex-wrap gap-1.5"><Badge variant="secondary" className="capitalize">{section.sectionType}</Badge><Badge variant={section.active ? 'outline' : 'secondary'}>{section.active ? 'Active' : 'Inactive'}</Badge></div><div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-500"><div className="rounded-lg bg-slate-50 p-2"><strong className="block text-base text-slate-800">{section.checklistCount}</strong>Checklists</div><div className="rounded-lg bg-slate-50 p-2"><strong className="block text-base text-slate-800">{section.sites?.length || 0}</strong>Sites</div><div className="rounded-lg bg-slate-50 p-2"><strong className="block text-base text-slate-800">{section.departments?.length || 0}</strong>Departments</div></div></CardContent></Card></button>)}</div>}
  </div>
}
