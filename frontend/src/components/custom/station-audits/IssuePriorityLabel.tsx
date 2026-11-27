import { Flag } from "lucide-react";
import type { AuditTrackerIssuePriority } from "@/api/audit-tracker/audit-tracker.types";

export const priorityFooterStyle = {
  critical: "border-red-100 bg-red-50",
  high: "border-yellow-100 bg-yellow-50",
  normal: "border-blue-100 bg-blue-50",
  low: "border-slate-200 bg-slate-50",
} satisfies Record<AuditTrackerIssuePriority, string>;

const priorityColors = {
  critical: "text-red-700",
  high: "text-yellow-700",
  normal: "text-blue-700",
  low: "text-slate-500",
} satisfies Record<AuditTrackerIssuePriority, string>;

export function IssuePriorityLabel({ priority }: { priority: AuditTrackerIssuePriority }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium">
      <Flag className={`size-3 ${priorityColors[priority]}`} aria-hidden="true" />
      <span className="capitalize text-slate-700">{priority}</span>
      <span className="sr-only">priority</span>
    </span>
  );
}
