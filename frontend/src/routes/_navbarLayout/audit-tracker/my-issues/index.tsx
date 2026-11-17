import { useEffect, useState } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  History,
  ImageIcon,
  Inbox,
  Loader2,
  MapPin,
  MessageSquareText,
  Search,
  SlidersHorizontal,
  ShieldAlert,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { auditTrackerService } from "@/api/audit-tracker/audit-tracker.service";
import type {
  AuditTrackerIssue,
  AuditTrackerIssuePriority,
  AuditTrackerIssueStatus,
} from "@/api/audit-tracker/audit-tracker.types";
import {
  hasAuditTrackerDepartmentIssuesAction,
  hasAuditTrackerAccess,
  hasAuditTrackerPermission,
} from "@/lib/auditTrackerPermissions";
import { cn } from "@/lib/utils";
import { stationAuditPhotoUrl } from "@/lib/stationAuditPhotos";
import { IssueActivityPanel } from "@/components/custom/station-audits/IssueActivityPanel";
import { IssueActionDialogs } from "@/components/custom/station-audits/IssueActionDialogs";
import { IssueHistoryPanel } from "@/components/custom/station-audits/IssueHistoryPanel";
import { IssueAssignmentDialog } from "@/components/custom/station-audits/IssueAssignmentDialog";

export const Route = createFileRoute("/_navbarLayout/audit-tracker/my-issues/")({
  component: MyIssuesPage,
});

function MyIssuesPage() {
  return <IssueQueuePage scope="myIssues" />;
}

