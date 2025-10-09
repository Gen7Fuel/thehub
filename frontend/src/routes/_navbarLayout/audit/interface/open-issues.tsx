import { createFileRoute } from "@tanstack/react-router";
import { useContext, useEffect, useState } from "react";
import axios from "axios";
import { RouteContext } from "../interface";
import { OpenIssueCard } from "@/components/custom/OpenIssueCard";
import {Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
}

interface SelectOption {
  text: string;
  _id: string;
}

interface SelectTemplate {
  _id: string;
  name: string;
  options: SelectOption[];
}

export const Route = createFileRoute("/_navbarLayout/audit/interface/open-issues")({
  component: OpenIssuesPage,
});

export function OpenIssuesPage() {
  const { stationName } = useContext(RouteContext);
  const site = stationName || localStorage.getItem("location") || "";

  const [openIssues, setOpenIssues] = useState<OpenIssue[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectTemplates, setSelectTemplates] = useState<SelectTemplate[]>([]);
  const [department, setDepartment] = useState<string>("All");

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState("Created");

  // Load select templates (Assigned To options)
  useEffect(() => {
    const token = localStorage.getItem("token");
    axios
      .get("/api/audit/select-templates", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setSelectTemplates(res.data || []))
      .catch(() => setSelectTemplates([]));
  }, []);

  const getOptionsByName = (name: string) =>
    selectTemplates.find((t) => t.name === name)?.options || [];

  // Fetch open issues
  useEffect(() => {
    if (!site) return;
    setLoading(true);

    const params = new URLSearchParams({ site });
    if (department && department !== "All") params.append("assignedTo", department);

    fetch(`/api/audit/open-issues?${params.toString()}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setOpenIssues(data);
        else if (data?.items && Array.isArray(data.items)) setOpenIssues(data.items);
        else setOpenIssues([]);
      })
      .catch((err) => {
        console.error("Failed to load open issues:", err);
        setOpenIssues([]);
      })
      .finally(() => setLoading(false));
  }, [site, department]);

  // Category legend
  const categories = [...new Set(openIssues.map((i) => i.category).filter(Boolean))];
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
        },
        body: JSON.stringify({ status: newStatus }),
      });

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

  const statusFlow: Record<string, string | null> = {
    Created: "In Progress",
    "In Progress": "Resolved",
    Resolved: null,
  };


  return (
    <div className="flex flex-col items-center p-4">
      {/* Department filter */}
      <div className="w-full flex justify-center mb-4">
        <div className="w-[260px]">
          <label className="block mb-2 text-sm font-medium text-gray-700 text-center">
            Filter by Department
          </label>
          <Select value={department} onValueChange={(val) => setDepartment(val)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              {getOptionsByName("Assigned To").map((opt) => (
                <SelectItem key={opt._id} value={opt.text}>
                  {opt.text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Category legend */}
      <div className="flex justify-center mb-4">
        <div className="flex gap-4 flex-wrap justify-center max-w-3xl">
          {categories
            .filter((c): c is string => !!c)
            .map((cat) => {
              const { border, bg } = categoryColorMap[cat];
              return (
                <div key={cat} className={`flex items-center gap-1 px-2 py-1 rounded border ${border}`}>
                  <div className={`w-4 h-4 ${bg} rounded-sm`} />
                  <span className="text-sm">{cat}</span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Loading / empty */}
      {loading ? (
        <div className="text-center mt-8">Loading...</div>
      ) : !openIssues.length ? (
        <div className="text-center mt-8">No open issues found.</div>
      ) : (
        <div className="w-full max-w-3xl flex flex-col gap-4">
          {openIssues.map((issue) => (
            <OpenIssueCard
              key={issue._id}
              issue={issue}
              mode="interface"
              borderColor={categoryColorMap[issue.category || ""]?.border}
              onUpdateClick={handleStatusUpdateClick} // use centralized handler
            />
          ))}
        </div>
      )}

      {/* Status update dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Issue Status</DialogTitle>
          </DialogHeader>
          <div className="mt-3">
            {selectedIssueId && (
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="border rounded px-2 py-1 w-full"
              >
                {/* Always include the current status */}
                <option value={newStatus}>{newStatus}</option>

                {/* Show only the next step if it exists */}
                {statusFlow[newStatus] && (
                  <option value={statusFlow[newStatus]!}>{statusFlow[newStatus]}</option>
                )}
              </select>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setStatusDialogOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleSaveStatus}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
