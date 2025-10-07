import { useEffect, useState } from "react";
import { OpenIssueCard } from "@/components/custom/OpenIssueCard";

export default function InterfaceOpenIssuesPage() {
  const [issues, setIssues] = useState<any[]>([]);
  const [department, setDepartment] = useState("all");

  // Fetch issues when department changes
  useEffect(() => {
    const url = `/api/audit/open-issues?mode=interface&assignedTo=${encodeURIComponent(department)}`;
    fetch(url, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then(res => res.json())
      .then(data => setIssues(data.items || []))
      .catch(err => console.error("Failed to load open issues:", err));
  }, [department]);

  // Extract departments dynamically for filter
  const departments = Array.from(new Set(issues.map(i => i.assignedTo))).filter(Boolean);

  return (
    <div className="p-4 space-y-4">
      {/* Department Filter */}
      <div className="flex gap-4 items-center">
        <select
          value={department}
          onChange={e => setDepartment(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="all">All Departments</option>
          {departments.map(d => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Cards */}
      {issues.length > 0 ? (
        issues.map((issue, idx) => (
          <OpenIssueCard
            key={idx}
            issue={issue}
            mode="interface"
            onStatusChange={(newStatus) => {
              fetch(`/api/issues/${issue._id}/status`, {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({ status: newStatus }),
              })
                .then(res => res.json())
                .then(updated => {
                  setIssues(prev =>
                    prev.map(it => (it._id === updated._id ? updated : it))
                  );
                });
            }}
          />
        ))
      ) : (
        <div className="text-gray-500">No open issues found.</div>
      )}
    </div>
  );
}
