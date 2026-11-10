import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Archive,
  CheckCircle2,
  ClipboardCheck,
  GripVertical,
  Info,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Save,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { auditManagerService } from "@/api/audit-manager/audit-manager.service";
import type {
  AuditManagerChecklistDetail,
  AuditManagerChecklistCreate,
  AuditManagerChecklistEditOptions,
  AuditManagerChecklistStatusCreate,
  AuditManagerChecklistUpdate,
  AuditManagerChecklistUpdateField,
  AuditManagerSection,
  AuditManagerUserSummary,
} from "@/api/audit-manager/audit-manager.types";
import { isApiError } from "@/api/core/errors";
import { useAuth } from "@/context/AuthContext";
import {
  hasAuditManagerAccess,
  hasAuditManagerAction,
  hasAuditManagerNestedAction,
  hasAuditManagerPermission,
} from "@/lib/auditManagerPermissions";

export const Route = createFileRoute(
  "/_navbarLayout/audit-manager/checklist/$sectionId",
)({ component: ChecklistSectionPage });
type Draft = string | boolean | string[] | { enabled: boolean; vendor: string };
const CHECKLIST_FREQUENCIES = ["daily", "weekly", "monthly"] as const;

const emptyChecklistCreate = (): AuditManagerChecklistCreate => ({
  item: "",
  description: "",
  category: "",
  frequency: "daily",
  auditTypes: ["store", "visitor"],
  department: "",
  statusOptionSet: "",
  followUp: false,
  commentRequired: false,
  assignedSites: [],
  orderConfiguration: { enabled: false, vendor: "" },
  active: true,
});

