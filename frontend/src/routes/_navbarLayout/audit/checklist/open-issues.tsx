import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
// import { RouteContextChecklist } from "../checklist";
import { OpenIssueCard } from "@/components/custom/OpenIssueCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { STATUS_PRIORITY, statusFlow } from "../interface/open-issues";


interface OpenIssue {
  _id: string;
  item: string;
  category?: string;
  checked?: boolean;
  issueRaised?: boolean;
  currentIssueStatus?: string;
  lastUpdated?: string;
  assignedTo?: string;
  comment?: string;
  photos?: string[];
  status?: string;
}


export const Route = createFileRoute("/_navbarLayout/audit/checklist/open-issues")({
  validateSearch: (search: { site?: string }) => ({
    site: search.site,
  }),
  component: OpenIssuesPage,
});

export function OpenIssuesPage() {
  // const { stationName } = useContext(RouteContextChecklist);
  const { user } = useAuth()
  const { site } = Route.useSearch() || user?.location;
  // const site = stationName || user?.location || "";
  const navigate = useNavigate()

  const [openIssues, setOpenIssues] = useState<OpenIssue[]>([]);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState("Created");

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!site) return;

    setLoading(true);

    fetch(`/api/audit/open-issues?mode=station&site=${encodeURIComponent(site)}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        "X-Required-Permission": "stationAudit",
      },
    })
      .then((res) => {
        if (res.status === 403) {
          navigate({ to: "/no-access" });
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return; // 403 redirect already handled

        if (Array.isArray(data)) {
          setOpenIssues(data);
        } else if (data?.items && Array.isArray(data.items)) {
          setOpenIssues(data.items);
        } else {
          setOpenIssues([]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [site]);


  const categories = [...new Set(openIssues.map(issue => issue.category).filter(Boolean))];

  const CATEGORY_COLOR_CLASSES = [
    { border: "border-purple-200", bg: "bg-purple-200" },
    { border: "border-orange-200", bg: "bg-orange-200" },
    { border: "border-pink-200", bg: "bg-pink-200" },
    { border: "border-indigo-200", bg: "bg-indigo-200" },
    { border: "border-teal-200", bg: "bg-teal-200" },
    { border: "border-cyan-200", bg: "bg-cyan-200" },
    { border: "border-yellow-200", bg: "bg-yellow-200" },
  ];

  const categoryColorMap: Record<string, { border: string; bg: string }> = {};
  categories.forEach((cat, idx) => {
    const key = cat ?? "unknown";
    categoryColorMap[key] = CATEGORY_COLOR_CLASSES[idx % CATEGORY_COLOR_CLASSES.length];
  });

  // Trigger dialog for selected issue
  const handleStatusUpdateClick = (id: string, currentStatus?: string) => {
    setSelectedIssueId(id);
    setNewStatus(currentStatus || "Created");
    setStatusDialogOpen(true);
  };

  // Save status
  const handleSaveStatus = async () => {
    if (!selectedIssueId) return;

    try {
      const res = await fetch(`/api/audit/issues/${selectedIssueId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "X-Required-Permission": "stationAudit",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.status === 403) {
        navigate({ to: "/no-access" });
        return;
      }

      if (!res.ok) throw new Error("Failed to update status");

      const data = await res.json();

      // Update locally
      setOpenIssues((prev) =>
        prev.map((it) =>
          it._id === selectedIssueId
            ? {
              ...it,
              currentIssueStatus: data.item.currentIssueStatus,
              lastUpdated: new Date().toISOString(),
              issueRaised: data.item.issueRaised,
            }
            : it
        )
      );

      setStatusDialogOpen(false);
      setSelectedIssueId(null);
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  if (loading) return <div className="text-center mt-8">Loading...</div>;
  if (!openIssues.length) return <div className="text-center mt-8">No open issues found.</div>;

  return (
    <div className="flex flex-col items-center p-4">
      {/* Categories Legend */}
      <div className="flex gap-4 mb-4 flex-wrap">
        {categories.filter((cat): cat is string => !!cat).map((cat) => {
          const { border, bg } = categoryColorMap[cat];
          return (
            <div key={cat} className={`flex items-center gap-1 px-2 py-1 rounded border ${border}`}>
              <div className={`w-4 h-4 ${bg} rounded-sm`}></div>
              <span className="text-sm">{cat}</span>
            </div>
          );
        })}
      </div>

      <div className="w-full max-w-3xl flex flex-col gap-4">
        {[...openIssues]
          .sort((a, b) => {
            const priorityA = STATUS_PRIORITY[a.currentIssueStatus || "Created"] ?? 99;
            const priorityB = STATUS_PRIORITY[b.currentIssueStatus || "Created"] ?? 99;

            if (priorityA !== priorityB) {
              return priorityA - priorityB;
            }

            // If status is the same, sort by most recently updated
            return new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime();
          }).map((issue, idx) => (
            <OpenIssueCard
              key={idx}
              issue={issue}
              mode="station"
              onUpdateClick={handleStatusUpdateClick}
              borderColor={categoryColorMap[issue.category || ""]?.border} // pass the string
            />
          ))}
      </div>

      {/* Status update dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Issue Status</DialogTitle>
          </DialogHeader>
          <div className="mt-3">
            {selectedIssueId && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-500">Select New Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="border rounded px-3 py-2 w-full bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {/* Find the original status of the issue to keep it as an option */}
                  <option value={newStatus}>{newStatus} (Current)</option>

                  {/* Map through all possible next steps defined in statusFlow */}
                  {(statusFlow[newStatus] || []).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button onClick={() => setStatusDialogOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleSaveStatus}>Update Status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}