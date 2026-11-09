import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Archive,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  MapPin,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { auditManagerService } from "@/api/audit-manager/audit-manager.service";
import type {
  AuditManagerChecklistDetail,
  AuditManagerSection,
} from "@/api/audit-manager/audit-manager.types";
import { isApiError } from "@/api/core/errors";
import { useAuth } from "@/context/AuthContext";
import {
  hasAuditManagerAccess,
  hasAuditManagerPermission,
} from "@/lib/auditManagerPermissions";

export const Route = createFileRoute(
  "/_navbarLayout/audit-manager/checklist/$sectionId",
)({ component: ChecklistSectionPage });
const frequencyOrder = { daily: 0, weekly: 1, monthly: 2 };

function ChecklistSectionPage() {
  const { sectionId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<AuditManagerSection | null>(null);
  const [checklists, setChecklists] = useState<AuditManagerChecklistDetail[]>(
    [],
  );
  const [selected, setSelected] = useState<AuditManagerChecklistDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canView =
    hasAuditManagerAccess(user?.access) &&
    hasAuditManagerPermission(user?.access, "checklist");

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
          requestError &&
            isApiError(requestError) &&
            requestError.status === 404
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

  const sortedChecklists = useMemo(
    () =>
      [...checklists].sort(
        (left, right) =>
          Number(right.active) - Number(left.active) ||
          frequencyOrder[left.frequency] - frequencyOrder[right.frequency] ||
          left.sortOrder - right.sortOrder ||
          left.item.localeCompare(right.item, undefined, {
            sensitivity: "base",
          }),
      ),
    [checklists],
  );

  if (!user) return null;
  if (!canView) return <Navigate to="/no-access" replace />;

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-10 sm:px-5">
      <div className="mb-5 rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-4 shadow-sm sm:p-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2"
          onClick={() => navigate({ to: "/audit-manager/checklist" })}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          All sections
        </Button>
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-cyan-600 p-2.5 text-white">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              {section?.name || "Checklist metadata"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {section?.description ||
                "Review active and inactive checklist definitions for this section."}
            </p>
          </div>
        </div>
      </div>
      {loading && (
        <div className="flex min-h-60 items-center justify-center rounded-2xl border border-dashed bg-white">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-cyan-600" />
          Loading checklists…
        </div>
      )}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">
          {error}
        </div>
      )}
      {!loading && !error && sortedChecklists.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-slate-500">
          No checklists exist in this section.
        </div>
      )}
      {!loading && !error && sortedChecklists.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {sortedChecklists.map((checklist) => (
            <ChecklistCard
              key={checklist._id}
              checklist={checklist}
              onOpen={() => setSelected(checklist)}
            />
          ))}
        </div>
      )}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {selected && <ChecklistDetails checklist={selected} />}
        </DialogContent>
      </Dialog>
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
    <button type="button" onClick={onOpen} className="group h-full text-left">
      <Card
        className={`h-full transition group-hover:-translate-y-0.5 group-hover:border-cyan-300 group-hover:shadow-md ${checklist.active ? "" : "bg-slate-50 opacity-60"}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base sm:text-lg">
              {checklist.item}
            </CardTitle>
            {checklist.active ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <Archive className="h-5 w-5 shrink-0 text-slate-400" />
            )}
          </div>
          {checklist.description && (
            <p className="line-clamp-2 text-sm font-normal text-slate-500">
              {checklist.description}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <Badge className="capitalize">{checklist.frequency}</Badge>
            {checklist.category && (
              <Badge variant="outline">{checklist.category}</Badge>
            )}
            {checklist.department && (
              <Badge variant="secondary">{checklist.department.name}</Badge>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
            <div className="rounded-lg bg-slate-50 p-2">
              <strong className="block text-base text-slate-800">
                {checklist.assignedSites?.length || 0}
              </strong>
              Sites
            </div>
            <div className="rounded-lg bg-slate-50 p-2">
              <strong className="block text-base text-slate-800">
                {checklist.statusOptionSet?.options?.length || 0}
              </strong>
              Statuses
            </div>
            <div className="rounded-lg bg-slate-50 p-2">
              <strong className="block text-base text-slate-800">
                {checklist.sortOrder}
              </strong>
              Order
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function ChecklistDetails({
  checklist,
}: {
  checklist: AuditManagerChecklistDetail;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{checklist.item}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge className="capitalize">{checklist.frequency}</Badge>
          <Badge variant={checklist.active ? "secondary" : "outline"}>
            {checklist.active ? "Active" : "Inactive"}
          </Badge>
          {checklist.auditTypes.map((type) => (
            <Badge key={type} variant="outline" className="capitalize">
              {type}
            </Badge>
          ))}
        </div>
        <Detail label="Description">
          <p className="text-sm text-slate-700">
            {checklist.description || "No description provided."}
          </p>
        </Detail>
        <div className="grid gap-3 sm:grid-cols-3">
          <Detail label="Category">
            <p className="text-sm">{checklist.category || "Not categorized"}</p>
          </Detail>
          <Detail label="Department">
            <p className="text-sm">
              {checklist.department?.name || "Not assigned"}
            </p>
          </Detail>
          <Detail label="Sort order">
            <p className="text-sm">{checklist.sortOrder}</p>
          </Detail>
        </div>
        <Detail
          label={`Status options (${checklist.statusOptionSet?.options?.length || 0})`}
        >
          <p className="mb-2 text-sm font-medium">
            {checklist.statusOptionSet?.name || "No option set assigned"}
          </p>
          <div className="flex flex-wrap gap-2">
            {checklist.statusOptionSet?.options?.map((option) => (
              <Badge key={option.key} variant="secondary">
                {option.label}
              </Badge>
            ))}
          </div>
        </Detail>
        <Detail
          label={`Assigned sites (${checklist.assignedSites?.length || 0})`}
        >
          <div className="flex flex-wrap gap-2">
            {checklist.assignedSites?.length ? (
              checklist.assignedSites.map((site) => (
                <Badge key={site._id} variant="outline">
                  <MapPin className="mr-1 h-3 w-3" />
                  {site.site || site.stationName}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-slate-500">No sites assigned.</span>
            )}
          </div>
        </Detail>
        <Detail label="Follow-up instructions">
          <p className="text-sm text-slate-700">
            {checklist.followUpInstructions || "No follow-up instructions."}
          </p>
        </Detail>
        <div className="grid gap-3 sm:grid-cols-2">
          <Detail label="Comment required">
            <p className="text-sm">
              {checklist.commentRequired ? "Yes" : "No"}
            </p>
          </Detail>
          <Detail label="Order request">
            <p className="text-sm">
              {checklist.requestOrderEnabled
                ? `Enabled${checklist.suppliesVendor ? ` — ${checklist.suppliesVendor}` : ""}`
                : "Disabled"}
            </p>
          </Detail>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Detail label="Created">
            <p className="text-sm">{formatDate(checklist.createdAt)}</p>
          </Detail>
          <Detail label="Last updated">
            <p className="text-sm">{formatDate(checklist.updatedAt)}</p>
          </Detail>
        </div>
      </div>
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-slate-50/70 p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-800">{label}</h3>
      {children}
    </div>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
