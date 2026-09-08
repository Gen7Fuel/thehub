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
  timesheetData: any[]; // Accepts enriched employeeTimesheets directly
  className?: string;
}

const CHART_CONFIG = {
  approvedCost: {
    label: "Approved Shift Cost",
    color: "#22c55e", // Green
  },
  pendingCost: {
    label: "Pending Shift Cost",
    color: "#eab308", // Yellow
  },
  sales: {
    label: "Total Sales",
    color: "#2563eb", // Blue
  },
};

export function ShiftsAndSalesChart({
  timesheetData,
  className,
}: ShiftsAndSalesChartProps) {
  // Page index for 7-day pagination over historical data
  const [pageIndex, setPageIndex] = useState(0);

  // 1. Process Enriched Timesheet Data Directly
    const combinedData = useMemo(() => {
    if (!timesheetData || timesheetData.length === 0) return [];

    const aggregatedMap = new Map<
        string,
        {
        approvedCost: number;
        pendingCost: number;
        sales: number;
        date: string;
        dayLabel: string;
        }
    >();

    timesheetData.forEach((item) => {
        const dateStr = item.LaborDate || item.date || item.Date;
        if (!dateStr) return;

        const formattedDate = String(dateStr).slice(0, 10);
        const dayLabel = formattedDate.slice(5, 10); // MM-DD format

        if (!aggregatedMap.has(formattedDate)) {
        aggregatedMap.set(formattedDate, {
            approvedCost: 0,
            pendingCost: 0,
            sales: Number(item.totalSales || 0),
            date: formattedDate,
            dayLabel,
        });
        }

        const rec = aggregatedMap.get(formattedDate)!;

        // ✅ Read pre-aggregated Approved / Pending labor cost fields from API
        const approved = Number(
        item.ApprovedLaborCost ?? item.approvedLaborCost ?? 0
        );
        const pending = Number(
        item.PendingLaborCost ?? item.pendingLaborCost ?? 0
        );

        // ✅ If costs are already split into ApprovedLaborCost and PendingLaborCost
        if (approved > 0 || pending > 0) {
        rec.approvedCost += approved;
        rec.pendingCost += pending;
        } else {
        // Fallback for individual shift records with Status and ShiftCost
        const cost = Number(
            item.ActualLaborCost ?? item.ShiftCost ?? item.cost ?? item.amount ?? 0
        );
        const status = String(item.Status || item.status || "").toLowerCase();

        if (status === "approved" || status === "completed" || !status) {
            rec.approvedCost += cost;
        } else {
            rec.pendingCost += cost;
        }
        }
    });

    // Sort chronologically
    return Array.from(aggregatedMap.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((d) => ({
        ...d,
        day: d.dayLabel,
        approvedCost: Math.round(d.approvedCost),
        pendingCost: Math.round(d.pendingCost),
        sales: Math.round(d.sales),
        }));
    }, [timesheetData]);

  // 2. Paginate Data (7 days per page)
  const pageSize = 7;
  const maxPages = Math.ceil(combinedData.length / pageSize) || 1;
  const safePageIndex = Math.min(pageIndex, Math.max(0, maxPages - 1));

  const visibleData = useMemo(() => {
    if (combinedData.length === 0) return [];

    const total = combinedData.length;
    const endIndex = total - safePageIndex * pageSize;
    const startIndex = Math.max(0, endIndex - pageSize);

    return combinedData.slice(startIndex, Math.max(0, endIndex));
  }, [combinedData, safePageIndex, pageSize]);

  // Date range label
  const currentRangeLabel = useMemo(() => {
    if (visibleData.length === 0) return "";
    const start = visibleData[0]?.day;
    const end = visibleData[visibleData.length - 1]?.day;
    return `${start} to ${end}`;
  }, [visibleData]);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div>
          <CardTitle>Shifts Cost vs. Daily Sales</CardTitle>
          <CardDescription>
            Labor expenses (Approved vs. Pending) overlaid with merged daily sales
          </CardDescription>
        </div>

        {/* Week Pagination */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground mr-1 hidden sm:inline-block">
            {currentRangeLabel}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => safePageIndex < maxPages - 1 && setPageIndex((p) => p + 1)}
            disabled={safePageIndex >= maxPages - 1 || combinedData.length === 0}
            title="Previous Week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => safePageIndex > 0 && setPageIndex((p) => p - 1)}
            disabled={safePageIndex === 0 || combinedData.length === 0}
            title="Next Week"
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

              {/* Left Axis for Shift Costs */}
              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${val}`}
                tick={{ fontSize: 11 }}
              />

              {/* Right Axis for Total Daily Sales */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
              />

              <Tooltip
                content={<MultiLineChartToolTip config={CHART_CONFIG} />}
              />

              {/* Stacked Shift Labor Costs */}
              <Bar
                yAxisId="left"
                dataKey="approvedCost"
                name={CHART_CONFIG.approvedCost.label}
                stackId="cost"
                fill={CHART_CONFIG.approvedCost.color}
                barSize={28}
              />
              <Bar
                yAxisId="left"
                dataKey="pendingCost"
                name={CHART_CONFIG.pendingCost.label}
                stackId="cost"
                fill={CHART_CONFIG.pendingCost.color}
                barSize={28}
                radius={[4, 4, 0, 0]}
              />

              {/* Merged Total Sales Line */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="sales"
                name={CHART_CONFIG.sales.label}
                stroke={CHART_CONFIG.sales.color}
                strokeWidth={3}
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

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-4">
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
        Showing 7-day window ({safePageIndex * 7} days back)
      </CardFooter>
    </Card>
  );
}