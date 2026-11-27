import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router'
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Info, ListChecks, Loader2, Pencil, Plus, Save, Search, SlidersHorizontal, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { auditManagerService } from '@/api/audit-manager/audit-manager.service'
import type { AuditManagerStatusOptionSet, AuditManagerStatusOptionSetCreate, AuditManagerStatusOptionSetField, AuditManagerStatusOptionSetUpdate, AuditManagerStatusOptionUsage } from '@/api/audit-manager/audit-manager.types'
import { isApiError } from '@/api/core/errors'
import { useAuth } from '@/context/AuthContext'
import { hasAuditManagerAccess, hasAuditManagerAction, hasAuditManagerNestedAction, hasAuditManagerPermission } from '@/lib/auditManagerPermissions'

export const Route = createFileRoute('/_navbarLayout/audit-manager/status-options')({ component: StatusOptionManagementPage })

type OptionRowDraft = { id: string; label: string }
type OptionDraft = OptionRowDraft[]
let nextOptionId = 0
const optionDraft = (label = ''): OptionRowDraft => ({ id: String(++nextOptionId), label })
type EditDraft = string | boolean | OptionDraft
const emptyCreate: AuditManagerStatusOptionSetCreate & { options: OptionDraft } = { name: '', description: '', options: [optionDraft()], active: true }

function StatusOptionManagementPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [sets, setSets] = useState<AuditManagerStatusOptionSet[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AuditManagerStatusOptionSet | null>(null)
  const [editField, setEditField] = useState<AuditManagerStatusOptionSetField | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft>('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createDraft, setCreateDraft] = useState(emptyCreate)
  const [usageSet, setUsageSet] = useState<AuditManagerStatusOptionSet | null>(null)
  const [usage, setUsage] = useState<AuditManagerStatusOptionUsage['checklists']>([])
  const [usageLoading, setUsageLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const canView = hasAuditManagerAccess(user?.access) && hasAuditManagerPermission(user?.access, 'statusOptions')
  const canEdit = hasAuditManagerAction(user?.access, 'statusOptions', 'edit')
  const canUpdateStatus = hasAuditManagerNestedAction(user?.access, 'statusOptions', 'edit', 'statusUpdate')
  const canAdd = hasAuditManagerAction(user?.access, 'statusOptions', 'add')

  useEffect(() => {
    if (!user || !canView) return
    let cancelled = false
    setLoading(true)
    auditManagerService.listStatusOptionSets()
      .then((result) => { if (!cancelled) setSets(result.statusOptionSets) })
      .catch((requestError) => {
        if (cancelled) return
        if (isApiError(requestError) && requestError.status === 403) return void navigate({ to: '/no-access' })
        setError('Unable to load status options. Please try again.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [canView, navigate, user])

  const filteredSets = useMemo(() => {
    const term = search.trim().toLowerCase()
    return [...sets]
      .filter((set) => !term || [set.name, set.description, ...set.options.flatMap((option) => [option.key, option.label])].some((value) => value.toLowerCase().includes(term)))
      .sort((left, right) => right.checklistCount - left.checklistCount || left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
  }, [search, sets])

  if (!user) return null
  if (!canView) return <Navigate to="/no-access" replace />

  function beginEdit(field: AuditManagerStatusOptionSetField) {
    if (!selected || !canEdit) return
    const values: Record<AuditManagerStatusOptionSetField, EditDraft> = { name: selected.name, description: selected.description || '', options: selected.options.map((option) => optionDraft(option.label)), active: selected.active }
    setEditDraft(values[field]); setSaveError(''); setEditField(field)
  }

  async function saveField() {
    if (!selected || !editField) return
    const input = { [editField]: Array.isArray(editDraft) ? editDraft.map(({ label }) => ({ label })) : editDraft } as AuditManagerStatusOptionSetUpdate
    setSaving(true); setSaveError('')
    try {
      const result = await auditManagerService.updateStatusOptionSet(selected._id, input, editField)
      setSets((current) => current.map((set) => set._id === result.statusOptionSet._id ? result.statusOptionSet : set))
      setSelected(result.statusOptionSet); setEditField(null); toast.success('Status options updated')
    } catch (requestError) {
      if (isApiError(requestError) && requestError.status === 403) return void navigate({ to: '/no-access' })
      setSaveError(isApiError(requestError) ? requestError.message : 'Unable to update these status options.')
    } finally { setSaving(false) }
  }

  async function createSet() {
    setSaving(true); setSaveError('')
    try {
      const result = await auditManagerService.createStatusOptionSet({ ...createDraft, options: createDraft.options.map(({ label }) => ({ label })) })
      setSets((current) => [...current, result.statusOptionSet]); setCreateOpen(false); setCreateDraft(emptyCreate); toast.success('Status-option set created')
    } catch (requestError) {
      if (isApiError(requestError) && requestError.status === 403) return void navigate({ to: '/no-access' })
      setSaveError(isApiError(requestError) ? requestError.message : 'Unable to create this status-option set.')
    } finally { setSaving(false) }
  }

  async function openUsage(set: AuditManagerStatusOptionSet) {
    setUsageSet(set); setUsage([]); setUsageLoading(true)
    try { setUsage((await auditManagerService.statusOptionUsage(set._id)).checklists) }
    catch { toast.error('Unable to load checklist usage') }
    finally { setUsageLoading(false) }
  }

  return <div className="mx-auto w-full max-w-6xl px-3 pb-10 sm:px-5">
    <div className="mb-5 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-slate-50 p-4 shadow-sm sm:p-6"><div className="flex items-start gap-3"><div className="rounded-xl bg-violet-600 p-2.5 text-white"><SlidersHorizontal className="h-6 w-6" /></div><div><h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Status Option Management</h1><p className="mt-1 text-sm text-slate-600">Create and maintain reusable checklist status selections.</p></div></div><div className="mt-5 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" value={search} placeholder="Search name, description, labels, or keys…" onChange={(event) => setSearch(event.target.value)} /></div>{canAdd && <Button onClick={() => { setCreateDraft(emptyCreate); setSaveError(''); setCreateOpen(true) }}><Plus className="mr-2 h-4 w-4" />Create options</Button>}</div></div>
    {loading && <div className="flex min-h-60 items-center justify-center rounded-2xl border border-dashed bg-white"><Loader2 className="mr-2 h-5 w-5 animate-spin text-violet-600" />Loading status options…</div>}
    {!loading && error && <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">{error}</div>}
    {!loading && !error && filteredSets.length === 0 && <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-slate-500">No status options match your search.</div>}
    {!loading && !error && filteredSets.length > 0 && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filteredSets.map((set) => <StatusOptionCard key={set._id} set={set} onOpen={() => setSelected(set)} onUsage={() => void openUsage(set)} />)}</div>}

    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open && !editField) setSelected(null) }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">{selected && <><DialogHeader><div className="flex items-center justify-between gap-3 pr-7"><div className="flex min-w-0 items-center gap-1"><DialogTitle>{selected.name}</DialogTitle><StatusOptionHelp field="name" /></div>{canEdit && <EditButton label="Edit status-option name" onClick={() => beginEdit('name')} />}</div></DialogHeader><div className="space-y-4"><Metadata label="Description" field="description" onEdit={canEdit ? () => beginEdit('description') : undefined}><p className="text-sm text-slate-700">{selected.description || 'No description provided.'}</p></Metadata><Metadata label={`Options (${selected.options.length})`} field="options" onEdit={canEdit ? () => beginEdit('options') : undefined}><div className="flex flex-wrap gap-2">{selected.options.map((option) => <Badge key={option.key} variant="secondary">{option.label}</Badge>)}</div></Metadata><Metadata label="Status" field="active" onEdit={canEdit && canUpdateStatus ? () => beginEdit('active') : undefined}><Badge variant={selected.active ? 'secondary' : 'outline'}>{selected.active ? 'Active' : 'Inactive'}</Badge></Metadata><div className="grid gap-3 sm:grid-cols-2"><Metadata label="Created"><p className="text-sm">{formatDate(selected.createdAt)}</p></Metadata><Metadata label="Last updated"><p className="text-sm">{formatDate(selected.updatedAt)}</p></Metadata></div></div></>}</DialogContent></Dialog>

    <Dialog open={Boolean(editField)} onOpenChange={(open) => { if (!open && !saving) setEditField(null) }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">{editField && <><DialogHeader><DialogTitle className="capitalize">Update {editField === 'options' ? 'status options' : editField}</DialogTitle></DialogHeader><StatusOptionField field={editField} draft={editDraft} setDraft={setEditDraft} inUse={Boolean(selected?.checklistCount)} />{saveError && <ErrorMessage message={saveError} />}<DialogActions saving={saving} onCancel={() => setEditField(null)} onSave={() => void saveField()} label="Update field" disabled={editField === 'active' && editDraft === false && Boolean(selected?.checklistCount)} /></>}</DialogContent></Dialog>

    <Dialog open={createOpen} onOpenChange={(open) => { if (!saving) setCreateOpen(open) }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Create status-option set</DialogTitle></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Name</Label><Input value={createDraft.name} maxLength={200} onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))} /></div><div className="space-y-2"><Label>Description</Label><Textarea value={createDraft.description} maxLength={2000} onChange={(event) => setCreateDraft((current) => ({ ...current, description: event.target.value }))} /></div><div className="space-y-2"><Label>Options</Label><OptionRows value={createDraft.options} onChange={(options) => setCreateDraft((current) => ({ ...current, options }))} /></div>{saveError && <ErrorMessage message={saveError} />}<DialogActions saving={saving} onCancel={() => setCreateOpen(false)} onSave={() => void createSet()} label="Create options" disabled={!createDraft.name.trim() || createDraft.options.some((option) => !option.label.trim())} /></div></DialogContent></Dialog>

    <Dialog open={Boolean(usageSet)} onOpenChange={(open) => { if (!open) setUsageSet(null) }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Checklists using {usageSet?.name}</DialogTitle></DialogHeader>{usageLoading ? <div className="flex min-h-32 items-center justify-center"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading usage…</div> : usage.length ? <div className="space-y-2">{usage.map((checklist) => <div key={checklist._id} className={`rounded-xl border p-3 ${checklist.active ? '' : 'bg-slate-50 opacity-60'}`}><p className="font-medium">{checklist.section?.name || 'Unknown section'} <span className="text-slate-400">—</span> {checklist.item}</p>{checklist.description && <p className="mt-1 text-sm text-slate-500">{checklist.description}</p>}</div>)}</div> : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">No checklists use this option set.</p>}</DialogContent></Dialog>
  </div>
}

function StatusOptionCard({ set, onOpen, onUsage }: { set: AuditManagerStatusOptionSet; onOpen: () => void; onUsage: () => void }) {
  const description = set.description.length > 15 ? `${set.description.slice(0, 15)}...` : set.description
  return <Card className={`h-full border-slate-200 ${set.active ? '' : 'bg-slate-50 opacity-60'}`}><button type="button" onClick={onOpen} className="group w-full text-left"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><CardTitle className="text-lg">{set.name}</CardTitle><Badge className="shrink-0" variant={set.active ? 'secondary' : 'outline'}>{set.active ? 'Active' : 'Inactive'}</Badge></div>{description && <p className="text-sm font-normal text-slate-500" title={set.description}>{description}</p>}</CardHeader></button><CardContent className="grid grid-cols-2 gap-2 pt-0"><div className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500"><strong className="block text-lg text-slate-800">{set.options.length}</strong>Options</div><button type="button" onClick={onUsage} className="rounded-lg bg-violet-50 p-3 text-center text-xs text-violet-700 transition hover:bg-violet-100"><strong className="block text-lg text-violet-900">{set.checklistCount}</strong><span className="inline-flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" />Checklists</span></button></CardContent></Card>
}

function StatusOptionField({ field, draft, setDraft, inUse }: { field: AuditManagerStatusOptionSetField; draft: EditDraft; setDraft: Dispatch<SetStateAction<EditDraft>>; inUse: boolean }) {
  if (field === 'name') return <Input value={String(draft)} maxLength={200} onChange={(event) => setDraft(event.target.value)} />
  if (field === 'description') return <Textarea className="min-h-32" value={String(draft)} maxLength={2000} onChange={(event) => setDraft(event.target.value)} />
  if (field === 'options') return <OptionRows value={draft as OptionDraft} onChange={setDraft} />
  return <div className="space-y-2">
    <Select value={draft === true ? 'active' : 'inactive'} onValueChange={(value) => setDraft(value === 'active')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive" disabled={inUse}>Inactive</SelectItem></SelectContent></Select>
    {inUse && <p className="text-sm text-slate-600">Reassign the checklists using this set before deactivating it.</p>}
  </div>
}

function OptionRows({ value, onChange }: { value: OptionDraft; onChange: (value: OptionDraft) => void }) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return
    const oldIndex = value.findIndex((option) => option.id === event.active.id)
    const newIndex = value.findIndex((option) => option.id === event.over?.id)
    if (oldIndex < 0 || newIndex < 0) return
    onChange(arrayMove(value, oldIndex, newIndex))
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Drag the handle to reorder an option. Save to apply the new order.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={value.map(({ id }) => id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {value.map((option, index) => (
              <SortableOptionRow
                key={option.id}
                option={option}
                index={index}
                canRemove={value.length > 1}
                onLabelChange={(label) => onChange(value.map((row) => row.id === option.id ? { ...row, label } : row))}
                onRemove={() => onChange(value.filter((row) => row.id !== option.id))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, optionDraft()])}>
        <Plus className="mr-2 h-4 w-4" />Add option
      </Button>
    </div>
  )
}

function SortableOptionRow({ option, index, canRemove, onLabelChange, onRemove }: { option: OptionRowDraft; index: number; canRemove: boolean; onLabelChange: (label: string) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: option.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative grid grid-cols-[auto_1fr_auto] items-end gap-2 rounded-xl border bg-white p-3 ${isDragging ? 'z-20 border-violet-400 shadow-lg ring-2 ring-violet-200' : 'border-slate-200'}`}>
      <button ref={setActivatorNodeRef} type="button"
        className="mb-1 flex h-9 w-8 cursor-grab touch-none items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 active:cursor-grabbing"
        aria-label={`Reorder option ${index + 1}`} {...attributes} {...listeners}>
        <GripVertical className="h-5 w-5" />
      </button>
      <div>
        <Label className="text-xs">Option {index + 1}</Label>
        <Input value={option.label} placeholder={`Option ${index + 1}`} maxLength={200} onChange={(event) => onLabelChange(event.target.value)} />
      </div>
      <Button type="button" variant="ghost" size="icon" className="mb-1" disabled={!canRemove} aria-label={`Remove option ${index + 1}`} onClick={onRemove}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

const statusOptionHelp = {
  name: { label: 'option set name', description: 'This is the name managers see when choosing a set for a checklist. Renaming the set updates that label and keeps its checklist links and answer choices.' },
  description: { label: 'description', description: 'Use this to explain when managers should choose this set. Editing the description changes the guidance in Audit Manager. Linked checklists keep the same answer choices.' },
  options: { label: 'answer options', description: 'These are the answers auditors can select. Adding, renaming, removing, or reordering options changes the choices for future submissions on every linked checklist. Past submissions keep the answer that was recorded.' },
  active: { label: 'status', description: 'Active sets are available to assign to checklists. To deactivate a set, first switch every linked checklist to another set, including inactive checklists.' },
} satisfies Record<AuditManagerStatusOptionSetField, { label: string; description: string }>

function StatusOptionHelp({ field }: { field: AuditManagerStatusOptionSetField }) {
  const { label, description } = statusOptionHelp[field]
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" aria-label={`About ${label}`} className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-violet-600">
          <Info className="size-4" aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>About {label}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}

function Metadata({ label, field, children, onEdit }: { label: string; field?: AuditManagerStatusOptionSetField; children: ReactNode; onEdit?: () => void }) {
  return (
    <div className="rounded-xl border bg-slate-50/70 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-sm font-semibold">
          {label}
          {field && <StatusOptionHelp field={field} />}
        </span>
        {onEdit && <EditButton label={`Edit ${label}`} onClick={onEdit} />}
      </div>
      {children}
    </div>
  )
}
function EditButton({ label, onClick }: { label: string; onClick: () => void }) { return <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={label} title={label} onClick={onClick}><Pencil className="h-3.5 w-3.5" /></Button> }
function DialogActions({ saving, onCancel, onSave, label, disabled = false }: { saving: boolean; onCancel: () => void; onSave: () => void; label: string; disabled?: boolean }) { return <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" disabled={saving} onClick={onCancel}>Cancel</Button><Button disabled={saving || disabled} onClick={onSave}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{label}</Button></div> }
function ErrorMessage({ message }: { message: string }) { return <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</div> }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