export function IssueQueuePage({ scope }: { scope: "myIssues" | "departmentIssues" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [site, setSite] = useState("all");
  const [status, setStatus] = useState<
    "all" | Exclude<AuditTrackerIssueStatus, "resolved">
  >("all");
  const [priority, setPriority] = useState<"all" | AuditTrackerIssuePriority>(
    "all",
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftSite, setDraftSite] = useState("all");
  const [draftStatus, setDraftStatus] = useState<typeof status>("all");
  const [draftPriority, setDraftPriority] = useState<typeof priority>("all");
  const [department, setDepartment] = useState("all");
  const [draftDepartment, setDraftDepartment] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => setPage(1), [debouncedSearch, site, status, priority, department]);

  const query = useQuery({
    queryKey: [
      "audit-tracker",
      scope === "departmentIssues" ? "department-issues" : "my-issues",
      debouncedSearch,
      site,
      status,
      priority,
      department,
      page,
    ],
    queryFn: () =>
      (scope === "departmentIssues" ? auditTrackerService.departmentIssues : auditTrackerService.myIssues)({
        search: debouncedSearch || undefined,
        site,
        status,
        priority,
        department: scope === "departmentIssues" ? department : undefined,
        page,
        limit: 30,
      }),
    enabled: Boolean(
      user &&
      hasAuditTrackerAccess(user.access) &&
      hasAuditTrackerPermission(user.access, scope),
    ),
  });

  if (!user) return null;
  if (
    !hasAuditTrackerAccess(user.access) ||
    !hasAuditTrackerPermission(user.access, scope)
  ) {
    return <Navigate to="/no-access" replace />;
  }

  function selectIssue(issue: AuditTrackerIssue) {
    navigate({
      to: scope === "departmentIssues" ? "/audit-tracker/department-issues/$issueId" : "/audit-tracker/my-issues/$issueId",
      params: { issueId: issue._id },
    });
  }

  function openFilters() {
    setDraftSite(site);
    setDraftStatus(status);
    setDraftPriority(priority);
    setDraftDepartment(department);
    setFiltersOpen(true);
  }

  function applyFilters() {
    setSite(draftSite);
    setStatus(draftStatus);
    setPriority(draftPriority);
    setDepartment(draftDepartment);
    setFiltersOpen(false);
  }

  const summary = query.data?.summary || {
    total: 0,
    created: 0,
    inProgress: 0,
    onHold: 0,
  };

  return (
    <div className="w-full bg-slate-50/60 pb-10">
      <div className="mx-auto w-full max-w-[1500px] px-3 sm:px-5 lg:px-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-violet-600 p-2.5 text-white shadow-sm">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900">
                    {scope === "departmentIssues" ? "Department issue queue" : "My issue queue"}
                  </h1>
                  <p className="text-sm text-slate-500">
                    {scope === "departmentIssues" ? "Open audit issues belonging to your accessible departments." : "Open audit issues currently assigned to you."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <SummaryTile label="Open" value={summary.total} tone="slate" />
                <SummaryTile label="New" value={summary.created} tone="rose" />
                <SummaryTile
                  label="In progress"
                  value={summary.inProgress}
                  tone="blue"
                />
                <SummaryTile
                  label="On hold"
                  value={summary.onHold}
                  tone="amber"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search checklist, section, category…"
                  className="h-10 bg-white pl-9"
                />
              </div>
              <Button type="button" variant="outline" className="h-10 shrink-0 px-3 sm:px-4" onClick={openFilters} aria-label="Open issue filters">
                <SlidersHorizontal className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Filters</span>
                {[site, status, priority, ...(scope === "departmentIssues" ? [department] : [])].filter((value) => value !== "all").length > 0 && (
                  <Badge className="ml-2 hidden h-5 min-w-5 justify-center rounded-full px-1.5 sm:inline-flex">
                    {[site, status, priority, ...(scope === "departmentIssues" ? [department] : [])].filter((value) => value !== "all").length}
                  </Badge>
                )}
              </Button>
            </div>
          </div>

          <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Filter my issues</DialogTitle>
                <DialogDescription>Narrow the queue by site, status, or priority.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {scope === "departmentIssues" && <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={draftDepartment} onValueChange={setDraftDepartment}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All accessible departments</SelectItem>
                      {(query.data?.departments || []).map((entry) => <SelectItem key={entry._id} value={entry._id}>{entry.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>}
                <div className="space-y-2">
                  <Label>Site</Label>
                  <Select value={draftSite} onValueChange={setDraftSite}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All accessible sites</SelectItem>
                      {(query.data?.sites || []).map((entry) => <SelectItem key={entry._id} value={entry._id}>{entry.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={draftStatus} onValueChange={(value) => setDraftStatus(value as typeof draftStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All open statuses</SelectItem>
                      <SelectItem value="created">New</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="on_hold">On hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={draftPriority} onValueChange={(value) => setDraftPriority(value as typeof draftPriority)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All priorities</SelectItem>
                      <SelectItem value="low">Low priority</SelectItem>
                      <SelectItem value="normal">Normal priority</SelectItem>
                      <SelectItem value="high">High priority</SelectItem>
                      <SelectItem value="critical">Critical priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => { setDraftSite("all"); setDraftStatus("all"); setDraftPriority("all"); setDraftDepartment("all"); }}>Clear</Button>
                <Button type="button" onClick={applyFilters}>Apply filters</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="min-h-[420px] bg-slate-50/70">
            <div className="flex items-center justify-between border-b bg-white px-4 py-2.5 text-xs text-slate-500">
              <span>{query.data?.pagination.total || 0} matching issues</span>
              {query.isFetching && <Loader2 className="h-4 w-4 animate-spin text-violet-600" />}
            </div>

            {query.isLoading ? (
              <QueueState icon={Loader2} title="Loading your issues" description="Checking your assigned audit work…" spinning />
            ) : query.isError ? (
              <QueueState icon={AlertTriangle} title="Unable to load issues" description="Please refresh and try again." tone="error" />
            ) : !query.data?.issues.length ? (
              <QueueState icon={Inbox} title="Your queue is clear" description="No open assigned issues match these filters." />
            ) : (
              <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
                {query.data.issues.map((issue) => (
                  <IssueCard
                    key={issue._id}
                    issue={issue}
                    unread={issue.assignees.some((entry) => entry.user._id === user.id && entry.read !== true)}
                    onClick={() => selectIssue(issue)}
                  />
                ))}
              </div>
            )}

            {(query.data?.pagination.pages || 0) > 1 && (
              <div className="flex items-center justify-between border-t bg-white px-4 py-3">
                <Button variant="outline" size="sm" disabled={page <= 1 || query.isFetching} onClick={() => setPage((value) => value - 1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />Previous
                </Button>
                <span className="text-xs font-medium text-slate-500">Page {page} of {query.data?.pagination.pages}</span>
                <Button variant="outline" size="sm" disabled={page >= (query.data?.pagination.pages || 1) || query.isFetching} onClick={() => setPage((value) => value + 1)}>
                  Next<ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "rose" | "blue" | "amber";
}) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  };
  return (
    <div className={cn("min-w-24 rounded-xl border px-3 py-2", tones[tone])}>
      <strong className="block text-lg leading-none">{value}</strong>
      <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide opacity-70">
        {label}
      </span>
    </div>
  );
}

const statusStyle: Record<
  Exclude<AuditTrackerIssueStatus, "resolved">,
  { label: string; className: string }
> = {
  created: {
    label: "New",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  in_progress: {
    label: "In progress",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  on_hold: {
    label: "On hold",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
};
const priorityStyle: Record<AuditTrackerIssuePriority, string> = {
  low: "bg-slate-400",
  normal: "bg-cyan-500",
  high: "bg-orange-500",
  critical: "bg-red-600",
};

function IssueCard({
  issue,
  unread,
  onClick,
}: {
  issue: AuditTrackerIssue;
  unread: boolean;
  onClick: () => void;
}) {
  const status =
    statusStyle[issue.status as Exclude<AuditTrackerIssueStatus, "resolved">];
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full rounded-xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"
    >
      {unread && <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-violet-600 ring-4 ring-violet-100" title="Unread issue" />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-bold leading-5 text-slate-900">
            {issue.snapshot.checklistItem}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {issue.snapshot.sectionName} ·{" "}
            {issue.site.site || issue.site.stationName}
          </p>
        </div>
        <span
          className={cn(
            "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
            priorityStyle[issue.priority],
            unread && "mr-6",
          )}
          title={`${issue.priority} priority`}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge
          variant="outline"
          className={cn("h-5 text-[10px]", status.className)}
        >
          {status.label}
        </Badge>
        <Badge variant="outline" className="h-5 capitalize text-[10px]">
          {issue.priority}
        </Badge>
        <span className="ml-auto text-[10px] text-slate-400">
          {formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true })}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-slate-500">
        <span className="truncate">{issue.currentDepartment?.name || issue.snapshot.departmentName}</span>
        <span className="flex items-center font-medium text-violet-700">Open issue<ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
      </div>
    </button>
  );
}

export function IssueDetail({
  issue,
  tab,
  onTabChange,
  onBack,
  scope = "myIssues",
}: {
  issue: AuditTrackerIssue;
  tab: "details" | "history";
  onTabChange: (tab: "details" | "history") => void;
  onBack: () => void;
  scope?: "myIssues" | "departmentIssues";
}) {
  const { user } = useAuth();
  const canChangeAssignment = scope === "departmentIssues" && hasAuditTrackerDepartmentIssuesAction(user?.access, "changeAssignment");
  const [commentOpen, setCommentOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const originalComment =
    issue.response?.comment || issue.snapshot.originalComment;
  const originalPhotos = issue.response?.photos?.length
    ? issue.response.photos
    : issue.snapshot.originalPhotos || [];
  const status =
    statusStyle[issue.status as Exclude<AuditTrackerIssueStatus, "resolved">];
  const activePhoto = photoIndex === null ? null : originalPhotos[photoIndex];
  return (
    <div className="p-4 sm:p-5">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-violet-700 hover:text-violet-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to issues
      </button>
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={status.className}>
              {status.label}
            </Badge>
            <Badge className="capitalize" variant="secondary">
              <span
                className={cn(
                  "mr-1.5 h-2 w-2 rounded-full",
                  priorityStyle[issue.priority],
                )}
              />
              {issue.priority} priority
            </Badge>
            <Badge variant="outline">Occurrence {issue.occurrenceNumber}</Badge>
          </div>
          <h2 className="text-xl font-black leading-tight text-slate-900">
            {issue.snapshot.checklistItem}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {issue.snapshot.sectionName}
            {issue.snapshot.category ? ` · ${issue.snapshot.category}` : ""}
          </p>
        </div>
        <div className="text-left text-xs text-slate-500 sm:text-right">
          <p>
            Raised{" "}
            {formatDistanceToNow(new Date(issue.raisedAt), { addSuffix: true })}
          </p>
          <p className="mt-1">
            Updated{" "}
            {formatDistanceToNow(new Date(issue.updatedAt), {
              addSuffix: true,
            })}
          </p>
        </div>
      </div>

      <div className="my-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full overflow-hidden rounded-xl border bg-white p-1 sm:w-fit">
          <button
            type="button"
            onClick={() => onTabChange("details")}
            className={cn(
              "flex-1 rounded-lg px-4 py-2 text-sm font-semibold sm:flex-none",
              tab === "details"
                ? "bg-violet-600 text-white"
                : "text-slate-600 hover:bg-slate-50",
            )}
          >
            Issue details
          </button>
          <button
            type="button"
            onClick={() => onTabChange("history")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold sm:flex-none",
              tab === "history"
                ? "bg-violet-600 text-white"
                : "text-slate-600 hover:bg-slate-50",
            )}
          >
            <History className="h-4 w-4" />
            Historical issues
          </button>
        </div>
        <IssueActionDialogs issue={issue} scope={scope} />
      </div>

      {tab === "history" ? (
        <IssueHistoryPanel issue={issue} scope={scope} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metadata
              icon={MapPin}
              label="Site"
              value={issue.site.site || issue.site.stationName}
            />
            <Metadata
              icon={Building2}
              label="Current department"
              value={
                issue.currentDepartment?.name || issue.snapshot.departmentName
              }
            />
            <Metadata
              icon={CalendarClock}
              label="Audit period"
              value={`${capitalize(issue.run?.frequency)} · ${issue.run?.periodKey}`}
            />
            <Metadata
              icon={ShieldAlert}
              label="Escalation"
              value={
                issue.escalation?.level === "none"
                  ? "Not escalated"
                  : issue.currentDepartment?.name || "Escalated"
              }
            />
          </div>

          <div className="grid gap-4 xl:h-[380px] xl:grid-cols-[minmax(0,3fr)_minmax(300px,2fr)]">
            <Card className="overflow-y-auto p-4 shadow-none">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-violet-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Original store submission
                </h3>
              </div>
              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Selected status
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {issue.response?.selectedStatus?.label ||
                    issue.snapshot.statusLabel ||
                    "No status recorded"}
                </p>
              </div>
              <div className="mt-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Store comment
                </p>
                {originalComment ? (
                  <button type="button" onClick={() => setCommentOpen(true)} className="mt-1 block w-full text-left">
                    <span className="line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{originalComment}</span>
                    <span className="mt-1 block text-xs font-medium text-violet-700">View full comment</span>
                  </button>
                ) : (
                  <p className="mt-1 text-sm leading-6 text-slate-700">No comment was provided.</p>
                )}
              </div>
              {originalPhotos?.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Original photos ({originalPhotos.length})
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {originalPhotos.slice(0, 3).map((photo, index) => {
                      const imageUrl = stationAuditPhotoUrl(photo);
                      return (
                        <button
                          type="button"
                          key={`${photo}-${index}`}
                          onClick={() => setPhotoIndex(index)}
                          className="relative overflow-hidden rounded-lg border bg-slate-100 text-left"
                        >
                          <img
                            src={imageUrl}
                            alt={`Issue evidence ${index + 1}`}
                            className="aspect-video h-full w-full object-cover"
                          />
                          {index === 2 && originalPhotos.length > 3 && (
                            <span className="absolute inset-0 flex items-center justify-center bg-slate-950/65 text-lg font-bold text-white">+{originalPhotos.length - 2}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>

            <div className="min-h-0 overflow-y-auto">
              <IssueActivityPanel issueId={issue._id} scope={scope} />
            </div>
          </div>

          <Card className="p-4 shadow-none">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-violet-600" /><h3 className="text-sm font-bold text-slate-800">Assigned team</h3></div>
              {canChangeAssignment && <IssueAssignmentDialog issue={issue} />}
            </div>
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
              {issue.assignees.map((assignee) => (
                <div key={assignee.user._id} className="flex min-w-64 shrink-0 items-center justify-between rounded-xl border bg-slate-50 px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{personName(assignee.user)}</p>
                    <p className="truncate text-xs text-slate-500">{assignee.user.email}</p>
                  </div>
                  <Badge variant="outline" className="ml-3 capitalize">{assignee.role}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Original store comment</DialogTitle>
            <DialogDescription>Comment submitted when the issue was raised.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            {originalComment}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={photoIndex !== null} onOpenChange={(open) => !open && setPhotoIndex(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-5xl overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4 pr-12">
            <DialogTitle>Original store photos</DialogTitle>
            <DialogDescription>{photoIndex !== null ? `Photo ${photoIndex + 1} of ${originalPhotos.length}` : ''}</DialogDescription>
          </DialogHeader>
          {activePhoto && (
            <div className="relative flex min-h-[50vh] items-center justify-center bg-slate-950 p-3 sm:min-h-[65vh]">
              <img src={stationAuditPhotoUrl(activePhoto)} alt={`Issue evidence ${(photoIndex || 0) + 1}`} className="max-h-[70vh] max-w-full object-contain" />
              {originalPhotos.length > 1 && (
                <>
                  <Button type="button" size="icon" variant="secondary" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full" onClick={() => setPhotoIndex((current) => current === null ? 0 : (current - 1 + originalPhotos.length) % originalPhotos.length)} aria-label="Previous photo">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button type="button" size="icon" variant="secondary" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full" onClick={() => setPhotoIndex((current) => current === null ? 0 : (current + 1) % originalPhotos.length)} aria-label="Next photo">
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}
              <Button type="button" variant="secondary" size="sm" className="absolute bottom-3 right-3" onClick={() => window.open(stationAuditPhotoUrl(activePhoto), '_blank', 'noopener,noreferrer')}>
                <ExternalLink className="mr-1.5 h-4 w-4" />Open in new tab
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metadata({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p
        className="mt-1.5 truncate text-sm font-semibold text-slate-800"
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function QueueState({
  icon: Icon,
  title,
  description,
  spinning = false,
  tone = "default",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  spinning?: boolean;
  tone?: "default" | "error";
}) {
  return (
    <div className="flex min-h-80 items-center justify-center p-8 text-center">
      <div>
        <Icon
          className={cn(
            "mx-auto h-9 w-9",
            spinning && "animate-spin",
            tone === "error" ? "text-rose-500" : "text-slate-300",
          )}
        />
        <h2
          className={cn(
            "mt-3 font-semibold",
            tone === "error" ? "text-rose-700" : "text-slate-700",
          )}
        >
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function personName(
  person?: { firstName?: string; lastName?: string; email?: string } | null,
) {
  return (
    `${person?.firstName || ""} ${person?.lastName || ""}`.trim() ||
    person?.email ||
    "Unknown user"
  );
}

function capitalize(value?: string) {
  if (!value) return "Not available";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
