import { useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis, Cell } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// Helper for Urgency Color
const getUrgencyColor = (freq: string, percent: number, timezone: string) => {
  if (percent === 100) return "#22c55e"; // Success Green

  // 1. Get the current time adjusted to the site's timezone
  const siteDateString = new Date().toLocaleString("en-US", { timeZone: timezone });
  const siteDate = new Date(siteDateString);

  // 2. Extract hour and day from the site-specific date
  const hour = siteDate.getHours();
  const day = siteDate.getDay(); // 0 (Sun) to 6 (Sat)

  // 3. Logic based on site time
  if (freq === "daily" && hour >= 16) return "#ffa047"; // Orange alert after 4 PM site time
  if (freq === "weekly" && day >= 4) return "#ffa047";  // Orange alert Thursday onwards site time

  return "#3b82f6"; // Default Blue
};

const getReadablePeriod = (freq: string, periodKey: string) => {
  if (!periodKey) return "";

  if (freq === "daily") {
    // Input: "2025-09-26" -> Output: "Sep 26, 2025"
    return new Date(periodKey + "T00:00:00").toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  if (freq === "weekly") {
    // Input: "2025-W39"
    const [year, weekStr] = periodKey.split("-W");
    const yearNum = parseInt(year);
    const weekNum = parseInt(weekStr);

    // 1. Get the first day of the year
    // const startOfYear = new Date(yearNum, 0, 1);

    // 2. Calculate the days to add
    // (weekNum - 1) * 7 gets us to the correct week
    const daysToAdd = (weekNum - 1) * 7;
    const targetDate = new Date(yearNum, 0, 1 + daysToAdd);

    // 3. Adjust to Monday
    // In JS: Sun=0, Mon=1, Tue=2...
    // We want to find how far we are from Monday (1)
    const dayIndex = targetDate.getDay();
    const diffToMonday = targetDate.getDate() - dayIndex + (dayIndex === 0 ? -6 : 1);

    const startOfWeek = new Date(targetDate.setDate(diffToMonday));
    startOfWeek.setHours(0, 0, 0, 0);

    // 4. End of week is Sunday (Start + 6 days)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    return `${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`;
  }

  if (freq === "monthly") {
    // Input: "2025-09"
    const [year, month] = periodKey.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString("default", { month: "long", year: "numeric" });
  }

  return periodKey;
};

// Pass periodKeys as an object: { daily: "2024-W10", ... }
export function AuditSummaryChart({ auditStats, periodKeys, timezone }: { auditStats: any, periodKeys: any, timezone: any }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFreq, setSelectedFreq] = useState<string | null>(null);

  // 1. Format Summary Data as Percentages
  const chartData = Object.keys(auditStats.summary).map((freq) => {
    const s = auditStats.summary[freq];
    const total = s.total || 0;

    // Calculate percentages for the stacked bars
    const cleanPct = total > 0 ? ((s.completed - s.issues) / total) * 100 : 0;
    const issuesPct = total > 0 ? (s.issues / total) * 100 : 0;
    const pendingPct = total > 0 ? ((total - s.completed) / total) * 100 : 100;

    return {
      freq,
      clean: cleanPct,
      issues: issuesPct,
      pending: pendingPct,
      actualCompleted: s.completed,
      actualTotal: total,
      actualIssues: s.issues,
      percentage: total > 0 ? (s.completed / total) * 100 : 0
    };
  });

  const getModalData = () => {
    if (!selectedFreq) return [];
    return auditStats.checklists.map((cl: any) => ({
      name: cl.templateName,
      stats: cl.stats[selectedFreq]
    })).filter((cl: any) => cl.stats.total > 0);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Audit Completion Status</CardTitle>
        <CardDescription>Overall progress by percentage. Click bars for details.</CardDescription>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ left: 5, right: 60, top: 10, bottom: 10 }}
            // This ensures clicking the "empty" grey area still triggers the modal
            onClick={(state) => {
              if (state && state.activePayload) {
                const clickedData = state.activePayload[0].payload;
                setSelectedFreq(clickedData.freq);
                setIsModalOpen(true);
              }
            }}
            style={{ cursor: 'pointer' }} // Visual cue that the whole row is interactive
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              dataKey="freq"
              type="category"
              tickFormatter={(val) =>
                `${val.charAt(0).toLocaleUpperCase()}${val.slice(1)} Checklists`
              }
              fontSize={13}
              fontWeight={600}
              axisLine={false}
              tickLine={false}
            />

            {/* Segments - No longer need individual onClicks */}
            <Bar dataKey="clean" stackId="a" barSize={45}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getUrgencyColor(entry.freq, entry.percentage, timezone)} />
              ))}
            </Bar>

            <Bar dataKey="issues" stackId="a" fill="#ff1d1d" />

            <Bar dataKey="pending" stackId="a" fill="#f1f5f9">
              <LabelList
                dataKey="actualTotal"
                position="right"
                content={(props: any) => {
                  const entry = chartData[props.index];
                  return (
                    <text x={props.x + 10} y={props.y + props.height / 2 + 5} fontSize={14} fill="#64748b" fontWeight="bold">
                      {entry.actualCompleted}/{props.value}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Legend Section */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-4 border-t border-slate-100">
          {[
            { color: "#22c55e", label: "Completed" },
            { color: "#3b82f6", label: "In Progress" },
            { color: "#ffa047", label: "Due Soon" },
            { color: "#ff1d1d", label: "Issues" },
            { color: "#f1f5f9", label: "Pending", border: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{
                  backgroundColor: item.color,
                  border: item.border ? "1px solid #e2e8f0" : "none"
                }}
              />
              <span className="text-sm font-medium text-black">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="capitalize text-2xl">
              {selectedFreq} Audit Breakdown
            </DialogTitle>
            <DialogDescription className="text-md flex flex-col gap-1">
              <span className="text-slate-700">
                <strong>Period: </strong>
                {selectedFreq && getReadablePeriod(selectedFreq, periodKeys[selectedFreq])}
              </span>
              <span>
                <strong>Summary: </strong>
                {selectedFreq && auditStats.summary[selectedFreq].completed} / {selectedFreq && auditStats.summary[selectedFreq].total} Items Completed
                <span
                  className={`ml-2 font-bold ${selectedFreq && auditStats.summary[selectedFreq].issues > 0
                    ? "text-red-600"
                    : "text-slate-500"
                    }`}
                >
                  ({selectedFreq && auditStats.summary[selectedFreq].issues} Issues)
                </span>
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 border rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-slate-700">Checklist Name</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-700">Progress</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-700">Issues Raised</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {getModalData().map((cl: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{cl.name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${cl.stats.completed === cl.stats.total ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                        {cl.stats.completed} / {cl.stats.total}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right max-w-xs">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-extrabold border ${cl.stats.issues > 0
                          ? "bg-red-100 text-red-700 border-red-200" // Red for Issues
                          : "bg-slate-100 text-slate-600 border-slate-200" // Neutral for Zero
                          }`}
                      >
                        {cl.stats.issues}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}