function ChecklistSectionPage() {
  const { sectionId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<AuditManagerSection | null>(null);
  const [checklists, setChecklists] = useState<AuditManagerChecklistDetail[]>(
    [],
  );
  const [options, setOptions] =
    useState<AuditManagerChecklistEditOptions | null>(null);
  const [selected, setSelected] = useState<AuditManagerChecklistDetail | null>(
    null,
  );
  const [editField, setEditField] =
    useState<AuditManagerChecklistUpdateField | null>(null);
  const [draft, setDraft] = useState<Draft>("");
  const [statusDialog, setStatusDialog] = useState(false);
  const [statusDialogTarget, setStatusDialogTarget] = useState<"edit" | "create">("edit");
  const [departmentDialogTarget, setDepartmentDialogTarget] = useState<"edit" | "create" | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [statusSearch, setStatusSearch] = useState("");
  const [selectedStatusId, setSelectedStatusId] = useState("");
  const [createStatusOpen, setCreateStatusOpen] = useState(false);
  const [statusCreate, setStatusCreate] =
    useState<AuditManagerChecklistStatusCreate>({
      name: "",
      description: "",
      options: [{ label: "" }],
    });
  const [visibilityHelp, setVisibilityHelp] = useState(false);
  const [checklistSearch, setChecklistSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<AuditManagerChecklistCreate>(emptyChecklistCreate);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canView =
    hasAuditManagerAccess(user?.access) &&
    hasAuditManagerPermission(user?.access, "checklist");
  const canEdit = hasAuditManagerAction(user?.access, "checklist", "edit");
  const canAdd = hasAuditManagerAction(user?.access, "checklist", "add");
  const canUpdateActiveStatus = hasAuditManagerNestedAction(
    user?.access,
    "checklist",
    "edit",
    "updateActiveStatus",
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (!user || !canView) return;
    let cancelled = false;
    auditManagerService
      .checklistSection(sectionId)
      .then((result) => {
        if (!cancelled) {
          setSection(result.section);
          setChecklists(result.checklists);
        }
      })
      .catch((requestError) => {
        if (cancelled) return;
        if (isApiError(requestError) && requestError.status === 403)
          return void navigate({ to: "/no-access" });
        setError(
          isApiError(requestError) && requestError.status === 404
            ? "This section is not available to your departments."
            : "Unable to load checklist metadata.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canView, navigate, sectionId, user]);

  useEffect(() => {
    if (!canEdit && !canAdd) return;
    auditManagerService
      .checklistEditOptions(sectionId, canEdit ? "auditManager.checklist.edit" : "auditManager.checklist.add")
      .then(setOptions)
      .catch(() => undefined);
  }, [canAdd, canEdit, sectionId]);

  const sorted = useMemo(
    () =>
      [...checklists].sort(
        (a, b) =>
          Number(b.active) - Number(a.active) ||
          CHECKLIST_FREQUENCIES.indexOf(a.frequency) - CHECKLIST_FREQUENCIES.indexOf(b.frequency) ||
          (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
            (b.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
          a.item.localeCompare(b.item),
      ),
    [checklists],
  );
  const activeCount = sorted.filter((item) => item.active).length;
  const normalizedSearch = checklistSearch.trim().toLowerCase();
  const displayed = normalizedSearch
    ? sorted.filter((item) => item.item.toLowerCase().includes(normalizedSearch))
    : sorted;
  const displayedByFrequency = CHECKLIST_FREQUENCIES.map((frequency) => ({
    frequency,
    checklists: displayed.filter((item) => item.active && item.frequency === frequency),
  }));
  const displayedInactive = displayed.filter((item) => !item.active);
  const canReorder = canEdit && !reordering && !normalizedSearch;

  if (!user) return null;
  if (!canView) return <Navigate to="/no-access" replace />;

  function beginEdit(field: AuditManagerChecklistUpdateField, value?: boolean) {
    if (!selected || (field === "active" ? !canUpdateActiveStatus : !canEdit)) return;
    if ((field === "followUp" || field === "commentRequired") && typeof value === "boolean") {
      void updateChecklist(field, value);
      return;
    }
    if (field === "statusOptionSet") {
      setStatusDialogTarget("edit");
      setSelectedStatusId(selected.statusOptionSet?._id || "");
      setStatusSearch("");
      setSaveError("");
      setStatusDialog(true);
      return;
    }
    if (field === "department") {
      setSelectedDepartmentId(selected.department?._id || "");
      setSaveError("");
      setDepartmentDialogTarget("edit");
      return;
    }
    const values: Record<
      Exclude<AuditManagerChecklistUpdateField, "statusOptionSet">,
      Draft
    > = {
      item: selected.item,
      description: selected.description || "",
      category: selected.category || "",
      frequency: selected.frequency,
      auditTypes: selected.auditTypes,
      department: selected.department?._id || "",
      followUp: selected.followUp,
      commentRequired: selected.commentRequired,
      assignedSites: selected.assignedSites.map((site) => site._id),
      orderConfiguration: {
        enabled: selected.requestOrderEnabled,
        vendor: selected.suppliesVendor || "",
      },
      active: selected.active,
    };
    setDraft(values[field]);
    setSaveError("");
    setEditField(field);
  }

  async function updateChecklist(
    field: AuditManagerChecklistUpdateField,
    value: Draft,
  ) {
    if (!selected) return;
    const input = { [field]: value } as AuditManagerChecklistUpdate;
    setSaving(true);
    setSaveError("");
    try {
      const result = await auditManagerService.updateChecklist(
        sectionId,
        selected._id,
        input,
        field,
      );
      setChecklists((current) =>
        current.map((item) =>
          item._id === result.checklist._id ? result.checklist : item,
        ),
      );
      setSelected(result.checklist);
      setEditField(null);
      setStatusDialog(false);
      setDepartmentDialogTarget(null);
      toast.success("Checklist updated");
      if (field === "active" || field === "frequency") {
        const refreshed = await auditManagerService.checklistSection(sectionId);
        setChecklists(refreshed.checklists);
        setSelected(
          refreshed.checklists.find((item) => item._id === selected._id) ||
            result.checklist,
        );
      }
    } catch (requestError) {
      if (isApiError(requestError) && requestError.status === 403)
        return void navigate({ to: "/no-access" });
      setSaveError(
        isApiError(requestError)
          ? requestError.message
          : "Unable to update this checklist.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (
      !canEdit ||
      reordering ||
      !event.over ||
      event.active.id === event.over.id
    )
      return;
    const dragged = checklists.find((item) => item._id === event.active.id);
    if (!dragged?.active) return;
    const frequencyActive = sorted.filter(
      (item) => item.active && item.frequency === dragged.frequency,
    );
    const oldIndex = frequencyActive.findIndex((item) => item._id === event.active.id);
    const newIndex = frequencyActive.findIndex((item) => item._id === event.over?.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const previous = checklists;
    const reordered = arrayMove(frequencyActive, oldIndex, newIndex).map(
      (item, sortOrder) => ({ ...item, sortOrder }),
    );
    const byId = new Map(reordered.map((item) => [item._id, item]));
    setChecklists((current) =>
      current.map((item) => byId.get(item._id) || item),
    );
    setReordering(true);
    try {
      await auditManagerService.reorderChecklists(
        sectionId,
        dragged.frequency,
        reordered.map((item) => item._id),
      );
      toast.success("Checklist order updated");
    } catch (requestError) {
      setChecklists(previous);
      toast.error(
        isApiError(requestError)
          ? requestError.message
          : "Unable to reorder checklists.",
      );
    } finally {
      setReordering(false);
    }
  }

  async function createStatusOptions() {
    if (statusDialogTarget === "edit" && !selected) return;
    setSaving(true);
    setSaveError("");
    try {
      if (statusDialogTarget === "create") {
        const result = await auditManagerService.createChecklistStatusOptionSet(sectionId, statusCreate);
        setOptions((current) => current ? {
          ...current,
          statusOptionSets: [...current.statusOptionSets, { ...result.statusOptionSet, checklistCount: 0 }]
            .sort((left, right) => left.name.localeCompare(right.name)),
        } : current);
        setCreateDraft((current) => ({ ...current, statusOptionSet: result.statusOptionSet._id }));
        setSelectedStatusId(result.statusOptionSet._id);
        setCreateStatusOpen(false);
        setStatusDialog(false);
        setStatusCreate({ name: "", description: "", options: [{ label: "" }] });
        toast.success("Status options created and selected");
        return;
      }
      const result = await auditManagerService.createChecklistStatusOptions(
        sectionId,
        selected!._id,
        statusCreate,
      );
      setChecklists((current) =>
        current.map((item) =>
          item._id === result.checklist._id ? result.checklist : item,
        ),
      );
      setSelected(result.checklist);
      setCreateStatusOpen(false);
      setStatusDialog(false);
      setStatusCreate({ name: "", description: "", options: [{ label: "" }] });
      toast.success("Status options created and assigned");
      setOptions(await auditManagerService.checklistEditOptions(sectionId, "auditManager.checklist.edit"));
    } catch (requestError) {
      setSaveError(
        isApiError(requestError)
          ? requestError.message
          : "Unable to create status options.",
      );
    } finally {
      setSaving(false);
    }
  }

  function openCreateChecklist() {
    const next = emptyChecklistCreate();
    setCreateDraft(next);
    setSaveError("");
    setCreateOpen(true);
  }

  async function createChecklist() {
    setSaving(true);
    setSaveError("");
    try {
      const result = await auditManagerService.createChecklist(sectionId, createDraft);
      setChecklists((current) => [...current, result.checklist]);
      setCreateOpen(false);
      setCreateDraft(emptyChecklistCreate());
      toast.success("Checklist created");
    } catch (requestError) {
      const message = isApiError(requestError)
        ? requestError.message
        : "Unable to create this checklist.";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }

  const matchingStatuses = (options?.statusOptionSets || []).filter((set) => {
    const term = statusSearch.trim().toLowerCase();
    return (
      !term ||
      [
        set.name,
        set.description,
        ...set.options.map((option) => option.label),
      ].some((value) => value.toLowerCase().includes(term))
    );
  });
  const selectedStatus = options?.statusOptionSets.find(
    (set) => set._id === selectedStatusId,
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-10 sm:px-5">
      <div className="mb-5 rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-4 shadow-sm sm:p-6">
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2"
          onClick={() => navigate({ to: "/audit-manager/checklist" })}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          All sections
        </Button>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-cyan-600 p-2.5 text-white">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">
                {section?.name || "Checklist metadata"}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {section?.description ||
                  "Review active and inactive checklist definitions."}
              </p>
            </div>
          </div>
          {!loading && !error && (
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <div className="relative w-full lg:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={checklistSearch} onChange={(event) => setChecklistSearch(event.target.value)} placeholder="Search checklist names…" className="bg-white pl-9" />
              </div>
              {canAdd && (
                <Button onClick={openCreateChecklist} disabled={!options} className="shrink-0">
                  <Plus className="mr-2 h-4 w-4" />
                  Add new
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      {loading && <Loading />}
      {!loading && error && <ErrorBox message={error} />}
      {!loading && !error && sorted.length === 0 && (
        <Empty message="No checklists exist in this section." />
      )}
      {!loading && !error && sorted.length > 0 && displayed.length === 0 && (
        <Empty message="No checklist names match your search." />
      )}
      {!loading && !error && displayed.length > 0 && (
        <div className="space-y-5">
          {canEdit && !normalizedSearch && activeCount > 1 && (
            <p className="text-xs text-slate-500">
              Drag active checklists within their frequency section to update that frequency's order.
            </p>
          )}
          {displayedByFrequency.map(({ frequency, checklists: frequencyChecklists }) => (
            <section key={frequency} className="space-y-3 border-t pt-5 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{formatFrequency(frequency)}</h2><Badge variant="outline">{frequencyChecklists.length}</Badge></div>
              {frequencyChecklists.length ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
                  <SortableContext items={frequencyChecklists.map((item) => item._id)} strategy={rectSortingStrategy}>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {frequencyChecklists.map((item) => <SortableChecklistCard key={item._id} checklist={item} canReorder={canReorder && frequencyChecklists.length > 1} onOpen={() => setSelected(item)} />)}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : <p className="rounded-xl border border-dashed p-4 text-sm text-slate-500">No {frequency} checklists.</p>}
            </section>
          ))}
          <section className="space-y-3 border-t pt-5">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Inactive</h2><Badge variant="outline">{displayedInactive.length}</Badge></div>
            {displayedInactive.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{displayedInactive.map((item) => <ChecklistCard key={item._id} checklist={item} onOpen={() => setSelected(item)} />)}</div> : <p className="rounded-xl border border-dashed p-4 text-sm text-slate-500">No inactive checklists.</p>}
          </section>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => { if (!saving) setCreateOpen(open); }}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Add new checklist</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Checklist name">
                <Input value={createDraft.item} onChange={(event) => setCreateDraft((current) => ({ ...current, item: event.target.value }))} placeholder="Enter checklist name" />
              </Field>
              <Field label="Frequency">
                <SimpleSelect value={createDraft.frequency} values={["daily", "weekly", "monthly"]} onChange={(frequency) => setCreateDraft((current) => ({ ...current, frequency: frequency as AuditManagerChecklistCreate["frequency"] }))} />
              </Field>
            </div>
            <Field label="Description">
              <Textarea value={createDraft.description} onChange={(event) => setCreateDraft((current) => ({ ...current, description: event.target.value }))} />
            </Field>
            <Field label="Category">
              <Input value={createDraft.category} placeholder="Choose or create a category" onChange={(event) => setCreateDraft((current) => ({ ...current, category: event.target.value }))} />
              <div className="flex flex-wrap gap-2">
                {(options?.categories || []).filter((category) => category.toLowerCase().includes(createDraft.category.toLowerCase())).map((category) => (
                  <Button key={category} type="button" variant="outline" size="sm" onClick={() => setCreateDraft((current) => ({ ...current, category }))}>{category}</Button>
                ))}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Assigned department">
                <Button type="button" variant="outline" className={`w-full justify-start ${!createDraft.department ? "border-red-400 bg-red-50 text-red-700 hover:bg-red-50" : ""}`} onClick={() => { setSelectedDepartmentId(createDraft.department); setDepartmentDialogTarget("create"); }}>
                  {options?.departments.find((department) => department._id === createDraft.department)?.name || "Select department"}
                </Button>
                {!createDraft.department && <p className="text-xs text-red-600">Select an assigned department before creating the checklist.</p>}
              </Field>
              <Field label="Status options">
                <Button type="button" variant="outline" className={`w-full justify-start ${!createDraft.statusOptionSet ? "border-red-400 bg-red-50 text-red-700 hover:bg-red-50" : ""}`} onClick={() => { setStatusDialogTarget("create"); setSelectedStatusId(createDraft.statusOptionSet); setStatusSearch(""); setSaveError(""); setStatusDialog(true); }}>
                  {options?.statusOptionSets.find((set) => set._id === createDraft.statusOptionSet)?.name || "Select status options"}
                </Button>
                {!createDraft.statusOptionSet && <p className="text-xs text-red-600">Select status options before creating the checklist.</p>}
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Checklist visibility">
                <CheckboxList values={[{ id: "store", label: "Store audit" }, { id: "visitor", label: "Visitor audit" }]} selected={createDraft.auditTypes} onChange={(auditTypes) => setCreateDraft((current) => ({ ...current, auditTypes: auditTypes as AuditManagerChecklistCreate["auditTypes"] }))} />
              </Field>
              <Field label={`Assigned sites (${createDraft.assignedSites.length})`}>
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  const allSiteIds = (options?.sites || []).map((site) => site._id);
                  const allSelected = allSiteIds.length > 0 && allSiteIds.every((siteId) => createDraft.assignedSites.includes(siteId));
                  setCreateDraft((current) => ({ ...current, assignedSites: allSelected ? [] : allSiteIds }));
                }} disabled={!options?.sites.length}>
                  {(options?.sites || []).length > 0 && options!.sites.every((site) => createDraft.assignedSites.includes(site._id)) ? "Clear all sites" : "Select all sites"}
                </Button>
                <CheckboxList values={(options?.sites || []).map((site) => ({ id: site._id, label: site.site || site.stationName }))} selected={createDraft.assignedSites} onChange={(assignedSites) => setCreateDraft((current) => ({ ...current, assignedSites }))} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <BooleanToggleMeta label="Follow-up required" checked={createDraft.followUp} disabled={saving} onChange={(followUp) => setCreateDraft((current) => ({ ...current, followUp }))} />
              <BooleanToggleMeta label="Comment required" checked={createDraft.commentRequired} disabled={saving} onChange={(commentRequired) => setCreateDraft((current) => ({ ...current, commentRequired }))} />
            </div>
            {section?.sectionType === "order" && (
              <Field label="Order creation">
                <SimpleSelect value={createDraft.orderConfiguration.enabled ? "yes" : "no"} entries={[["yes", "Create an order"], ["no", "Do not create an order"]]} onChange={(value) => setCreateDraft((current) => ({ ...current, orderConfiguration: { ...current.orderConfiguration, enabled: value === "yes", vendor: value === "yes" ? current.orderConfiguration.vendor : "" } }))} />
                {createDraft.orderConfiguration.enabled && <SimpleSelect value={createDraft.orderConfiguration.vendor} entries={(options?.vendors || []).map((vendor) => [vendor, vendor])} placeholder="Select Station Supplies vendor" onChange={(vendor) => setCreateDraft((current) => ({ ...current, orderConfiguration: { enabled: true, vendor } }))} />}
              </Field>
            )}
            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold">Active status</p><p className="text-xs text-slate-500">{createDraft.active ? "Active" : "Inactive"}</p></div><Switch checked={createDraft.active} disabled={saving} onCheckedChange={(active) => setCreateDraft((current) => ({ ...current, active }))} /></div>
              {createDraft.active && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Creating this checklist as active will make it directly visible to stores on their live audit page.</p>}
            </div>
            {saveError && <ErrorBox message={saveError} />}
            <Actions saving={saving} disabled={!createDraft.item.trim() || !createDraft.department || !createDraft.statusOptionSet || createDraft.auditTypes.length === 0 || (section?.sectionType === "order" && createDraft.orderConfiguration.enabled && !createDraft.orderConfiguration.vendor)} onCancel={() => setCreateOpen(false)} onSave={() => void createChecklist()} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={departmentDialogTarget !== null} onOpenChange={(open) => { if (!open && !saving) setDepartmentDialogTarget(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Select assigned department</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">Only departments assigned to this section are available.</p>
          <RadioGroup value={selectedDepartmentId} onValueChange={setSelectedDepartmentId} className="max-h-[30rem] overflow-y-auto pr-1">
            {(options?.departments || []).map((department) => (
              <label key={department._id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${selectedDepartmentId === department._id ? "border-cyan-500 bg-cyan-50" : "hover:bg-slate-50"}`}>
                <RadioGroupItem value={department._id} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-900">{department.name}</h3>
                  <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <div><span className="text-xs font-medium uppercase tracking-wide text-slate-500">Department head</span><p>{formatAuditUser(department.departmentHead)}</p></div>
                    <div><span className="text-xs font-medium uppercase tracking-wide text-slate-500">Default assignee{department.defaultIssueAssignees.length === 1 ? "" : "s"}</span><p>{department.defaultIssueAssignees.length ? department.defaultIssueAssignees.map(formatAuditUser).join(", ") : "Not assigned"}</p></div>
                  </div>
                </div>
              </label>
            ))}
          </RadioGroup>
          {saveError && <ErrorBox message={saveError} />}
          <Actions saving={saving} disabled={!selectedDepartmentId} onCancel={() => setDepartmentDialogTarget(null)} onSave={() => {
            if (departmentDialogTarget === "create") {
              setCreateDraft((current) => ({ ...current, department: selectedDepartmentId }));
              setDepartmentDialogTarget(null);
            } else {
              void updateChecklist("department", selectedDepartmentId);
            }
          }} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open && !editField && !statusDialog) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {selected && (
            <ChecklistDetails
              checklist={selected}
              section={section}
              canEdit={canEdit}
              canUpdateActiveStatus={canUpdateActiveStatus}
              onEdit={beginEdit}
              onVisibilityHelp={() => setVisibilityHelp(true)}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(editField)}
        onOpenChange={(open) => {
          if (!open && !saving) setEditField(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          {editField && selected && (
            <>
              <DialogHeader>
                <DialogTitle>Update {fieldLabel(editField)}</DialogTitle>
              </DialogHeader>
              <ChecklistFieldEditor
                field={editField}
                draft={draft}
                setDraft={setDraft}
                options={options}
                section={section}
                onVisibilityHelp={() => setVisibilityHelp(true)}
              />
              {saveError && <ErrorBox message={saveError} />}
              <Actions
                saving={saving}
                onCancel={() => setEditField(null)}
                onSave={() => void updateChecklist(editField, draft)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={statusDialog}
        onOpenChange={(open) => {
          if (!saving) setStatusDialog(open);
        }}
      >
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Select status options</DialogTitle>
          </DialogHeader>
          {statusDialogTarget === "edit" && selected?.statusOptionSet && (
            <div className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Currently assigned</p>
                  <h3 className="font-semibold text-slate-900">{selected.statusOptionSet.name}</h3>
                </div>
                <Badge variant="outline">{selected.statusOptionSet.options.length} options</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {selected.statusOptionSet.options.map((option) => (
                  <Badge key={option.key} variant="secondary" className="flex w-full justify-start whitespace-normal py-1.5 text-left leading-5">
                    {option.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                value={statusSearch}
                placeholder="Search option-set names or options…"
                onChange={(event) => setStatusSearch(event.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSaveError("");
                setCreateStatusOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New status options
            </Button>
          </div>
          <div className="grid min-h-[28rem] gap-4 md:grid-cols-[minmax(0,4fr)_minmax(0,6fr)]">
            <div className="h-[28rem] space-y-2 overflow-y-auto rounded-xl border p-2">
              {matchingStatuses.map((set) => (
                <button
                  key={set._id}
                  type="button"
                  onClick={() => setSelectedStatusId(set._id)}
                  className={`w-full rounded-lg border p-3 text-left ${selectedStatusId === set._id ? "border-cyan-500 bg-cyan-50" : "hover:bg-slate-50"}`}
                >
                  <div className="flex justify-between gap-2">
                    <strong>{set.name}</strong>
                    <Badge variant="outline">
                      {set.checklistCount} checklists
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {set.options.length} options
                  </p>
                </button>
              ))}
            </div>
            <div className="h-[28rem] overflow-y-auto rounded-xl border bg-slate-50 p-4">
              {selectedStatus ? (
                <>
                  <h3 className="font-semibold">{selectedStatus.name}</h3>
                  {selectedStatus.description && (
                    <p className="mt-1 text-sm text-slate-600">
                      {selectedStatus.description}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-slate-500">
                    Used by {selectedStatus.checklistCount} checklists
                  </p>
                  <div className="mt-3 space-y-2">
                    {selectedStatus.options.map((option) => (
                      <Badge key={option.key} variant="secondary" className="flex w-full justify-start whitespace-normal py-1.5 text-left leading-5">
                        {option.label}
                      </Badge>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Select an option set to preview it.
                </p>
              )}
            </div>
          </div>
          {saveError && <ErrorBox message={saveError} />}
          <Actions
            saving={saving}
            disabled={!selectedStatusId}
            onCancel={() => setStatusDialog(false)}
            onSave={() => {
              if (statusDialogTarget === "create") {
                setCreateDraft((current) => ({ ...current, statusOptionSet: selectedStatusId }));
                setStatusDialog(false);
              } else {
                void updateChecklist("statusOptionSet", selectedStatusId);
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={createStatusOpen}
        onOpenChange={(open) => {
          if (!saving) setCreateStatusOpen(open);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create status options for this checklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Name">
              <Input
                value={statusCreate.name}
                onChange={(event) =>
                  setStatusCreate((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={statusCreate.description}
                onChange={(event) =>
                  setStatusCreate((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Options">
              <div className="space-y-2">
                {statusCreate.options.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={option.label}
                      placeholder={`Option ${index + 1}`}
                      onChange={(event) =>
                        setStatusCreate((current) => ({
                          ...current,
                          options: current.options.map((item, itemIndex) =>
                            itemIndex === index
                              ? { label: event.target.value }
                              : item,
                          ),
                        }))
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={statusCreate.options.length === 1}
                      onClick={() =>
                        setStatusCreate((current) => ({
                          ...current,
                          options: current.options.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        }))
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setStatusCreate((current) => ({
                      ...current,
                      options: [...current.options, { label: "" }],
                    }))
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add option
                </Button>
              </div>
            </Field>
            {saveError && <ErrorBox message={saveError} />}
            <Actions
              saving={saving}
              disabled={
                !statusCreate.name.trim() ||
                statusCreate.options.some((option) => !option.label.trim())
              }
              onCancel={() => setCreateStatusOpen(false)}
              onSave={() => void createStatusOptions()}
            />
          </div>
        </DialogContent>
      </Dialog>
      <VisibilityHelp open={visibilityHelp} onOpenChange={setVisibilityHelp} />
    </div>
  );
}

function SortableChecklistCard({
  checklist,
  canReorder,
  onOpen,
}: {
  checklist: AuditManagerChecklistDetail;
  canReorder: boolean;
  onOpen: () => void;
}) {
  const sortable = useSortable({ id: checklist._id, disabled: !canReorder });
  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className={`relative ${sortable.isDragging ? "z-20 opacity-80" : ""}`}
    >
      {canReorder && (
        <button
          type="button"
          className="absolute right-11 top-3 z-10 flex h-9 w-9 touch-none items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
      )}
      <ChecklistCard checklist={checklist} onOpen={onOpen} />
    </div>
  );
}
function ChecklistCard({
  checklist,
  onOpen,
}: {
  checklist: AuditManagerChecklistDetail;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group h-full w-full text-left"
    >
      <Card
        className={`h-full transition group-hover:border-cyan-300 group-hover:shadow-md ${checklist.active ? "" : "bg-slate-50 opacity-60"}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="pr-16 text-base sm:text-lg">
              {checklist.item}
            </CardTitle>
            {checklist.active ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <Archive className="h-5 w-5 text-slate-400" />
            )}
          </div>
          {checklist.description && (
            <p className="line-clamp-2 text-sm text-slate-500">
              {checklist.description}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <Badge>{formatFrequency(checklist.frequency)}</Badge>
            {checklist.category && (
              <Badge variant="outline">{checklist.category}</Badge>
            )}
            {checklist.department && (
              <Badge variant="secondary">{checklist.department.name}</Badge>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
            <Metric value={checklist.assignedSites.length} label="Sites" />
            <Metric
              value={checklist.statusOptionSet?.options.length || 0}
              label="Statuses"
            />
            <Metric value={checklist.sortOrder ?? "—"} label="Order" />
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function ChecklistDetails({
  checklist,
  section,
  canEdit,
  canUpdateActiveStatus,
  onEdit,
  onVisibilityHelp,
}: {
  checklist: AuditManagerChecklistDetail;
  section: AuditManagerSection | null;
  canEdit: boolean;
  canUpdateActiveStatus: boolean;
  onEdit: (field: AuditManagerChecklistUpdateField, value?: boolean) => void;
  onVisibilityHelp: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <div className="flex items-center justify-between gap-3 pr-7">
          <DialogTitle>{checklist.item}</DialogTitle>
          {canEdit && (
            <EditButton
              onClick={() => onEdit("item")}
              label="Edit checklist name"
            />
          )}
        </div>
      </DialogHeader>
      <div className="space-y-4">
        <Meta
          label="Description"
          edit={canEdit ? () => onEdit("description") : undefined}
        >
          {checklist.description || "No description provided."}
        </Meta>
        <div className="grid gap-3 sm:grid-cols-3">
          <Meta
            label="Category"
            edit={canEdit ? () => onEdit("category") : undefined}
          >
            {checklist.category || "Not categorized"}
          </Meta>
          <Meta
            label="Frequency"
            edit={canEdit ? () => onEdit("frequency") : undefined}
          >
            {formatFrequency(checklist.frequency)}
          </Meta>
          <Meta
            label="Status"
            edit={canUpdateActiveStatus ? () => onEdit("active") : undefined}
          >
            <Badge variant={checklist.active ? "secondary" : "outline"}>
              {checklist.active ? "Active" : "Inactive"}
            </Badge>
          </Meta>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Meta
            label="Assigned department"
            edit={canEdit ? () => onEdit("department") : undefined}
          >
            {checklist.department?.name || "Not assigned"}
          </Meta>
          <Meta
            label="Checklist visibility"
            edit={canEdit ? () => onEdit("auditTypes") : undefined}
            info={onVisibilityHelp}
          >
            {checklist.auditTypes
              .map((type) => type[0].toUpperCase() + type.slice(1))
              .join(" and ")}
          </Meta>
        </div>
        <Meta
          label={`Status options (${checklist.statusOptionSet?.options.length || 0})`}
          edit={canEdit ? () => onEdit("statusOptionSet") : undefined}
        >
          <strong className="text-sm">
            {checklist.statusOptionSet?.name || "Not assigned"}
          </strong>
          <div className="mt-2 flex flex-wrap gap-2">
            {checklist.statusOptionSet?.options.map((option) => (
              <Badge key={option.key} variant="secondary">
                {option.label}
              </Badge>
            ))}
          </div>
        </Meta>
        <Meta
          label={`Assigned sites (${checklist.assignedSites.length})`}
          edit={canEdit ? () => onEdit("assignedSites") : undefined}
        >
          <div className="flex flex-wrap gap-2">
            {checklist.assignedSites.map((site) => (
              <Badge key={site._id} variant="outline">
                <MapPin className="mr-1 h-3 w-3" />
                {site.site || site.stationName}
              </Badge>
            ))}
          </div>
        </Meta>
        <div className="grid gap-3 sm:grid-cols-2">
          <BooleanToggleMeta
            label="Follow-up required"
            checked={checklist.followUp}
            disabled={!canEdit}
            onChange={(checked) => onEdit("followUp", checked)}
          />
          <BooleanToggleMeta
            label="Comment required"
            checked={checklist.commentRequired}
            disabled={!canEdit}
            onChange={(checked) => onEdit("commentRequired", checked)}
          />
        </div>
        {section?.sectionType === "order" && (
          <Meta
            label="Order creation"
            edit={canEdit ? () => onEdit("orderConfiguration") : undefined}
          >
            {checklist.requestOrderEnabled
              ? `Enabled — ${checklist.suppliesVendor}`
              : "Disabled"}
          </Meta>
        )}
      </div>
    </>
  );
}

function ChecklistFieldEditor({
  field,
  draft,
  setDraft,
  options,
  section,
  onVisibilityHelp,
}: {
  field: AuditManagerChecklistUpdateField;
  draft: Draft;
  setDraft: (value: Draft) => void;
  options: AuditManagerChecklistEditOptions | null;
  section: AuditManagerSection | null;
  onVisibilityHelp: () => void;
}) {
  if (field === "item")
    return (
      <Input value={String(draft)} onChange={(e) => setDraft(e.target.value)} />
    );
  if (field === "description")
    return (
      <Textarea
        className="min-h-32"
        value={String(draft)}
        onChange={(e) => setDraft(e.target.value)}
      />
    );
  if (field === "category")
    return (
      <div className="space-y-3">
        <Input
          value={String(draft)}
          placeholder="Choose or create a category"
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {options?.categories
            .filter((category) =>
              category.toLowerCase().includes(String(draft).toLowerCase()),
            )
            .map((category) => (
              <Button
                key={category}
                variant="outline"
                size="sm"
                onClick={() => setDraft(category)}
              >
                {category}
              </Button>
            ))}
        </div>
      </div>
    );
  if (field === "frequency")
    return (
      <SimpleSelect
        value={String(draft)}
        values={["daily", "weekly", "monthly"]}
        onChange={setDraft}
      />
    );
  if (field === "commentRequired" || field === "active")
    return (
      <SimpleSelect
        value={draft === true ? "yes" : "no"}
        entries={
          field === "active"
            ? [
                ["yes", "Active"],
                ["no", "Inactive"],
              ]
            : [
                ["yes", "Required"],
                ["no", "Not required"],
              ]
        }
        onChange={(value) => setDraft(value === "yes")}
      />
    );
  if (field === "assignedSites")
    return (
      <CheckboxList
        values={(options?.sites || []).map((site) => ({
          id: site._id,
          label: site.site || site.stationName,
        }))}
        selected={draft as string[]}
        onChange={setDraft}
      />
    );
  if (field === "auditTypes")
    return (
      <div className="space-y-3">
        <Button variant="outline" size="sm" onClick={onVisibilityHelp}>
          <Info className="mr-2 h-4 w-4" />
          What does visibility mean?
        </Button>
        <CheckboxList
          values={[
            { id: "store", label: "Store audit" },
            { id: "visitor", label: "Visitor audit" },
          ]}
          selected={draft as string[]}
          onChange={setDraft}
        />
      </div>
    );
  if (field === "orderConfiguration" && section?.sectionType === "order") {
    const value = draft as { enabled: boolean; vendor: string };
    return (
      <div className="space-y-4">
        <SimpleSelect
          value={value.enabled ? "yes" : "no"}
          entries={[
            ["yes", "Create an order"],
            ["no", "Do not create an order"],
          ]}
          onChange={(next) => setDraft({ ...value, enabled: next === "yes" })}
        />
        {value.enabled && (
          <SimpleSelect
            value={value.vendor}
            entries={(options?.vendors || []).map((vendor) => [vendor, vendor])}
            placeholder="Select Station Supplies vendor"
            onChange={(vendor) => setDraft({ ...value, vendor })}
          />
        )}
      </div>
    );
  }
  return null;
}

function VisibilityHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Checklist visibility</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Meta label="Store audit">
            Station staff see and complete this checklist during their normal
            audit.
          </Meta>
          <Meta label="Visitor audit">
            Visiting auditors see this checklist during a visitor review.
          </Meta>
          <p className="text-sm text-slate-600">
            Select both when the same checklist should appear in both workflows.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
function CheckboxList({
  values,
  selected,
  onChange,
}: {
  values: Array<{ id: string; label: string }>;
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border p-2">
      {values.map((value) => (
        <label
          key={value.id}
          className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-slate-50"
        >
          <Checkbox
            checked={selected.includes(value.id)}
            onCheckedChange={(checked) =>
              onChange(
                checked === true
                  ? [...new Set([...selected, value.id])]
                  : selected.filter((id) => id !== value.id),
              )
            }
          />
          {value.label}
        </label>
      ))}
    </div>
  );
}
function SimpleSelect({
  value,
  values,
  entries,
  onChange,
  placeholder,
}: {
  value: string;
  values?: string[];
  entries?: string[][];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const list =
    entries ||
    (values || []).map((item) => [item, item[0].toUpperCase() + item.slice(1)]);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {list.map(([id, label]) => (
          <SelectItem key={id} value={id}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Meta({
  label,
  children,
  edit,
  info,
}: {
  label: string;
  children: ReactNode;
  edit?: () => void;
  info?: () => void;
}) {
  return (
    <div className="rounded-xl border bg-slate-50/70 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1 text-sm font-semibold">
          {label}
          {info && (
            <button onClick={info}>
              <Info className="h-3.5 w-3.5 text-slate-400" />
            </button>
          )}
        </span>
        {edit && <EditButton onClick={edit} label={`Edit ${label}`} />}
      </div>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}
function BooleanToggleMeta({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-20 items-center justify-between gap-4 rounded-xl border bg-slate-50/70 p-4">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-1 text-xs text-slate-500">{checked ? "Enabled" : "Disabled"}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function EditButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={onClick}
      title={label}
    >
      <Pencil className="h-3.5 w-3.5" />
    </Button>
  );
}
function Actions({
  saving,
  onCancel,
  onSave,
  disabled = false,
}: {
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" disabled={saving} onClick={onCancel}>
        Cancel
      </Button>
      <Button disabled={saving || disabled} onClick={onSave}>
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Save
      </Button>
    </div>
  );
}
function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <strong className="block text-base text-slate-800">{value}</strong>
      {label}
    </div>
  );
}
function Loading() {
  return (
    <div className="flex min-h-60 items-center justify-center rounded-2xl border border-dashed bg-white">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Loading checklists…
    </div>
  );
}
function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {message}
    </div>
  );
}
function Empty({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}
function fieldLabel(field: AuditManagerChecklistUpdateField) {
  return (
    {
      item: "checklist name",
      description: "description",
      category: "category",
      frequency: "frequency",
      auditTypes: "visibility",
      department: "assigned department",
      statusOptionSet: "status options",
      followUp: "follow-up requirement",
      commentRequired: "comment requirement",
      assignedSites: "assigned sites",
      orderConfiguration: "order creation",
      active: "status",
    } as const
  )[field];
}

function formatFrequency(value: AuditManagerChecklistDetail["frequency"]) {
  return value[0].toUpperCase() + value.slice(1);
}

function formatAuditUser(user: AuditManagerUserSummary | null | undefined) {
  if (!user) return "Not assigned";
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}
