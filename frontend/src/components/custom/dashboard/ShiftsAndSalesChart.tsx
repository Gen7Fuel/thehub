"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MultiLineChartToolTip } from "@/components/ui/chart";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShiftsAndSalesChartProps {
  timesheetData: any[];
  className?: string;
}

const CHART_CONFIG = {
  approvedCost: {
    label: "Approved Shift Cost",
    color: "#22c55e",
  },
  pendingCost: {
    label: "Pending Shift Cost",
    color: "#eab308",
  },
  expectedCost: {
    label: "Avg Cost (By Day)",
    color: "#ef4444", // Red dotted baseline target
  },
  sales: {
    label: "Total Sales",
    color: "#2563eb",
  },
  transactions: {
    label: "Transactions",
    color: "#a855f7",
  },
};

export function ShiftsAndSalesChart({
  timesheetData,
  className,
}: ShiftsAndSalesChartProps) {
  const [pageIndex, setPageIndex] = useState(0);

  // 1. Process Enriched Data & Calculate Day-of-Week Average Ratios
  const { combinedData, dayOfWeekAvgRatios } = useMemo(() => {
    if (!timesheetData || timesheetData.length === 0) {
      return { combinedData: [], dayOfWeekAvgRatios: new Map<number, number>() };
    }

    const aggregatedMap = new Map<
      string,
      {
        approvedCost: number;
        pendingCost: number;
        sales: number;
        transactions: number;
        date: string;
        dayLabel: string;
        dayOfWeek: number;
      }
    >();

    timesheetData.forEach((item) => {
      const dateStr = item.LaborDate || item.date || item.Date;
      if (!dateStr) return;

      const formattedDate = String(dateStr).slice(0, 10);
      const dayLabel = formattedDate.slice(5, 10);
      const dateObj = new Date(formattedDate);
      const dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

      if (!aggregatedMap.has(formattedDate)) {
        aggregatedMap.set(formattedDate, {
          approvedCost: 0,
          pendingCost: 0,
          sales: Number(item.totalSales || item.sales || 0),
          transactions: Number(item.transactions || item.Transactions || 0),
          date: formattedDate,
          dayLabel,
          dayOfWeek,
        });
      }

      const rec = aggregatedMap.get(formattedDate)!;
      const approved = Number(item.ApprovedLaborCost ?? item.approvedLaborCost ?? 0);
      const pending = Number(item.PendingLaborCost ?? item.pendingLaborCost ?? 0);

      if (approved > 0 || pending > 0) {
        rec.approvedCost += approved;
        rec.pendingCost += pending;
      } else {
        const cost = Number(item.ActualLaborCost ?? item.ShiftCost ?? item.cost ?? item.amount ?? 0);
        const status = String(item.Status || item.status || "").toLowerCase();

        if (status === "approved" || status === "completed" || !status) {
          rec.approvedCost += cost;
        } else {
          rec.pendingCost += cost;
        }
      }
    });

    const rawList = Array.from(aggregatedMap.values());

    // Step 1a: Calculate average Labor-to-Sales ratio per Day of Week (0-6)
    const dayRatiosMap = new Map<number, number[]>();
    rawList.forEach((d) => {
      const totalCost = d.approvedCost + d.pendingCost;
      if (d.sales > 0 && totalCost > 0) {
        const ratio = totalCost / d.sales; // Ratio = Cost / Sales
        if (!dayRatiosMap.has(d.dayOfWeek)) {
          dayRatiosMap.set(d.dayOfWeek, []);
        }
        dayRatiosMap.get(d.dayOfWeek)!.push(ratio);
      }
    });

    const dayOfWeekAvgRatios = new Map<number, number>();
    dayRatiosMap.forEach((ratios, day) => {
      const avg = ratios.reduce((acc, curr) => acc + curr, 0) / ratios.length;
      dayOfWeekAvgRatios.set(day, avg);
    });

    // Step 1b: Map over chronologically sorted records and attach expected labor cost
    const processed = rawList
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((d) => {
        const totalCost = Math.round(d.approvedCost + d.pendingCost);
        const avgRatio = dayOfWeekAvgRatios.get(d.dayOfWeek) || 0;
        const expectedCost = Math.round(d.sales * avgRatio);

        return {
          ...d,
          day: d.dayLabel,
          approvedCost: Math.round(d.approvedCost),
          pendingCost: Math.round(d.pendingCost),
          totalCost,
          expectedCost,
          isOverTarget: totalCost > expectedCost && expectedCost > 0,
          sales: Math.round(d.sales),
          transactions: Math.round(d.transactions),
        };
      });

    return { combinedData: processed, dayOfWeekAvgRatios };
  }, [timesheetData]);

  // 2. 5-Day Pagination Window
  const pageSize = 5;
  const maxPages = Math.ceil(combinedData.length / pageSize) || 1;
  const safePageIndex = Math.min(pageIndex, Math.max(0, maxPages - 1));

  const visibleData = useMemo(() => {
    if (combinedData.length === 0) return [];
    const total = combinedData.length;
    const endIndex = total - safePageIndex * pageSize;
    const startIndex = Math.max(0, endIndex - pageSize);
    return combinedData.slice(startIndex, Math.max(0, endIndex));
  }, [combinedData, safePageIndex, pageSize]);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div>
          <CardTitle>Shifts Cost vs. Sales & Traffic</CardTitle>
          <CardDescription>
            Daily labor costs, sales, and transaction trends
          </CardDescription>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => safePageIndex < maxPages - 1 && setPageIndex((p) => p + 1)}
            disabled={safePageIndex >= maxPages - 1 || combinedData.length === 0}
            title="Previous Period"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => safePageIndex > 0 && setPageIndex((p) => p - 1)}
            disabled={safePageIndex === 0 || combinedData.length === 0}
            title="Next Period"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {visibleData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={visibleData}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />

              {/* Left Y-Axis for Labor Costs ($) */}
              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${val}`}
                tick={{ fontSize: 11 }}
              />

              {/* Right Y-Axis for Sales ($) */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
              />

              <YAxis yAxisId="transactions" hide={true} domain={["auto", "auto"]} />

              {/* Background Highlight for Days Exceeding Target Cost */}
              {visibleData.map(
                (item) =>
                  item.isOverTarget && (
                    <ReferenceArea
                      key={`over-target-${item.date}`}
                      yAxisId="left"
                      x1={item.day}
                      x2={item.day}
                      fill="#ef4444"
                      fillOpacity={0.08}
                    />
                  )
              )}

              <Tooltip content={<MultiLineChartToolTip config={CHART_CONFIG} />} />

              {/* Stacked Shift Labor Cost Bars */}
              <Bar
                yAxisId="left"
                dataKey="approvedCost"
                name={CHART_CONFIG.approvedCost.label}
                stackId="cost"
                fill={CHART_CONFIG.approvedCost.color}
                barSize={24}
              />
              <Bar
                yAxisId="left"
                dataKey="pendingCost"
                name={CHART_CONFIG.pendingCost.label}
                stackId="cost"
                fill={CHART_CONFIG.pendingCost.color}
                barSize={24}
                radius={[4, 4, 0, 0]}
              />

              {/* Dotted Step/Baseline Line for Target Labor Cost */}
              <Line
                yAxisId="left"
                type="stepAfter"
                dataKey="expectedCost"
                name={CHART_CONFIG.expectedCost.label}
                stroke={CHART_CONFIG.expectedCost.color}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
              />

              {/* Sales Line */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="sales"
                name={CHART_CONFIG.sales.label}
                stroke={CHART_CONFIG.sales.color}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />

              {/* Transactions Line */}
              <Line
                yAxisId="transactions"
                type="monotone"
                dataKey="transactions"
                name={CHART_CONFIG.transactions.label}
                stroke={CHART_CONFIG.transactions.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[260px] items-center justify-center text-muted-foreground text-sm">
            No timesheet data available
          </div>
        )}

        {/* Updated Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          {Object.entries(CHART_CONFIG).map(([key, config]) => (
            <div key={key} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-sm shrink-0"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-xs font-medium text-slate-700">
                {config.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground">
        Showing 5-day window ({safePageIndex * 5} days back)
      </CardFooter>
    </Card>
  );
}