import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import {
  Archive,
  Bell,
  Building2,
  CheckCircle2,
  Info,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { auditManagerService } from "@/api/audit-manager/audit-manager.service";
import type {
  AuditManagerDepartmentCreate,
  AuditManagerDepartmentDetail,
  AuditManagerDepartmentOptions,
  AuditManagerDepartmentUpdate,
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

export const Route = createFileRoute("/_navbarLayout/audit-manager/department")(
  { component: DepartmentManagementPage },
);

type EditField =
  | "name"
  | "description"
  | "departmentHead"
  | "members"
  | "defaultIssueAssignees"
  | "assignmentStrategy"
  | "escalationDepartment"
  | "notificationEmails"
  | "siteNotifications"
  | "active";
type EditDraft =
  | string
  | boolean
  | string[]
  | Array<{ site: string; emails: string[] }>;
const strategyLabels = {
  department_head: "Department Head",
  station_manager: "Site Station Manager",
  operations_queue: "Head Office Operations",
} as const;
const emptyDepartment: AuditManagerDepartmentCreate = {
  name: "", description: "", departmentHead: null, members: [],
  defaultIssueAssignees: [], assignmentStrategy: "department_head",
  escalationDepartment: null, notificationEmails: [], siteNotifications: [], active: true,
};

function userName(user?: AuditManagerUserSummary | null) {
  if (!user) return "Not assigned";
  return `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
}

function UserWithEmail({
  user,
  fallback = "Not assigned",
}: {
  user?: AuditManagerUserSummary | null;
  fallback?: string;
}) {
  if (!user) return <span className="text-sm text-amber-700">{fallback}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help border-b border-dotted border-slate-400 text-sm text-slate-800">
          {userName(user)}
        </span>
      </TooltipTrigger>
      <TooltipContent>{user.email}</TooltipContent>
    </Tooltip>
  );
}

function DepartmentManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<
    AuditManagerDepartmentDetail[]
  >([]);
  const [options, setOptions] = useState<AuditManagerDepartmentOptions | null>(
    null,
  );
  const [selected, setSelected] = useState<AuditManagerDepartmentDetail | null>(
    null,
  );
  const [editField, setEditField] = useState<EditField | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>("");
  const [search, setSearch] = useState("");
  const [siteDialog, setSiteDialog] = useState(false);
  const [strategyHelp, setStrategyHelp] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<AuditManagerDepartmentCreate>(emptyDepartment);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canView =
    hasAuditManagerAccess(user?.access) &&
    hasAuditManagerPermission(user?.access, "department");
  const hasEditPermission = hasAuditManagerAction(
    user?.access,
    "department",
    "edit",
  );
  const hasAddPermission = hasAuditManagerAction(user?.access, "department", "add");
  const hasStrategyPermission = hasAuditManagerNestedAction(
    user?.access,
    "department",
    "edit",
    "strategyAutomation",
  );
  const hasStatusPermission = hasAuditManagerNestedAction(
    user?.access,
    "department",
    "edit",
    "status",
  );
  const canEditSelected = Boolean(
    selected &&
    hasEditPermission &&
    (selected.accessScope === "admin" ||
      selected.departmentHead?._id === user?.id),
  );

  useEffect(() => {
    if (!user || !canView) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    auditManagerService
      .listDepartments()
      .then((result) => {
        if (!cancelled) setDepartments(result.departments);
      })
      .catch((requestError) => {
        if (cancelled) return;
        if (isApiError(requestError) && requestError.status === 403)
          return void navigate({ to: "/no-access" });
        setError("Unable to load Station Audit departments. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canView, navigate, user]);

  useEffect(() => {
    if (!user || !canView || (!hasEditPermission && !hasAddPermission)) return;
    auditManagerService
      .departmentOptions(hasEditPermission ? "auditManager.department.edit" : "auditManager.department.add")
      .then(setOptions)
      .catch(() => undefined);
  }, [canView, hasAddPermission, hasEditPermission, user]);

  const sortedDepartments = useMemo(
    () =>
      [...departments].sort(
        (left, right) =>
          Number(right.active) - Number(left.active) ||
          left.name.localeCompare(right.name, undefined, {
            sensitivity: "base",
          }),
      ),
    [departments],
  );

  if (!user) return null;
  if (!canView) return <Navigate to="/no-access" replace />;

  function beginEdit(field: EditField) {
    if (!selected || !canEditSelected) return;
    const values: Record<EditField, EditDraft> = {
      name: selected.name,
      description: selected.description || "",
      departmentHead: selected.departmentHead?._id || "",
      members: selected.members
        .map((entry) => entry.user?._id)
        .filter(Boolean) as string[],
      defaultIssueAssignees: selected.defaultIssueAssignees.map(
        (entry) => entry._id,
      ),
      assignmentStrategy: selected.assignmentStrategy,
      escalationDepartment: selected.escalationDepartment?._id || "",
      notificationEmails: selected.notificationEmails,
      siteNotifications: selected.siteNotifications
        .map((entry) => ({ site: entry.site?._id || "", emails: entry.emails }))
        .filter((entry) => entry.site),
      active: selected.active,
    };
    setSearch("");
    setSaveError("");
    setEditDraft(values[field]);
    setEditField(field);
  }

  async function saveField() {
    if (!selected || !editField) return;
    const input = {
      [editField]:
        editField === "departmentHead" || editField === "escalationDepartment"
          ? String(editDraft) || null
          : editDraft,
    } as AuditManagerDepartmentUpdate;
    setSaving(true);
    setSaveError("");
    try {
      const result = await auditManagerService.updateDepartment(
        selected._id,
        input,
        editField,
      );
      setDepartments((current) =>
        current.map((department) =>
          department._id === result.department._id
            ? result.department
            : department,
        ),
      );
      setSelected(result.department);
      setEditField(null);
      toast.success("Department updated");
    } catch (requestError) {
      if (isApiError(requestError) && requestError.status === 403)
        return void navigate({ to: "/no-access" });
      setSaveError(
        isApiError(requestError)
          ? requestError.message
          : "Unable to update this department.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function createDepartment() {
    setSaving(true);
    setSaveError("");
    try {
      const result = await auditManagerService.createDepartment(addDraft);
      setDepartments((current) => [...current, result.department]);
      setAddOpen(false);
      setAddDraft(emptyDepartment);
      toast.success("Department created");
    } catch (requestError) {
      if (isApiError(requestError) && requestError.status === 403)
        return void navigate({ to: "/no-access" });
      setSaveError(isApiError(requestError) ? requestError.message : "Unable to create the department.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto w-full max-w-6xl px-3 pb-10 sm:px-5">
        <div className="mb-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-blue-600 p-2.5 text-white"><Building2 className="h-6 w-6" /></div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Department Management</h1>
                <p className="mt-1 text-sm text-slate-600">Review issue ownership, members, assignees, and notification settings.</p>
              </div>
            </div>
            {hasAddPermission && <Button type="button" onClick={() => { setAddDraft(emptyDepartment); setSaveError(""); setAddOpen(true); }}><Plus className="mr-2 h-4 w-4" />Add department</Button>}
          </div>
        </div>
        {loading && (
          <div className="flex min-h-60 items-center justify-center rounded-2xl border border-dashed bg-white">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" />
            Loading departments…
          </div>
        )}
        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">
            {error}
          </div>
        )}
        {!loading && !error && sortedDepartments.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-slate-500">
            No departments are available to your account.
          </div>
        )}
        {!loading && !error && sortedDepartments.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sortedDepartments.map((department) => (
              <DepartmentCard
                key={department._id}
                department={department}
                onOpen={() => setSelected(department)}
              />
            ))}
          </div>
        )}

        <Dialog
          open={Boolean(selected)}
          onOpenChange={(open) => {
            if (!open && !editField && !siteDialog) setSelected(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            {selected && (
              <>
                <DialogHeader>
                  <div className="flex items-center justify-between gap-3 pr-7">
                    <DialogTitle className="text-xl">
                      {selected.name}
                    </DialogTitle>
                    {canEditSelected && (
                      <EditButton
                        label="Edit department name"
                        onClick={() => beginEdit("name")}
                      />
                    )}
                  </div>
                </DialogHeader>
                <div className="space-y-5">
                  <DetailBlock
                    label="Description"
                    icon={Building2}
                    onEdit={
                      canEditSelected
                        ? () => beginEdit("description")
                        : undefined
                    }
                  >
                    <p className="text-sm text-slate-700">
                      {selected.description || "No description provided."}
                    </p>
                  </DetailBlock>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailBlock
                      label="Department head"
                      icon={ShieldCheck}
                      onEdit={
                        canEditSelected
                          ? () => beginEdit("departmentHead")
                          : undefined
                      }
                    >
                      <UserWithEmail user={selected.departmentHead} />
                    </DetailBlock>
                    <DetailBlock
                      label="Escalation department"
                      icon={Building2}
                      onEdit={
                        canEditSelected
                          ? () => beginEdit("escalationDepartment")
                          : undefined
                      }
                    >
                      <p className="text-sm text-slate-700">
                        {selected.escalationDepartment?.name ||
                          "Not configured"}
                      </p>
                    </DetailBlock>
                  </div>
                  <DetailBlock
                    label={`Members (${selected.memberCount})`}
                    icon={Users}
                    onEdit={
                      canEditSelected ? () => beginEdit("members") : undefined
                    }
                  >
                    <UserList
                      users={
                        selected.members
                          .map((member) => member.user)
                          .filter(Boolean) as AuditManagerUserSummary[]
                      }
                      empty="No department members."
                    />
                  </DetailBlock>
                  <DetailBlock
                    label="Default issue assignees"
                    icon={UserRound}
                    onEdit={
                      canEditSelected
                        ? () => beginEdit("defaultIssueAssignees")
                        : undefined
                    }
                  >
                    <UserList
                      users={selected.defaultIssueAssignees}
                      empty="No default assignees."
                    />
                  </DetailBlock>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailBlock
                      label="Assignment strategy"
                      icon={ShieldCheck}
                      onEdit={
                        canEditSelected && hasStrategyPermission
                          ? () => beginEdit("assignmentStrategy")
                          : undefined
                      }
                      info={() => setStrategyHelp(true)}
                    >
                      <p className="text-sm text-slate-700">
                        {strategyLabels[selected.assignmentStrategy]}
                      </p>
                    </DetailBlock>
                    <DetailBlock
                      label="Status"
                      icon={CheckCircle2}
                      onEdit={
                        canEditSelected && hasStatusPermission
                          ? () => beginEdit("active")
                          : undefined
                      }
                    >
                      <Badge
                        variant={selected.active ? "secondary" : "outline"}
                      >
                        {selected.active ? "Active" : "Inactive"}
                      </Badge>
                    </DetailBlock>
                  </div>
                  <DetailBlock
                    label="Notification emails"
                    icon={Mail}
                    onEdit={
                      canEditSelected
                        ? () => beginEdit("notificationEmails")
                        : undefined
                    }
                  >
                    <EmailList
                      emails={selected.notificationEmails}
                      empty="No default notification emails."
                    />
                  </DetailBlock>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border bg-slate-50/70 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/50"
                    onClick={() => setSiteDialog(true)}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <Bell className="h-4 w-4 text-blue-600" />
                      Site notifications
                    </span>
                    <Badge variant="secondary">
                      {selected.siteNotifications.length} overrides
                    </Badge>
                  </button>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailBlock label="Created">
                      <p className="text-sm text-slate-700">
                        {formatDate(selected.createdAt)}
                      </p>
                    </DetailBlock>
                    <DetailBlock label="Last updated">
                      <p className="text-sm text-slate-700">
                        {formatDate(selected.updatedAt)}
                      </p>
                    </DetailBlock>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={siteDialog} onOpenChange={setSiteDialog}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            {selected && (
              <>
                <DialogHeader>
                  <div className="flex items-center justify-between gap-3 pr-7">
                    <DialogTitle>Site notification overrides</DialogTitle>
                    {canEditSelected && (
                      <EditButton
                        label="Edit site notification overrides"
                        onClick={() => beginEdit("siteNotifications")}
                      />
                    )}
                  </div>
                </DialogHeader>
                <div className="space-y-3">
                  {selected.siteNotifications.length ? (
                    selected.siteNotifications.map((entry, index) => (
                      <div
                        key={entry.site?._id || index}
                        className="rounded-xl border p-4"
                      >
                        <div className="mb-2 flex items-center gap-2 font-medium">
                          <MapPin className="h-4 w-4 text-blue-600" />
                          {entry.site
                            ? entry.site.site || entry.site.stationName
                            : "Unknown site"}
                        </div>
                        <EmailList emails={entry.emails} empty="No emails." />
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">
                      No site overrides configured.
                    </p>
                  )}
                </div>
              </>
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
                  <DialogTitle className="capitalize">
                    Update {fieldLabel(editField)}
                  </DialogTitle>
                </DialogHeader>
                <DepartmentFieldEditor
                  field={editField}
                  draft={editDraft}
                  setDraft={setEditDraft}
                  options={options}
                  search={search}
                  setSearch={setSearch}
                  onStrategyHelp={() => setStrategyHelp(true)}
                />
                {saveError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {saveError}
                  </div>
                )}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() => setEditField(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={saving || !options}
                    onClick={() => void saveField()}
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Update field
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={addOpen} onOpenChange={(open) => { if (!saving) setAddOpen(open); }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader><DialogTitle>Add department</DialogTitle></DialogHeader>
            <DepartmentCreateForm draft={addDraft} setDraft={setAddDraft} options={options} search={search} setSearch={setSearch} onStrategyHelp={() => setStrategyHelp(true)} />
            {saveError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{saveError}</div>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" disabled={saving} onClick={() => setAddOpen(false)}>Cancel</Button><Button disabled={saving || !options || !addDraft.name.trim()} onClick={() => void createDepartment()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Create department</Button></div>
          </DialogContent>
        </Dialog>

        <StrategyHelpDialog
          open={strategyHelp}
          onOpenChange={setStrategyHelp}
        />
      </div>
    </TooltipProvider>
  );
}

function DepartmentCard({
  department,
  onOpen,
}: {
  department: AuditManagerDepartmentDetail;
  onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className="group h-full text-left">
      <Card
        className={`h-full border-slate-200 transition-all group-hover:-translate-y-0.5 group-hover:border-blue-300 group-hover:shadow-md ${department.active ? "" : "bg-slate-50 opacity-60"}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-lg">{department.name}</CardTitle>
            {department.active ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <Archive className="h-5 w-5 shrink-0 text-slate-400" />
            )}
          </div>
          {department.description && (
            <p className="line-clamp-2 text-sm font-normal text-slate-500">
              {department.description}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <Badge variant="secondary">
            {strategyLabels[department.assignmentStrategy]}
          </Badge>
          <div className="grid grid-cols-2 gap-2 text-center text-xs text-slate-500">
            <div className="rounded-lg bg-slate-50 p-2">
              <strong className="block text-base text-slate-800">
                {department.memberCount}
              </strong>
              Members
            </div>
            <div
              className="rounded-lg bg-slate-50 p-2"
              title={department.departmentHead?.email}
            >
              <strong className="block truncate text-sm text-slate-800">
                {userName(department.departmentHead)}
              </strong>
              Department head
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function DepartmentCreateForm({ draft, setDraft, options, search, setSearch, onStrategyHelp }: { draft: AuditManagerDepartmentCreate; setDraft: Dispatch<SetStateAction<AuditManagerDepartmentCreate>>; options: AuditManagerDepartmentOptions | null; search: string; setSearch: (value: string) => void; onStrategyHelp: () => void }) {
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Department name</Label><Input value={draft.name} maxLength={200} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></div><div className="space-y-2"><Label>Initial status</Label><Select value={draft.active ? "active" : "inactive"} onValueChange={(value) => setDraft((current) => ({ ...current, active: value === "active" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div></div>
    <div className="space-y-2"><Label>Description</Label><Textarea value={draft.description} maxLength={2000} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></div>
    <div className="space-y-2"><Label>Department head</Label><UserSelector users={options?.users || []} selected={draft.departmentHead ? [draft.departmentHead] : []} search={search} setSearch={setSearch} single onChange={(ids) => setDraft((current) => ({ ...current, departmentHead: ids[0] || null }))} /></div>
    <div className="space-y-2"><Label>Members</Label><UserSelector users={options?.users || []} selected={draft.members} search={search} setSearch={setSearch} onChange={(members) => setDraft((current) => ({ ...current, members }))} /></div>
    <div className="space-y-2"><Label>Default issue assignees</Label><UserSelector users={options?.users || []} selected={draft.defaultIssueAssignees} search={search} setSearch={setSearch} onChange={(defaultIssueAssignees) => setDraft((current) => ({ ...current, defaultIssueAssignees }))} /></div>
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><div className="flex items-center justify-between"><Label>Assignment strategy</Label><Button type="button" variant="ghost" size="sm" onClick={onStrategyHelp}><Info className="mr-1 h-4 w-4" />Help</Button></div><Select value={draft.assignmentStrategy} onValueChange={(assignmentStrategy: AuditManagerDepartmentCreate["assignmentStrategy"]) => setDraft((current) => ({ ...current, assignmentStrategy }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(strategyLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Escalation department</Label><Select value={draft.escalationDepartment || "none"} onValueChange={(value) => setDraft((current) => ({ ...current, escalationDepartment: value === "none" ? null : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No escalation department</SelectItem>{options?.departments.map((department) => <SelectItem key={department._id} value={department._id}>{department.name}</SelectItem>)}</SelectContent></Select></div></div>
    <div className="space-y-2"><Label>Notification emails</Label><EmailChipEditor emails={draft.notificationEmails} onChange={(notificationEmails) => setDraft((current) => ({ ...current, notificationEmails }))} /></div>
    <div className="space-y-2"><Label>Site notification overrides</Label><SiteNotificationEditor sites={options?.sites || []} entries={draft.siteNotifications} onChange={(value) => setDraft((current) => ({ ...current, siteNotifications: value as Array<{ site: string; emails: string[] }> }))} /></div>
  </div>;
}

function DepartmentFieldEditor({
  field,
  draft,
  setDraft,
  options,
  search,
  setSearch,
  onStrategyHelp,
}: {
  field: EditField;
  draft: EditDraft;
  setDraft: (value: EditDraft) => void;
  options: AuditManagerDepartmentOptions | null;
  search: string;
  setSearch: (value: string) => void;
  onStrategyHelp: () => void;
}) {
  if (field === "name")
    return (
      <Input
        value={String(draft)}
        maxLength={200}
        onChange={(event) => setDraft(event.target.value)}
      />
    );
  if (field === "description")
    return (
      <Textarea
        value={String(draft)}
        maxLength={2000}
        className="min-h-32"
        onChange={(event) => setDraft(event.target.value)}
      />
    );
  if (field === "departmentHead")
    return (
      <UserSelector
        users={options?.users || []}
        selected={String(draft) ? [String(draft)] : []}
        search={search}
        setSearch={setSearch}
        single
        onChange={(ids) => setDraft(ids[0] || "")}
      />
    );
  if (field === "members" || field === "defaultIssueAssignees")
    return (
      <UserSelector
        users={options?.users || []}
        selected={draft as string[]}
        search={search}
        setSearch={setSearch}
        onChange={setDraft}
      />
    );
  if (field === "assignmentStrategy")
    return (
      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onStrategyHelp}
        >
          <Info className="mr-2 h-4 w-4" />
          How strategies work
        </Button>
        <Select value={String(draft)} onValueChange={setDraft}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(strategyLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  if (field === "escalationDepartment")
    return (
      <Select
        value={String(draft) || "none"}
        onValueChange={(value) => setDraft(value === "none" ? "" : value)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No escalation department</SelectItem>
          {options?.departments.map((department) => (
            <SelectItem key={department._id} value={department._id}>
              {department.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  if (field === "notificationEmails")
    return <EmailEditor emails={draft as string[]} onChange={setDraft} />;
  if (field === "siteNotifications")
    return (
      <SiteNotificationEditor
        sites={options?.sites || []}
        entries={draft as Array<{ site: string; emails: string[] }>}
        onChange={setDraft}
      />
    );
  return (
    <Select
      value={draft === true ? "active" : "inactive"}
      onValueChange={(value) => setDraft(value === "active")}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="active">Active</SelectItem>
        <SelectItem value="inactive">Inactive</SelectItem>
      </SelectContent>
    </Select>
  );
}

function UserSelector({
  users,
  selected,
  search,
  setSearch,
  onChange,
  single = false,
}: {
  users: AuditManagerUserSummary[];
  selected: string[];
  search: string;
  setSearch: (value: string) => void;
  onChange: (ids: string[]) => void;
  single?: boolean;
}) {
  const term = search.trim().toLowerCase();
  const filtered = users.filter((user) =>
    `${user.firstName} ${user.lastName} ${user.email} ${user.role?.role_name || ""}`
      .toLowerCase()
      .includes(term),
  );
  return (
    <div className="space-y-3">
      <Input
        value={search}
        placeholder="Search name, email, or role…"
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="max-h-80 space-y-1 overflow-y-auto rounded-xl border p-2">
        {filtered.map((user) => {
          const checked = selected.includes(user._id);
          return (
            <label
              key={user._id}
              className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-slate-50"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(value) =>
                  onChange(
                    single
                      ? value === true
                        ? [user._id]
                        : []
                      : value === true
                        ? [...new Set([...selected, user._id])]
                        : selected.filter((id) => id !== user._id),
                  )
                }
              />
              <span className="min-w-0">
                <strong className="block text-sm">{userName(user)}</strong>
                <span className="block truncate text-xs text-slate-500">
                  {user.email} · {user.role?.role_name || "No role"}
                </span>
              </span>
            </label>
          );
        })}
        {filtered.length === 0 && (
          <p className="p-5 text-center text-sm text-slate-500">
            No users match your search.
          </p>
        )}
      </div>
    </div>
  );
}

function EmailEditor({
  emails,
  onChange,
}: {
  emails: string[];
  onChange: (value: EditDraft) => void;
}) {
  return <EmailChipEditor emails={emails} onChange={(next) => onChange(next)} />;
}

function SiteNotificationEditor({
  sites,
  entries,
  onChange,
}: {
  sites: AuditManagerDepartmentOptions["sites"];
  entries: Array<{ site: string; emails: string[] }>;
  onChange: (value: EditDraft) => void;
}) {
  const bySite = new Map(entries.map((entry) => [entry.site, entry.emails]));
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Add only the notification addresses required for each store.</p>
      <div className="max-h-[55vh] space-y-3 overflow-y-auto">
        {sites.map((site) => (
          <div key={site._id} className="rounded-xl border p-3">
            <Label>{site.site || site.stationName}</Label>
            <div className="mt-2">
              <EmailChipEditor
                emails={bySite.get(site._id) || []}
                compact
                onChange={(emails) => {
                const next = entries.filter((entry) => entry.site !== site._id);
                if (emails.length) next.push({ site: site._id, emails });
                onChange(next);
              }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmailChipEditor({ emails, onChange, compact = false }: { emails: string[]; onChange: (emails: string[]) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  function addEmail() {
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setEmailError("Enter a valid email address.");
    if (emails.some((entry) => entry.toLowerCase() === value)) return setEmailError("This email is already listed.");
    onChange([...emails, value]);
    setEmail(""); setEmailError(""); setOpen(false);
  }
  return <div className={compact ? "space-y-2" : "space-y-3"}>
    <div className="flex flex-wrap items-center gap-2">
      {emails.map((entry) => <span key={entry} className="inline-flex items-center gap-1 rounded-full border bg-slate-50 py-1 pl-2.5 pr-1 text-xs text-slate-700">{entry}<button type="button" className="rounded-full p-1 hover:bg-slate-200" aria-label={`Remove ${entry}`} onClick={() => onChange(emails.filter((item) => item !== entry))}><X className="h-3 w-3" /></button></span>)}
      <Button type="button" variant="outline" size="sm" onClick={() => { setEmail(""); setEmailError(""); setOpen(true); }}><Plus className="mr-1.5 h-3.5 w-3.5" />Add email</Button>
    </div>
    {emails.length === 0 && <p className="text-xs text-slate-500">No emails added.</p>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Add notification email</DialogTitle></DialogHeader><div className="space-y-3"><div className="space-y-2"><Label>Email address</Label><Input type="email" autoFocus value={email} placeholder="name@example.com" onChange={(event) => { setEmail(event.target.value); setEmailError(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addEmail(); } }} /></div>{emailError && <p className="text-sm text-red-600">{emailError}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="button" onClick={addEmail}>Add</Button></div></div></DialogContent></Dialog>
  </div>;
}

function StrategyHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const strategies = [
    [
      "Department Head",
      "New issues are assigned to the configured department head.",
      "The head can reassign work to department members.",
    ],
    [
      "Station Manager",
      "The responsible manager is resolved dynamically from the issue site.",
      "The manager can resolve locally or escalate to head office.",
    ],
    [
      "Head Office Operations",
      "New issues enter a shared head-office operations queue.",
      "Default assignees can receive and monitor the work.",
    ],
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assignment strategy automation</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {strategies.map(([title, first, second]) => (
            <div key={title} className="rounded-xl border p-4">
              <h3 className="font-semibold">{title}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                <li>{first}</li>
                <li>{second}</li>
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Pencil className="h-3.5 w-3.5" />
    </Button>
  );
}
function DetailBlock({
  label,
  icon: Icon,
  children,
  onEdit,
  info,
}: {
  label: string;
  icon?: typeof Building2;
  children: ReactNode;
  onEdit?: () => void;
  info?: () => void;
}) {
  return (
    <div className="rounded-xl border bg-slate-50/70 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {Icon && <Icon className="h-4 w-4 text-blue-600" />}
          {label}
          {info && (
            <button type="button" aria-label={`About ${label}`} onClick={info}>
              <Info className="h-3.5 w-3.5 text-slate-400" />
            </button>
          )}
        </div>
        {onEdit && (
          <EditButton label={`Edit ${label.toLowerCase()}`} onClick={onEdit} />
        )}
      </div>
      {children}
    </div>
  );
}
function UserList({
  users,
  empty,
}: {
  users: AuditManagerUserSummary[];
  empty: string;
}) {
  return users.length ? (
    <div className="flex flex-wrap gap-2">
      {users.map((user) => (
        <Badge key={user._id} variant="secondary">
          <UserWithEmail user={user} />
        </Badge>
      ))}
    </div>
  ) : (
    <span className="text-sm text-slate-500">{empty}</span>
  );
}
function EmailList({ emails, empty }: { emails: string[]; empty: string }) {
  return emails.length ? (
    <div className="flex flex-wrap gap-2">
      {emails.map((email) => (
        <Badge key={email} variant="outline">
          {email}
        </Badge>
      ))}
    </div>
  ) : (
    <span className="text-sm text-slate-500">{empty}</span>
  );
}
function fieldLabel(field: EditField) {
  return (
    {
      name: "department name",
      description: "description",
      departmentHead: "department head",
      members: "members",
      defaultIssueAssignees: "default issue assignees",
      assignmentStrategy: "assignment strategy",
      escalationDepartment: "escalation department",
      notificationEmails: "notification emails",
      siteNotifications: "site notification overrides",
      active: "status",
    } as const
  )[field];
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
