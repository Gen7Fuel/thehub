import { useState } from "react";
import type { StationAuditSectionListReadModel } from "@/api/station-audits/station-audits.types";
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

const getReadablePeriod = (freq: string, periodKey: string, stationWeek: boolean) => {
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

    const januaryFirst = new Date(yearNum, 0, 1);
    const weekOffset = stationWeek ? januaryFirst.getDay() : (januaryFirst.getDay() + 6) % 7;
    const startOfWeek = new Date(yearNum, 0, 1 - weekOffset + (weekNum - 1) * 7);
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

const frequencies = ["daily", "weekly", "monthly"] as const;
type Frequency = typeof frequencies[number];

type Progress = { total: number; completed: number; issues: number };
type LegacyChartProps = {
  auditStats: {
    summary: Record<Frequency, Progress>;
    checklists: Array<{ templateName: string; stats: Record<Frequency, Progress> }>;
  };
  periodKeys: Record<Frequency, string>;
  timezone: string;
};

export function AuditSummaryChart(props: { auditStats: StationAuditSectionListReadModel } | LegacyChartProps) {
  const legacy = "periodKeys" in props ? props : null;
  const stationAudits = "sections" in props.auditStats ? props.auditStats : null;
  const periodKeys = legacy?.periodKeys ?? stationAudits?.periodKeys;
  const timezone = legacy?.timezone || stationAudits?.location.timezone || "America/Toronto";
  const sections = stationAudits?.sections ?? [];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFreq, setSelectedFreq] = useState<Frequency | null>(null);

  const summary = legacy?.auditStats.summary ?? Object.fromEntries(frequencies.map((freq) => [
    freq,
    sections.reduce((totals, section) => {
      const stats = section.frequencies[freq];
      return {
        total: totals.total + stats.total,
        completed: totals.completed + stats.completed,
        issues: totals.issues + stats.issues,
      };
    }, { total: 0, completed: 0, issues: 0 }),
  ]));

  const chartData = frequencies.map((freq) => {
    const s = summary[freq];
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

  const modalRows = selectedFreq
    ? (legacy ? legacy.auditStats.checklists.map((checklist) => ({
        id: checklist.templateName,
        name: checklist.templateName,
        stats: checklist.stats[selectedFreq],
      })) : sections.map((section) => ({
        id: section._id,
        name: section.name,
        stats: section.frequencies[selectedFreq],
      }))).filter((section) => section.stats.total > 0)
    : [];

  const openBreakdown = ({ freq }: { freq: Frequency }) => {
    setSelectedFreq(freq);
    setIsModalOpen(true);
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
            style={{ cursor: 'pointer' }}
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

            <Bar dataKey="clean" stackId="a" barSize={45} onClick={(entry) => openBreakdown(entry.payload)}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getUrgencyColor(entry.freq, entry.percentage, timezone)} />
              ))}
            </Bar>

            <Bar dataKey="issues" stackId="a" fill="#ff1d1d" onClick={(entry) => openBreakdown(entry.payload)} />

            <Bar dataKey="pending" stackId="a" fill="#f1f5f9" onClick={(entry) => openBreakdown(entry.payload)}>
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
                {selectedFreq && periodKeys && getReadablePeriod(selectedFreq, periodKeys[selectedFreq], !legacy)}
              </span>
              <span>
                <strong>Summary: </strong>
                {selectedFreq && summary[selectedFreq].completed} / {selectedFreq && summary[selectedFreq].total} Items Completed
                <span
                  className={`ml-2 font-bold ${selectedFreq && summary[selectedFreq].issues > 0
                    ? "text-red-600"
                    : "text-slate-500"
                    }`}
                >
                  ({selectedFreq && summary[selectedFreq].issues} Issues)
                </span>
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 border rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-slate-700">{legacy ? "Checklist Name" : "Section"}</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-700">Progress</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-700">Issues Raised</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {modalRows.map((cl) => (
                  <tr key={cl.id} className="hover:bg-slate-50 transition-colors">
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
