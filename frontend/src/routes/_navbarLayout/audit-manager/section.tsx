import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router'
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Archive, Building2, CheckCircle2, ClipboardList, GripVertical, Loader2, MapPinned, MapPin, Pencil, Plus, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/context/AuthContext'
import { auditManagerService } from '@/api/audit-manager/audit-manager.service'
import { isApiError } from '@/api/core/errors'
import type { AuditManagerDepartmentSummary, AuditManagerSection, AuditManagerSectionCreate, AuditManagerSectionUpdate, AuditManagerSite } from '@/api/audit-manager/audit-manager.types'
import { hasAuditManagerAccess, hasAuditManagerAction, hasAuditManagerNestedAction, hasAuditManagerPermission } from '@/lib/auditManagerPermissions'

export const Route = createFileRoute('/_navbarLayout/audit-manager/section')({
  component: SectionManagementPage,
})

function siteName(site: AuditManagerSection['sites'][number]) {
  return site.site || site.stationName
}

function departmentHeadName(department: AuditManagerDepartmentSummary) {
  const head = department.departmentHead
  if (!head || typeof head === 'string') return 'No department head assigned'
  return [head.firstName, head.lastName].filter(Boolean).join(' ') || head.email
}

type EditableSectionField = 'name' | 'description' | 'sectionType' | 'sites' | 'departments' | 'active'
type EditDraft = string | number | boolean | string[]

const fieldLabels: Record<EditableSectionField, string> = {
  name: 'section name',
  description: 'description',
  sectionType: 'section type',
  sites: 'available sites',
  departments: 'assigned departments',
  active: 'section status',
}

const emptyCreateDraft: AuditManagerSectionCreate = {
  name: '',
  description: '',
  sectionType: 'checklist',
  sites: [],
  departments: [],
  active: true,
}

function SectionManagementPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [sections, setSections] = useState<AuditManagerSection[]>([])
  const [availableSites, setAvailableSites] = useState<AuditManagerSite[]>([])
  const [availableDepartments, setAvailableDepartments] = useState<AuditManagerDepartmentSummary[]>([])
  const [selectedSection, setSelectedSection] = useState<AuditManagerSection | null>(null)
  const [editField, setEditField] = useState<EditableSectionField | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft>('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reordering, setReordering] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createDraft, setCreateDraft] = useState<AuditManagerSectionCreate>(emptyCreateDraft)
  const [universalSiteOpen, setUniversalSiteOpen] = useState(false)
  const [universalSiteId, setUniversalSiteId] = useState('')
  const [confirmUniversalSite, setConfirmUniversalSite] = useState(false)
  const [universalDepartmentOpen, setUniversalDepartmentOpen] = useState(false)
  const [universalDepartmentId, setUniversalDepartmentId] = useState('')
  const [confirmUniversalDepartment, setConfirmUniversalDepartment] = useState(false)
  const [actionSaving, setActionSaving] = useState(false)
  const [actionError, setActionError] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const canView = hasAuditManagerAccess(user?.access)
    && hasAuditManagerPermission(user?.access, 'section')
  const canEdit = hasAuditManagerAction(user?.access, 'section', 'edit')
  const canAddSection = hasAuditManagerAction(user?.access, 'section', 'add')
  const canAddAllSite = hasAuditManagerNestedAction(user?.access, 'section', 'add', 'allSite')
  const canAddAllDepartment = hasAuditManagerNestedAction(user?.access, 'section', 'add', 'allDepartment')

  useEffect(() => {
    if (!user || !canView) return
    let cancelled = false
    setLoading(true)
    setError('')

    auditManagerService.listSections()
      .then((result) => {
        if (cancelled) return
        setSections(result.sections)
        setAvailableSites(result.options?.sites || [])
        setAvailableDepartments(result.options?.departments || [])
      })
      .catch((requestError) => {
        if (cancelled) return
        if (isApiError(requestError) && requestError.status === 403) {
          navigate({ to: '/no-access' })
          return
        }
        setError('Unable to load Station Audit sections. Please try again.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [canView, navigate, user])

  const sortedSections = useMemo(
    () => [...sections].sort((left, right) =>
      Number(right.active) - Number(left.active)
      || (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER)
      || left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })),
    [sections],
  )
  const activeSections = sortedSections.filter((section) => section.active)
  const inactiveSections = sortedSections.filter((section) => !section.active)

  if (!user) return null
  if (!canView) return <Navigate to="/no-access" replace />

  function beginEdit(field: EditableSectionField) {
    if (!selectedSection || !canEdit) return
    const adminDepartmentIds = availableDepartments.filter((department) => department.isAdminDepartment === true).map((department) => department._id)
    const selectedDepartmentIds = (selectedSection.departments || []).map((department) => department._id)
    const values: Record<EditableSectionField, EditDraft> = {
      name: selectedSection.name,
      description: selectedSection.description || '',
      sectionType: selectedSection.sectionType,
      sites: (selectedSection.sites || []).map((site) => site._id),
      departments: [...new Set([...selectedDepartmentIds, ...adminDepartmentIds])],
      active: selectedSection.active,
    }
    setEditDraft(values[field])
    setSaveError('')
    setEditField(field)
  }

  function toggleDraftId(id: string, checked: boolean) {
    setEditDraft((current) => {
      const ids = Array.isArray(current) ? current : []
      return checked ? [...new Set([...ids, id])] : ids.filter((entry) => entry !== id)
    })
  }

  async function saveField() {
    if (!selectedSection || !editField) return
    let input: AuditManagerSectionUpdate
    switch (editField) {
      case 'name': input = { name: String(editDraft) }; break
      case 'description': input = { description: String(editDraft) }; break
      case 'sectionType': input = { sectionType: editDraft as 'checklist' | 'order' }; break
      case 'sites': input = { sites: editDraft as string[] }; break
      case 'departments': input = { departments: editDraft as string[] }; break
      case 'active': input = { active: editDraft === true }; break
    }

    setSaving(true)
    setSaveError('')
    try {
      const result = await auditManagerService.updateSection(
        selectedSection._id,
        input,
        fieldLabels[editField],
      )
      let updatedSection = result.section
      setSections((current) => current.map((section) => section._id === result.section._id ? result.section : section))

      // Changing active status can renumber every section on the backend. Fetch
      // the canonical collection so all order badges and card positions update
      // without requiring a browser refresh or a socket connection.
      if (editField === 'active') {
        try {
          const refreshed = await auditManagerService.listSections()
          setSections(refreshed.sections)
          setAvailableSites(refreshed.options?.sites || [])
          setAvailableDepartments(refreshed.options?.departments || [])
          updatedSection = refreshed.sections.find((section) => section._id === result.section._id) || result.section
        } catch {
          toast.warning('Section status was updated, but the latest ordering could not be reloaded.')
        }
      }

      setSelectedSection(updatedSection)
      setEditField(null)
    } catch (requestError) {
      if (isApiError(requestError) && requestError.status === 403) {
        navigate({ to: '/no-access' })
        return
      }
      setSaveError(isApiError(requestError) ? requestError.message : 'Unable to update this section.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!canEdit || reordering || !event.over || event.active.id === event.over.id) return
    const oldIndex = activeSections.findIndex((section) => section._id === event.active.id)
    const newIndex = activeSections.findIndex((section) => section._id === event.over?.id)
    if (oldIndex < 0 || newIndex < 0) return

    const previousSections = sections
    const reordered = arrayMove(activeSections, oldIndex, newIndex)
      .map((section, sortOrder) => ({ ...section, sortOrder }))
    const reorderedById = new Map(reordered.map((section) => [section._id, section]))
    setSections((current) => current.map((section) => reorderedById.get(section._id) || section))
    setReordering(true)

    try {
      await auditManagerService.reorderSections(reordered.map((section) => section._id))
      toast.success('Section order updated')
    } catch (requestError) {
      setSections(previousSections)
      if (isApiError(requestError) && requestError.status === 403) {
        navigate({ to: '/no-access' })
        return
      }
      toast.error(isApiError(requestError) ? requestError.message : 'Unable to save the section order.')
    } finally {
      setReordering(false)
    }
  }

  function openCreateDialog() {
    const adminDepartmentIds = availableDepartments.filter((department) => department.isAdminDepartment === true).map((department) => department._id)
    setCreateDraft({ ...emptyCreateDraft, departments: adminDepartmentIds })
    setActionError('')
    setCreateOpen(true)
  }

  function toggleCreateSelection(field: 'sites' | 'departments', id: string, checked: boolean) {
    setCreateDraft((current) => ({
      ...current,
      [field]: checked
        ? [...new Set([...current[field], id])]
        : current[field].filter((entry) => entry !== id),
    }))
  }

  async function createSection() {
    setActionSaving(true)
    setActionError('')
    try {
      await auditManagerService.createSection(createDraft)
      const refreshed = await auditManagerService.listSections()
      setSections(refreshed.sections)
      setAvailableSites(refreshed.options?.sites || [])
      setAvailableDepartments(refreshed.options?.departments || [])
      setCreateOpen(false)
      toast.success('Section created')
    } catch (requestError) {
      if (isApiError(requestError) && requestError.status === 403) {
        navigate({ to: '/no-access' })
        return
      }
      setActionError(isApiError(requestError) ? requestError.message : 'Unable to create the section.')
    } finally {
      setActionSaving(false)
    }
  }

  async function addUniversalSite() {
    if (!universalSiteId) return
    setActionSaving(true)
    setActionError('')
    try {
      const result = await auditManagerService.addUniversalSite(universalSiteId)
      const refreshed = await auditManagerService.listSections()
      setSections(refreshed.sections)
      setAvailableSites(refreshed.options?.sites || [])
      setAvailableDepartments(refreshed.options?.departments || [])
      setConfirmUniversalSite(false)
      setUniversalSiteOpen(false)
      setUniversalSiteId('')
      toast.success(result.updatedSections === 0 ? 'Site was already assigned to every section' : `Site added to ${result.updatedSections} sections`)
    } catch (requestError) {
      if (isApiError(requestError) && requestError.status === 403) {
        navigate({ to: '/no-access' })
        return
      }
      setConfirmUniversalSite(false)
      setActionError(isApiError(requestError) ? requestError.message : 'Unable to add this site to all sections.')
    } finally {
      setActionSaving(false)
    }
  }

  async function addUniversalDepartment() {
    if (!universalDepartmentId) return
    setActionSaving(true)
    setActionError('')
    try {
      const result = await auditManagerService.addUniversalDepartment(universalDepartmentId)
      const refreshed = await auditManagerService.listSections()
      setSections(refreshed.sections)
      setAvailableSites(refreshed.options?.sites || [])
      setAvailableDepartments(refreshed.options?.departments || [])
      setConfirmUniversalDepartment(false)
      setUniversalDepartmentOpen(false)
      setUniversalDepartmentId('')
      toast.success(result.updatedSections === 0 ? 'Department was already assigned to every section' : `Department added to ${result.updatedSections} sections`)
    } catch (requestError) {
      if (isApiError(requestError) && requestError.status === 403) {
        navigate({ to: '/no-access' })
        return
      }
      setConfirmUniversalDepartment(false)
      setActionError(isApiError(requestError) ? requestError.message : 'Unable to add this department to all sections.')
    } finally {
      setActionSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-10 sm:px-5">
      <div className="mb-5 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-600 p-2.5 text-white"><ClipboardList className="h-6 w-6" /></div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Section Management</h1>
              <p className="mt-1 text-sm text-slate-600">Review section metadata, station coverage, and department visibility.</p>
            </div>
          </div>
          {(canAddSection || canAddAllSite || canAddAllDepartment) && (
            <div className="flex flex-col gap-2 sm:flex-row">
              {canAddSection && <Button type="button" onClick={openCreateDialog}><Plus className="mr-2 h-4 w-4" />Add section</Button>}
              {canAddAllSite && <Button type="button" variant="outline" onClick={() => { setActionError(''); setUniversalSiteOpen(true) }}>
                <MapPinned className="mr-2 h-4 w-4" />Add site to all
              </Button>}
              {canAddAllDepartment && <Button type="button" variant="outline" onClick={() => { setActionError(''); setUniversalDepartmentOpen(true) }}>
                <Building2 className="mr-2 h-4 w-4" />Assign department to all
              </Button>}
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex min-h-60 items-center justify-center rounded-2xl border border-dashed bg-white">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-600" /> Loading sections…
        </div>
      )}
      {!loading && error && <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">{error}</div>}
      {!loading && !error && sortedSections.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-slate-500">No Station Audit sections were found.</div>
      )}

      {!loading && !error && sortedSections.length > 0 && (
        <div className="space-y-5">
          {canEdit && activeSections.length > 1 && (
            <p className="text-xs text-slate-500">Drag active sections using the handle to update their display order.</p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
            <SortableContext items={activeSections.map((section) => section._id)} strategy={rectSortingStrategy}>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {activeSections.map((section) => (
                  <SortableSectionCard
                    key={section._id}
                    section={section}
                    canReorder={canEdit && !reordering}
                    onOpen={() => setSelectedSection(section)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {inactiveSections.length > 0 && (
            <div className="grid gap-4 border-t pt-5 sm:grid-cols-2 xl:grid-cols-3">
              {inactiveSections.map((section) => (
                <SectionCard key={section._id} section={section} onOpen={() => setSelectedSection(section)} />
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => { if (!actionSaving) setCreateOpen(open) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Add Station Audit section</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Section name</Label><Input value={createDraft.name} maxLength={200} onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))} /></div>
              <div className="space-y-2"><Label>Section type</Label><Select value={createDraft.sectionType} onValueChange={(value: 'checklist' | 'order') => setCreateDraft((current) => ({ ...current, sectionType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="checklist">Checklist</SelectItem><SelectItem value="order">Order</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={createDraft.description} maxLength={2000} onChange={(event) => setCreateDraft((current) => ({ ...current, description: event.target.value }))} /></div>
            <CreateMultiSelect
              label="Sites"
              options={availableSites.map((site) => ({ id: site._id, label: siteName(site) }))}
              selected={createDraft.sites}
              onToggle={(id, checked) => toggleCreateSelection('sites', id, checked)}
              onSelectAll={() => setCreateDraft((current) => ({ ...current, sites: availableSites.map((site) => site._id) }))}
              selectAllLabel="Select all stations"
            />
            <CreateMultiSelect label="Departments" options={availableDepartments.map((department) => ({ id: department._id, label: department.name, locked: department.isAdminDepartment === true }))} selected={createDraft.departments} onToggle={(id, checked) => toggleCreateSelection('departments', id, checked)} />
            <div className="space-y-2"><Label>Initial status</Label><Select value={createDraft.active ? 'active' : 'inactive'} onValueChange={(value) => setCreateDraft((current) => ({ ...current, active: value === 'active' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select><p className="text-xs text-slate-500">Active sections are automatically placed last in the current active order.</p></div>
            {actionError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</div>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" disabled={actionSaving} onClick={() => setCreateOpen(false)}>Cancel</Button><Button disabled={actionSaving || !createDraft.name.trim() || createDraft.sites.length === 0 || createDraft.departments.length === 0} onClick={() => void createSection()}>{actionSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Create section</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={universalSiteOpen} onOpenChange={(open) => { if (!actionSaving && !confirmUniversalSite) setUniversalSiteOpen(open) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Add a site to every section</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">Choose one store location. It will be added to active sections only without removing existing sites.</p>
          <RadioGroup value={universalSiteId} onValueChange={setUniversalSiteId} className="max-h-80 overflow-y-auto rounded-xl border p-3">
            {availableSites.map((site) => <label key={site._id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-slate-50"><RadioGroupItem value={site._id} /><span className="text-sm">{siteName(site)}</span></label>)}
          </RadioGroup>
          {actionError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</div>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" disabled={actionSaving} onClick={() => setUniversalSiteOpen(false)}>Cancel</Button><Button disabled={!universalSiteId || actionSaving} onClick={() => setConfirmUniversalSite(true)}>Review change</Button></div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmUniversalSite} onOpenChange={(open) => { if (!actionSaving) setConfirmUniversalSite(open) }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Add this site to all active sections?</AlertDialogTitle><AlertDialogDescription>This will update every active Station Audit section. Archived sections and existing site assignments will remain unchanged.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={actionSaving}>Go back</AlertDialogCancel><AlertDialogAction disabled={actionSaving} onClick={(event) => { event.preventDefault(); void addUniversalSite() }}>{actionSaving ? 'Updating…' : 'Confirm and update'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={universalDepartmentOpen} onOpenChange={(open) => { if (!actionSaving && !confirmUniversalDepartment) setUniversalDepartmentOpen(open) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Assign an admin department to every section</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">Only active departments marked as admin departments are available.</p>
          <RadioGroup value={universalDepartmentId} onValueChange={setUniversalDepartmentId} className="max-h-80 overflow-y-auto rounded-xl border p-3">
            {availableDepartments.filter((department) => department.isAdminDepartment === true).map((department) => (
              <label key={department._id} className="flex min-h-14 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
                <RadioGroupItem value={department._id} className="mt-1" />
                <span className="min-w-0"><span className="block text-sm font-semibold">{department.name}</span><span className="block text-xs text-slate-500">Head: {departmentHeadName(department)}</span></span>
              </label>
            ))}
            {availableDepartments.every((department) => department.isAdminDepartment !== true) && <p className="p-3 text-sm text-slate-500">No active admin departments are available.</p>}
          </RadioGroup>
          {actionError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</div>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" disabled={actionSaving} onClick={() => setUniversalDepartmentOpen(false)}>Cancel</Button><Button disabled={!universalDepartmentId || actionSaving} onClick={() => setConfirmUniversalDepartment(true)}>Review change</Button></div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmUniversalDepartment} onOpenChange={(open) => { if (!actionSaving) setConfirmUniversalDepartment(open) }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Assign this department to every section?</AlertDialogTitle><AlertDialogDescription>This will add the selected admin department to all active and archived Station Audit sections without removing any existing department assignments.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={actionSaving}>Go back</AlertDialogCancel><AlertDialogAction disabled={actionSaving} onClick={(event) => { event.preventDefault(); void addUniversalDepartment() }}>{actionSaving ? 'Updating…' : 'Confirm and update'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(selectedSection)} onOpenChange={(open) => { if (!open) setSelectedSection(null) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selectedSection && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-3 pr-7">
                  <DialogTitle className="text-xl">{selectedSection.name}</DialogTitle>
                  {canEdit && <EditButton label="Edit section name" onClick={() => beginEdit('name')} />}
                </div>
              </DialogHeader>
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetadataBlock label="Section type" onEdit={canEdit ? () => beginEdit('sectionType') : undefined}>
                    <Badge className="capitalize">{selectedSection.sectionType}</Badge>
                  </MetadataBlock>
                  <MetadataBlock label="Sort order">
                    <p className="text-sm text-slate-700">{selectedSection.sortOrder ?? 'Not ordered'}</p>
                  </MetadataBlock>
                  <MetadataBlock label="Status" onEdit={canEdit ? () => beginEdit('active') : undefined}>
                    <Badge variant={selectedSection.active ? 'secondary' : 'outline'}>{selectedSection.active ? 'Active' : 'Inactive'}</Badge>
                  </MetadataBlock>
                </div>

                <MetadataBlock label="Description" onEdit={canEdit ? () => beginEdit('description') : undefined}>
                  <p className="text-sm text-slate-700">{selectedSection.description || 'No description provided.'}</p>
                </MetadataBlock>

                <div className="grid gap-3 sm:grid-cols-2">
                  <MetadataBlock label="Checklist coverage">
                    <p className="text-sm text-slate-700">{selectedSection.activeChecklistCount} active of {selectedSection.checklistCount} total</p>
                  </MetadataBlock>
                  <MetadataBlock label="Last updated">
                    <p className="text-sm text-slate-700">{new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selectedSection.updatedAt))}</p>
                  </MetadataBlock>
                </div>

                <MetadataBlock label="Assigned departments" icon={Building2} onEdit={canEdit ? () => beginEdit('departments') : undefined}>
                  <div className="flex flex-wrap gap-2">
                    {selectedSection.departments?.length
                      ? selectedSection.departments.map((department) => <Badge key={department._id} variant="secondary">{department.name}</Badge>)
                      : <span className="text-sm text-amber-700">No departments assigned.</span>}
                  </div>
                </MetadataBlock>

                <MetadataBlock label="Available sites" icon={MapPin} onEdit={canEdit ? () => beginEdit('sites') : undefined}>
                  <div className="flex flex-wrap gap-2">
                    {selectedSection.sites?.length
                      ? selectedSection.sites.map((site) => <Badge key={site._id} variant="outline">{siteName(site)}</Badge>)
                      : <span className="text-sm text-amber-700">No sites assigned.</span>}
                  </div>
                </MetadataBlock>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editField)} onOpenChange={(open) => { if (!open && !saving) setEditField(null) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {editField && selectedSection && (
            <>
              <DialogHeader>
                <DialogTitle className="capitalize">Update {fieldLabels[editField]}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <SectionFieldEditor
                  field={editField}
                  draft={editDraft}
                  setDraft={setEditDraft}
                  availableSites={availableSites}
                  availableDepartments={availableDepartments}
                  toggleDraftId={toggleDraftId}
                />
                {saveError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{saveError}</div>}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={() => setEditField(null)} disabled={saving}>Cancel</Button>
                  <Button onClick={() => void saveField()} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {saving ? 'Updating…' : 'Update field'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClick} aria-label={label} title={label}>
      <Pencil className="h-3.5 w-3.5" />
      <span className="sr-only">{label}</span>
    </Button>
  )
}

function SortableSectionCard({ section, canReorder, onOpen }: { section: AuditManagerSection; canReorder: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section._id, disabled: !canReorder })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`relative ${isDragging ? 'z-20 opacity-80' : ''}`}>
      {canReorder && (
        <button
          type="button"
          className="absolute right-11 top-3 z-10 flex h-9 w-9 touch-none items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label={`Reorder ${section.name}`}
          title="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
      )}
      <SectionCard section={section} onOpen={onOpen} />
    </div>
  )
}

function SectionCard({ section, onOpen }: { section: AuditManagerSection; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="group h-full w-full text-left">
      <Card className={`h-full border-slate-200 transition-all group-hover:-translate-y-0.5 group-hover:border-emerald-300 group-hover:shadow-md ${section.active ? '' : 'bg-slate-50 opacity-60'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="pr-16 text-lg">{section.name}</CardTitle>
            {section.active
              ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              : <Archive className="h-5 w-5 shrink-0 text-slate-400" />}
          </div>
          {section.description && <p className="line-clamp-2 text-sm font-normal text-slate-500">{section.description}</p>}
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="capitalize">{section.sectionType}</Badge>
            {section.sortOrder !== null && <Badge variant="outline">Order {section.sortOrder}</Badge>}
            {!section.active && <Badge variant="outline">Archived</Badge>}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
            <div className="rounded-lg bg-slate-50 p-2"><strong className="block text-base text-slate-800">{section.checklistCount}</strong>Checklists</div>
            <div className="rounded-lg bg-slate-50 p-2"><strong className="block text-base text-slate-800">{section.sites?.length || 0}</strong>Sites</div>
            <div className="rounded-lg bg-slate-50 p-2"><strong className="block text-base text-slate-800">{section.departments?.length || 0}</strong>Departments</div>
          </div>
        </CardContent>
      </Card>
    </button>
  )
}

function MetadataBlock({ label, icon: Icon, onEdit, children }: { label: string; icon?: typeof Building2; onEdit?: () => void; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-slate-50/70 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {Icon && <Icon className="h-4 w-4 text-emerald-600" />}{label}
        </div>
        {onEdit && <EditButton label={`Edit ${label.toLowerCase()}`} onClick={onEdit} />}
      </div>
      {children}
    </div>
  )
}

function CreateMultiSelect({ label, options, selected, onToggle, onSelectAll, selectAllLabel = 'Select all' }: {
  label: string
  options: Array<{ id: string; label: string; locked?: boolean }>
  selected: string[]
  onToggle: (id: string, checked: boolean) => void
  onSelectAll?: () => void
  selectAllLabel?: string
}) {
  const allSelected = options.length > 0 && options.every((option) => selected.includes(option.id))
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        {onSelectAll && (
          <Button type="button" variant="ghost" size="sm" disabled={allSelected || options.length === 0} onClick={onSelectAll}>
            {allSelected ? 'All stations selected' : selectAllLabel}
          </Button>
        )}
      </div>
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border p-3">
        {options.map((option) => (
          <label key={option.id} className={`flex min-h-10 items-center gap-3 rounded-lg px-2 ${option.locked ? 'cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:bg-slate-50'}`}>
            <Checkbox checked={selected.includes(option.id)} disabled={option.locked} onCheckedChange={(value) => onToggle(option.id, value === true)} />
            <span className="text-sm">{option.label}{option.locked ? ' (required)' : ''}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-slate-500">{selected.length} selected</p>
    </div>
  )
}

function SectionFieldEditor({
  field,
  draft,
  setDraft,
  availableSites,
  availableDepartments,
  toggleDraftId,
}: {
  field: EditableSectionField
  draft: EditDraft
  setDraft: Dispatch<SetStateAction<EditDraft>>
  availableSites: AuditManagerSite[]
  availableDepartments: AuditManagerDepartmentSummary[]
  toggleDraftId: (id: string, checked: boolean) => void
}) {
  if (field === 'name') {
    return <Input value={String(draft)} onChange={(event) => setDraft(event.target.value)} maxLength={200} autoFocus />
  }
  if (field === 'description') {
    return <Textarea value={String(draft)} onChange={(event) => setDraft(event.target.value)} maxLength={2000} className="min-h-32 resize-y" autoFocus />
  }
  if (field === 'sectionType') {
    return (
      <Select value={String(draft)} onValueChange={(value) => setDraft(value)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="checklist">Checklist</SelectItem>
          <SelectItem value="order">Order</SelectItem>
        </SelectContent>
      </Select>
    )
  }
  if (field === 'active') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Inactive sections remain available for historical records but are hidden from active Station Audit workflows.</p>
        <Select value={draft === true ? 'active' : 'inactive'} onValueChange={(value) => setDraft(value === 'active')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
    )
  }

  const selectedIds = Array.isArray(draft) ? draft : []
  const options: Array<{ id: string; label: string; locked?: boolean }> = field === 'sites'
    ? availableSites.map((site) => ({ id: site._id, label: siteName(site) }))
    : availableDepartments.map((department) => ({
      id: department._id,
      label: department.name,
      locked: department.isAdminDepartment === true,
    }))

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Select at least one {field === 'sites' ? 'store location' : 'department'}.</p>
      <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border p-3">
        {options.map((option) => {
          const checked = selectedIds.includes(option.id)
          return (
            <label key={option.id} className={`flex min-h-11 items-center gap-3 rounded-lg px-2 ${option.locked ? 'cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:bg-slate-50'}`}>
              <Checkbox checked={checked} disabled={option.locked} onCheckedChange={(value) => toggleDraftId(option.id, value === true)} />
              <Label className={`font-normal ${option.locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>{option.label}{option.locked ? ' (required)' : ''}</Label>
            </label>
          )
        })}
        {options.length === 0 && <p className="p-3 text-center text-sm text-slate-500">No options are available.</p>}
      </div>
      <p className="text-xs text-slate-500">{selectedIds.length} selected</p>
    </div>
  )
}
