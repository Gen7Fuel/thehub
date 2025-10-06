import { createFileRoute } from "@tanstack/react-router";
import { useContext, useEffect, useState } from "react";
import { RouteContext } from "../checklist";
import { OpenIssueCard } from "@/components/custom/OpenIssueCard";

interface OpenIssue {
  _id?: string;
  item: string;
  category?: string;
  checked?: boolean;
  issueRaised?: boolean;
  currentIssueStatus?: string;
  timestamp?: string;
  assignedTo?: string;
  comments?: string;
  images?: string[];
}


export const Route = createFileRoute("/_navbarLayout/audit/checklist/open-issues")({
  component: OpenIssuesPage,
});

export function OpenIssuesPage() {
  const { stationName } = useContext(RouteContext);
  const site = stationName || localStorage.getItem("location") || "";

  const [openIssues, setOpenIssues] = useState<OpenIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!site) return;

    setLoading(true);

    fetch(`/api/audit/open-issues?site=${encodeURIComponent(site)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((res) => res.json())
      .then((data) => {
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
        {openIssues.map((issue, idx) => (
          <OpenIssueCard
            key={idx}
            issue={issue}
            borderColor={categoryColorMap[issue.category || ""]?.border} // pass the string
          />
        ))}
      </div>
    </div>
  );
}
