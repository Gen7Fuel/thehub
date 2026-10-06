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
  AreaChart,
  Area,
} from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MultiLineChartToolTip } from "@/components/ui/chart";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShiftsAndSalesChartProps {
  timesheetData: any[];
  className?: string;
  canViewManagerHours?: boolean;
}

const MANAGER_APPROVED_COLOR = "#8b5cf6";
const MANAGER_PENDING_COLOR = "#f97316";

function getNumber(item: any, ...keys: string[]) {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && value !== "") {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    }
  }
  return 0;
}

function ChartToggle({
  id,
  checked,
  onCheckedChange,
  label,
  compact = false,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center rounded-md border border-slate-200 bg-white shadow-sm",
        compact ? "min-h-9 gap-1.5 px-2 py-1.5" : "min-h-10 gap-2 px-3 py-2",
      )}
    >
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <Label
        htmlFor={id}
        className={cn(
          "cursor-pointer whitespace-nowrap font-semibold text-slate-700",
          compact ? "text-[11px]" : "text-xs",
        )}
      >
        {label}
      </Label>
    </div>
  );
}

export function ShiftsAndSalesChart({
  timesheetData,
  className,
  canViewManagerHours = false,
}: ShiftsAndSalesChartProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [showAllSales, setShowAllSales] = useState(false); // Default: inside sales only
  const [showManagerHours, setShowManagerHours] = useState(false);
  const includeManagers = canViewManagerHours && showManagerHours;

  // Dynamic config driving Tooltip & Legend labels
  const chartConfig = useMemo(
    () => ({
      approvedCost: {
        label: "Approved Shift Cost",
        color: "#22c55e",
      },
      pendingCost: {
        label: "Pending Shift Cost",
        color: "#eab308",
      },
      managerApprovedCost: {
        label: "Manager Approved Cost",
        color: MANAGER_APPROVED_COLOR,
      },
      managerPendingCost: {
        label: "Manager Pending Cost",
        color: MANAGER_PENDING_COLOR,
      },
      expectedCost: {
        label: "Avg Cost (By Day)",
        color: "#ef4444",
      },
      sales: {
        label: showAllSales ? "All Sales" : "In Store Sales",
        color: "#00eeff",
      },
      transactions: {
        label: "Transactions",
        color: "#fd00c6",
      },
    }),
    [showAllSales]
  );

  // Process Enriched Data & Calculate Day-of-Week Average Ratios dynamically based on mode
  const { combinedData } = useMemo(() => {
    if (!timesheetData || timesheetData.length === 0) {
      return { combinedData: [] };
    }

    const aggregatedMap = new Map<
      string,
      {
        approvedCost: number;
        pendingCost: number;
        managerApprovedCost: number;
        managerPendingCost: number;
        totalSales: number;
        dispenserSales: number;
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
      const dayOfWeek = dateObj.getDay();

      if (!aggregatedMap.has(formattedDate)) {
        aggregatedMap.set(formattedDate, {
          approvedCost: 0,
          pendingCost: 0,
          managerApprovedCost: 0,
          managerPendingCost: 0,
          totalSales: Number(item.totalSales || item.sales || 0),
          dispenserSales: Number(item.dispenserSales || 0),
          transactions: Number(item.transactions || item.Transactions || 0),
          date: formattedDate,
          dayLabel,
          dayOfWeek,
        });
      }

      const rec = aggregatedMap.get(formattedDate)!;
      const approved = getNumber(
        item,
        "ApprovedLaborCost",
        "approvedLaborCost",
      );
      const pending = getNumber(
        item,
        "PendingLaborCost",
        "pendingLaborCost",
      );
      const managerApproved = getNumber(
        item,
        "ManagerApprovedLaborCost",
        "managerApprovedLaborCost",
      );
      const managerPending = getNumber(
        item,
        "ManagerPendingLaborCost",
        "managerPendingLaborCost",
      );

      if (approved > 0 || pending > 0) {
        rec.approvedCost += approved;
        rec.pendingCost += pending;
      } else {
        const cost = Number(
          item.ActualLaborCost ??
            item.ShiftCost ??
            item.cost ??
            item.amount ??
            0,
        );
        const status = String(item.Status || item.status || "").toLowerCase();

        if (status === "approved" || status === "completed" || !status) {
          rec.approvedCost += cost;
        } else {
          rec.pendingCost += cost;
        }
      }

      rec.managerApprovedCost += managerApproved;
      rec.managerPendingCost += managerPending;
    });

    // Sort chronologically and limit to the latest 60 days
    const rawList = Array.from(aggregatedMap.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-60);

    // Compute ratios based on whether All Sales or Inside Sales is selected
    const dayRatiosMap = new Map<number, number[]>();
    rawList.forEach((d) => {
      const activeSales = showAllSales
        ? d.totalSales
        : Math.max(0, d.totalSales - d.dispenserSales);

      const totalCost =
        d.approvedCost +
        d.pendingCost +
        (includeManagers ? d.managerApprovedCost + d.managerPendingCost : 0);
      if (activeSales > 0 && totalCost > 0) {
        const ratio = totalCost / activeSales;
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

    const processed = rawList.map((d) => {
      const activeSales = showAllSales
        ? d.totalSales
        : Math.max(0, d.totalSales - d.dispenserSales);

      const totalCost = Math.round(
        d.approvedCost +
          d.pendingCost +
          (includeManagers ? d.managerApprovedCost + d.managerPendingCost : 0),
      );
      const avgRatio = dayOfWeekAvgRatios.get(d.dayOfWeek) || 0;
      const expectedCost = Math.round(activeSales * avgRatio);

      return {
        ...d,
        day: d.dayLabel,
        approvedCost: Math.round(d.approvedCost),
        pendingCost: Math.round(d.pendingCost),
        managerApprovedCost: includeManagers
          ? Math.round(d.managerApprovedCost)
          : 0,
        managerPendingCost: includeManagers
          ? Math.round(d.managerPendingCost)
          : 0,
        totalCost,
        expectedCost,
        isOverTarget: totalCost > expectedCost && expectedCost > 0,
        sales: Math.round(activeSales),
        transactions: Math.round(d.transactions),
      };
    });

    return { combinedData: processed };
  }, [timesheetData, showAllSales, includeManagers]);

  // 5-Day Pagination Window
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
      <CardHeader className="flex flex-col gap-3 pb-2">
        <div>
          <CardTitle>Shifts Cost vs. Sales & Traffic</CardTitle>
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <ChartToggle
              id="all-sales-toggle"
              checked={showAllSales}
              onCheckedChange={(checked) => {
                setShowAllSales(checked);
                setPageIndex(0);
              }}
              label="All Sales"
            />

            {canViewManagerHours && (
              <ChartToggle
                id="manager-hours-toggle"
                checked={showManagerHours}
                onCheckedChange={(checked) => {
                  setShowManagerHours(checked);
                  setPageIndex(0);
                }}
                label="Manager"
              />
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                safePageIndex < maxPages - 1 && setPageIndex((p) => p + 1)
              }
              disabled={
                safePageIndex >= maxPages - 1 || combinedData.length === 0
              }
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

              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${val}`}
                tick={{ fontSize: 11 }}
              />

              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
              />

              {showAllSales && (
                <YAxis
                  yAxisId="transactions"
                  hide={true}
                  domain={["auto", "auto"]}
                />
              )}

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
                  ),
              )}

              <Tooltip
                content={<MultiLineChartToolTip config={chartConfig} />}
              />

              <Bar
                yAxisId="left"
                dataKey="approvedCost"
                name={chartConfig.approvedCost.label}
                stackId="cost"
                fill={chartConfig.approvedCost.color}
                barSize={24}
              />
              <Bar
                yAxisId="left"
                dataKey="pendingCost"
                name={chartConfig.pendingCost.label}
                stackId="cost"
                fill={chartConfig.pendingCost.color}
                barSize={24}
                radius={includeManagers ? [0, 0, 0, 0] : [4, 4, 0, 0]}
              />
              {includeManagers && (
                <>
                  <Bar
                    yAxisId="left"
                    dataKey="managerApprovedCost"
                    name={chartConfig.managerApprovedCost.label}
                    stackId="cost"
                    fill={chartConfig.managerApprovedCost.color}
                    barSize={24}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="managerPendingCost"
                    name={chartConfig.managerPendingCost.label}
                    stackId="cost"
                    fill={chartConfig.managerPendingCost.color}
                    barSize={24}
                    radius={[4, 4, 0, 0]}
                  />
                </>
              )}

              <Line
                yAxisId="left"
                type="step"
                dataKey="expectedCost"
                name={chartConfig.expectedCost.label}
                stroke={chartConfig.expectedCost.color}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
              />

              <Line
                yAxisId="right"
                type="monotone"
                dataKey="sales"
                name={chartConfig.sales.label}
                stroke={chartConfig.sales.color}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />

              {showAllSales && (
                <Line
                  yAxisId="transactions"
                  type="monotone"
                  dataKey="transactions"
                  name={chartConfig.transactions.label}
                  stroke={chartConfig.transactions.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[260px] items-center justify-center text-muted-foreground text-sm">
            No timesheet data available
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          {Object.entries(chartConfig)
            .filter(
              ([key]) =>
                (key !== "transactions" || showAllSales) &&
                (!key.startsWith("manager") || includeManagers),
            )
            .map(([key, config]) => (
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
        Showing daily labor cost, selected sales, traffic, and day-of-week average
        cost over a 5-day window ({safePageIndex * 5} -{" "}
        {(safePageIndex + 1) * 5} of {combinedData.length} days).
      </CardFooter>
    </Card>
  );
}

/* ============================================================================
   2. WEEKLY / MONTHLY AGGREGATED CHART (Space #2)
   ============================================================================ */
export function ShiftsAndSalesAggregatedChart({
  timesheetData,
  className,
  canViewManagerHours = false,
}: ShiftsAndSalesChartProps) {
  const [isMonthly, setIsMonthly] = useState(false);
  const [showAllSales, setShowAllSales] = useState(false); // Default: inside sales only
  const [showManagerHours, setShowManagerHours] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const includeManagers = canViewManagerHours && showManagerHours;

  // Dynamic config driving Tooltip & Legend labels
  const chartConfig = useMemo(
    () => ({
      approvedCost: {
        label: "Approved Cost",
        color: "#10b981",
      },
      pendingCost: {
        label: "Pending Cost",
        color: "#f59e0b",
      },
      managerApprovedCost: {
        label: "Manager Approved Cost",
        color: MANAGER_APPROVED_COLOR,
      },
      managerPendingCost: {
        label: "Manager Pending Cost",
        color: MANAGER_PENDING_COLOR,
      },
      sales: {
        label: showAllSales ? "All Sales" : "In Store Sales",
        color: "#00eeff",
      },
      transactions: {
        label: "Transactions",
        color: "#fd00c6",
      },
    }),
    [showAllSales]
  );

  const aggregatedList = useMemo(() => {
    if (!timesheetData || timesheetData.length === 0) return [];

    // Map daily records first
    const dailyMap = new Map<
      string,
      {
        approvedCost: number;
        pendingCost: number;
        managerApprovedCost: number;
        managerPendingCost: number;
        sales: number;
        transactions: number;
        date: string;
      }
    >();

    timesheetData.forEach((item) => {
      const dateStr = item.LaborDate || item.date || item.Date;
      if (!dateStr) return;

      const formattedDate = String(dateStr).slice(0, 10);

      const totalSales = Number(item.totalSales || item.sales || 0);
      const dispenserSales = Number(item.dispenserSales || 0);
      const activeSales = showAllSales
        ? totalSales
        : Math.max(0, totalSales - dispenserSales);

      if (!dailyMap.has(formattedDate)) {
        dailyMap.set(formattedDate, {
          approvedCost: 0,
          pendingCost: 0,
          managerApprovedCost: 0,
          managerPendingCost: 0,
          sales: activeSales,
          transactions: Number(item.transactions || item.Transactions || 0),
          date: formattedDate,
        });
      }

      const rec = dailyMap.get(formattedDate)!;
      const approved = getNumber(
        item,
        "ApprovedLaborCost",
        "approvedLaborCost",
      );
      const pending = getNumber(
        item,
        "PendingLaborCost",
        "pendingLaborCost",
      );
      const managerApproved = getNumber(
        item,
        "ManagerApprovedLaborCost",
        "managerApprovedLaborCost",
      );
      const managerPending = getNumber(
        item,
        "ManagerPendingLaborCost",
        "managerPendingLaborCost",
      );

      if (approved > 0 || pending > 0) {
        rec.approvedCost += approved;
        rec.pendingCost += pending;
      } else {
        const cost = Number(
          item.ActualLaborCost ??
            item.ShiftCost ??
            item.cost ??
            item.amount ??
            0,
        );
        const status = String(item.Status || item.status || "").toLowerCase();

        if (status === "approved" || status === "completed" || !status) {
          rec.approvedCost += cost;
        } else {
          rec.pendingCost += cost;
        }
      }

      rec.managerApprovedCost += managerApproved;
      rec.managerPendingCost += managerPending;
    });

    const sortedDaily = Array.from(dailyMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    if (isMonthly) {
      // Group by Month (YYYY-MM)
      const monthGroups = new Map<
        string,
        {
          approvedCost: number;
          pendingCost: number;
          managerApprovedCost: number;
          managerPendingCost: number;
          sales: number;
          transactions: number;
          label: string;
          daysCount: number;
          expectedDaysInMonth: number;
        }
      >();

      sortedDaily.forEach((d) => {
        const dateObj = new Date(d.date + "T00:00:00");
        const monthKey = d.date.slice(0, 7); // YYYY-MM
        const monthName = dateObj.toLocaleString("en-US", { month: "short" });
        const yearShort = d.date.slice(2, 4);
        const label = `${monthName} '${yearShort}`;

        // Get total days in month
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth();
        const expectedDaysInMonth = new Date(year, month + 1, 0).getDate();

        if (!monthGroups.has(monthKey)) {
          monthGroups.set(monthKey, {
            approvedCost: 0,
            pendingCost: 0,
            managerApprovedCost: 0,
            managerPendingCost: 0,
            sales: 0,
            transactions: 0,
            label,
            daysCount: 0,
            expectedDaysInMonth,
          });
        }

        const m = monthGroups.get(monthKey)!;
        m.approvedCost += d.approvedCost;
        m.pendingCost += d.pendingCost;
        m.managerApprovedCost += d.managerApprovedCost;
        m.managerPendingCost += d.managerPendingCost;
        m.sales += d.sales;
        m.transactions += d.transactions;
        m.daysCount += 1;
      });

      // Filter to only include complete months
      return Array.from(monthGroups.values())
        .filter((m) => m.daysCount >= m.expectedDaysInMonth)
        .map((m) => ({
          label: m.label,
          approvedCost: Math.round(m.approvedCost),
          pendingCost: Math.round(m.pendingCost),
          managerApprovedCost: includeManagers
            ? Math.round(m.managerApprovedCost)
            : 0,
          managerPendingCost: includeManagers
            ? Math.round(m.managerPendingCost)
            : 0,
          sales: Math.round(m.sales),
          transactions: Math.round(m.transactions),
        }));
    } else {
      // Group by Weekly (Monday to Sunday)
      const weekGroups = new Map<
        string,
        {
          approvedCost: number;
          pendingCost: number;
          managerApprovedCost: number;
          managerPendingCost: number;
          sales: number;
          transactions: number;
          mondayDateStr: string;
          daysCount: number;
        }
      >();

      sortedDaily.forEach((d) => {
        const dateObj = new Date(d.date + "T00:00:00");
        const dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

        // Calculate Monday of this week
        const diffToMonday = (dayOfWeek + 6) % 7;
        const monday = new Date(dateObj);
        monday.setDate(dateObj.getDate() - diffToMonday);

        const mondayKey = monday.toISOString().slice(0, 10);

        if (!weekGroups.has(mondayKey)) {
          weekGroups.set(mondayKey, {
            approvedCost: 0,
            pendingCost: 0,
            managerApprovedCost: 0,
            managerPendingCost: 0,
            sales: 0,
            transactions: 0,
            mondayDateStr: mondayKey,
            daysCount: 0,
          });
        }

        const w = weekGroups.get(mondayKey)!;
        w.approvedCost += d.approvedCost;
        w.pendingCost += d.pendingCost;
        w.managerApprovedCost += d.managerApprovedCost;
        w.managerPendingCost += d.managerPendingCost;
        w.sales += d.sales;
        w.transactions += d.transactions;
        w.daysCount += 1;
      });

      // Filter to only complete 7-day weeks
      return Array.from(weekGroups.values())
        .filter((w) => w.daysCount === 7)
        .map((w) => {
          const dateLabel = w.mondayDateStr.slice(5, 10); // MM-DD
          return {
            label: `W/O ${dateLabel}`,
            approvedCost: Math.round(w.approvedCost),
            pendingCost: Math.round(w.pendingCost),
            managerApprovedCost: includeManagers
              ? Math.round(w.managerApprovedCost)
              : 0,
            managerPendingCost: includeManagers
              ? Math.round(w.managerPendingCost)
              : 0,
            sales: Math.round(w.sales),
            transactions: Math.round(w.transactions),
          };
        });
    }
  }, [timesheetData, isMonthly, showAllSales, includeManagers]);

  // 5-Bar Pagination Window
  const pageSize = 5;
  const maxPages = Math.ceil(aggregatedList.length / pageSize) || 1;
  const safePageIndex = Math.min(pageIndex, Math.max(0, maxPages - 1));

  const visibleData = useMemo(() => {
    if (aggregatedList.length === 0) return [];
    const total = aggregatedList.length;
    const endIndex = total - safePageIndex * pageSize;
    const startIndex = Math.max(0, endIndex - pageSize);
    return aggregatedList.slice(startIndex, Math.max(0, endIndex));
  }, [aggregatedList, safePageIndex, pageSize]);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="flex flex-col gap-3 pb-2">
        <div>
          <CardTitle>
            Shifts Cost vs. Sales
          </CardTitle>
        </div>

        <div className="flex w-full flex-nowrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5">
            <ChartToggle
              id="aggregated-all-sales-toggle"
              checked={showAllSales}
              onCheckedChange={(checked) => {
                setShowAllSales(checked);
                setPageIndex(0);
              }}
              label="All Sales"
              compact
            />

            <ChartToggle
              id="monthly-toggle"
              checked={isMonthly}
              onCheckedChange={(checked) => {
                setIsMonthly(checked);
                setPageIndex(0);
              }}
              label="Month"
              compact
            />

            {canViewManagerHours && (
              <ChartToggle
                id="aggregated-manager-hours-toggle"
                checked={showManagerHours}
                onCheckedChange={(checked) => {
                  setShowManagerHours(checked);
                  setPageIndex(0);
                }}
                label="Manager"
                compact
              />
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                safePageIndex < maxPages - 1 && setPageIndex((p) => p + 1)
              }
              disabled={
                safePageIndex >= maxPages - 1 || aggregatedList.length === 0
              }
              title="Previous Period"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => safePageIndex > 0 && setPageIndex((p) => p - 1)}
              disabled={safePageIndex === 0 || aggregatedList.length === 0}
              title="Next Period"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {visibleData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={visibleData}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
              />

              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
              />

              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
              />

              {showAllSales && (
                <YAxis
                  yAxisId="transactions"
                  hide={true}
                  domain={["auto", "auto"]}
                />
              )}

              <Tooltip
                content={
                  <MultiLineChartToolTip config={chartConfig} />
                }
              />

              {/* Stacked Shift Labor Cost Bars */}
              <Bar
                yAxisId="left"
                dataKey="approvedCost"
                name={chartConfig.approvedCost.label}
                stackId="cost"
                fill={chartConfig.approvedCost.color}
                barSize={28}
              />
              <Bar
                yAxisId="left"
                dataKey="pendingCost"
                name={chartConfig.pendingCost.label}
                stackId="cost"
                fill={chartConfig.pendingCost.color}
                barSize={28}
                radius={includeManagers ? [0, 0, 0, 0] : [4, 4, 0, 0]}
              />
              {includeManagers && (
                <>
                  <Bar
                    yAxisId="left"
                    dataKey="managerApprovedCost"
                    name={chartConfig.managerApprovedCost.label}
                    stackId="cost"
                    fill={chartConfig.managerApprovedCost.color}
                    barSize={28}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="managerPendingCost"
                    name={chartConfig.managerPendingCost.label}
                    stackId="cost"
                    fill={chartConfig.managerPendingCost.color}
                    barSize={28}
                    radius={[4, 4, 0, 0]}
                  />
                </>
              )}

              {/* Sales Line */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="sales"
                name={chartConfig.sales.label}
                stroke={chartConfig.sales.color}
                strokeWidth={2.5}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />

              {/* Transactions Line (only when All Sales is active) */}
              {showAllSales && (
                <Line
                  yAxisId="transactions"
                  type="monotone"
                  dataKey="transactions"
                  name={chartConfig.transactions.label}
                  stroke={chartConfig.transactions.color}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[260px] items-center justify-center text-muted-foreground text-sm">
            No complete {isMonthly ? "monthly" : "weekly"} data available
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          {Object.entries(chartConfig)
            .filter(
              ([key]) =>
                (key !== "transactions" || showAllSales) &&
                (!key.startsWith("manager") || includeManagers),
            )
            .map(([key, config]) => (
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
        Showing 5 {isMonthly ? "complete months" : "complete weeks"} with
        labor cost and selected sales ({safePageIndex * 5} -{" "}
        {(safePageIndex + 1) * 5} of {aggregatedList.length}).
      </CardFooter>
    </Card>
  );
}

/* ============================================================================
   3. SCHEDULED VS ACTUAL LABOR CHART (Space #3)
   ============================================================================ */

const COST_VARIANCE_CONFIG = {
  scheduledCost: { label: "Scheduled Cost", color: "#64748b" },
  actualCost: { label: "Actual Cost", color: "#10b981" },
};

const HOURS_VARIANCE_CONFIG = {
  scheduledHours: { label: "Scheduled Hours", color: "#3b82f6" },
  actualHours: { label: "Hours Worked", color: "#ec4899" },
};

interface ScheduledVsActualLaborChartProps {
  timesheetData: any[];
  className?: string;
  canViewManagerHours?: boolean;
}

export function ScheduledVsActualLaborChart({
  timesheetData,
  className,
  canViewManagerHours = false,
}: ScheduledVsActualLaborChartProps) {
  const [isWeekly, setIsWeekly] = useState(false);
  const [showManagerHours, setShowManagerHours] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const includeManagers = canViewManagerHours && showManagerHours;

  const processedData = useMemo(() => {
    if (!timesheetData || timesheetData.length === 0) return [];

    const dailyMap = new Map<
      string,
      {
        date: string;
        scheduledCost: number;
        actualCost: number;
        scheduledHours: number;
        actualHours: number;
      }
    >();

    timesheetData.forEach((item) => {
      const dateStr = item.LaborDate || item.date || item.Date;
      if (!dateStr) return;

      const formattedDate = String(dateStr).slice(0, 10);

      if (!dailyMap.has(formattedDate)) {
        dailyMap.set(formattedDate, {
          date: formattedDate,
          scheduledCost: 0,
          actualCost: 0,
          scheduledHours: 0,
          actualHours: 0,
        });
      }

      const rec = dailyMap.get(formattedDate)!;
      const schCost = getNumber(item, "ScheduledCost", "scheduledCost");
      const schHours = getNumber(item, "ScheduledHours", "scheduledHours");
      const managerSchCost = includeManagers
        ? getNumber(item, "ManagerScheduledCost", "managerScheduledCost")
        : 0;
      const managerSchHours = includeManagers
        ? getNumber(item, "ManagerScheduledHours", "managerScheduledHours")
        : 0;
      const approved = getNumber(
        item,
        "ApprovedLaborCost",
        "approvedLaborCost",
      );
      const pending = getNumber(
        item,
        "PendingLaborCost",
        "pendingLaborCost",
      );
      const managerApproved = includeManagers
        ? getNumber(item, "ManagerApprovedLaborCost", "managerApprovedLaborCost")
        : 0;
      const managerPending = includeManagers
        ? getNumber(item, "ManagerPendingLaborCost", "managerPendingLaborCost")
        : 0;
      const totalHours = getNumber(
        item,
        "TotalHoursWorked",
        "totalHoursWorked",
        "hours",
      );
      const managerTotalHours = includeManagers
        ? getNumber(
            item,
            "ManagerTotalHoursWorked",
            "managerTotalHoursWorked",
          )
        : 0;
      const splitActualCost = approved + pending + managerApproved + managerPending;
      const fallbackActualCost =
        getNumber(item, "ActualLaborCost", "ShiftCost") +
        (includeManagers
          ? getNumber(
              item,
              "ManagerActualLaborCost",
              "managerActualLaborCost",
            )
          : 0);

      rec.scheduledCost += schCost + managerSchCost;
      rec.scheduledHours += schHours + managerSchHours;
      rec.actualHours += totalHours + managerTotalHours;
      rec.actualCost += splitActualCost > 0 ? splitActualCost : fallbackActualCost;
    });

    const sortedDaily = Array.from(dailyMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    if (isWeekly) {
      const weekGroups = new Map<string, any>();

      sortedDaily.forEach((d) => {
        const dateObj = new Date(d.date + "T00:00:00");
        const dayOfWeek = dateObj.getDay();
        const diffToMonday = (dayOfWeek + 6) % 7;
        const monday = new Date(dateObj);
        monday.setDate(dateObj.getDate() - diffToMonday);

        const mondayKey = monday.toISOString().slice(0, 10);

        if (!weekGroups.has(mondayKey)) {
          weekGroups.set(mondayKey, {
            mondayDateStr: mondayKey,
            scheduledCost: 0,
            actualCost: 0,
            scheduledHours: 0,
            actualHours: 0,
            daysCount: 0,
          });
        }

        const w = weekGroups.get(mondayKey)!;
        w.scheduledCost += d.scheduledCost;
        w.actualCost += d.actualCost;
        w.scheduledHours += d.scheduledHours;
        w.actualHours += d.actualHours;
        w.daysCount += 1;
      });

      return Array.from(weekGroups.values())
        .filter((w) => w.daysCount === 7)
        .slice(-10)
        .map((w) => ({
          label: `W/O ${w.mondayDateStr.slice(5, 10)}`,
          scheduledCost: Math.round(w.scheduledCost),
          actualCost: Math.round(w.actualCost),
          costVariance: Math.round(w.actualCost - w.scheduledCost),
          scheduledHours: Math.round(w.scheduledHours),
          actualHours: Math.round(w.actualHours),
          hoursVariance: Math.round(w.actualHours - w.scheduledHours),
        }));
    } else {
      return sortedDaily.map((d) => ({
        label: d.date.slice(5, 10),
        scheduledCost: Math.round(d.scheduledCost),
        actualCost: Math.round(d.actualCost),
        costVariance: Math.round(d.actualCost - d.scheduledCost),
        scheduledHours: Math.round(d.scheduledHours),
        actualHours: Math.round(d.actualHours),
        hoursVariance: Math.round(d.actualHours - d.scheduledHours),
      }));
    }
  }, [timesheetData, isWeekly, includeManagers]);

  const pageSize = 5;
  const maxPages = Math.ceil(processedData.length / pageSize) || 1;
  const safePageIndex = Math.min(pageIndex, Math.max(0, maxPages - 1));

  const visibleData = useMemo(() => {
    if (processedData.length === 0) return [];
    const total = processedData.length;
    const endIndex = total - safePageIndex * pageSize;
    const startIndex = Math.max(0, endIndex - pageSize);
    return processedData.slice(startIndex, Math.max(0, endIndex));
  }, [processedData, safePageIndex, pageSize]);

  // Dynamic Y-Domain Calculations to Zoom Chart View
  const costDomain = useMemo(() => {
    if (visibleData.length === 0)
      return [0, "auto"] as [number | string, number | string];
    const values = visibleData.flatMap((d) => [d.scheduledCost, d.actualCost]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.2, 10);
    return [Math.max(0, Math.floor(min - padding)), Math.ceil(max + padding)];
  }, [visibleData]);

  const hoursDomain = useMemo(() => {
    if (visibleData.length === 0)
      return [0, "auto"] as [number | string, number | string];
    const values = visibleData.flatMap((d) => [
      d.scheduledHours,
      d.actualHours,
    ]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.2, 2);
    return [Math.max(0, Math.floor(min - padding)), Math.ceil(max + padding)];
  }, [visibleData]);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="flex flex-col gap-3 pb-2">
        <div>
          <CardTitle>Scheduled vs. Actual Variance</CardTitle>
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <ChartToggle
              id="weekly-schedule-variance-toggle"
              checked={isWeekly}
              onCheckedChange={(checked) => {
                setIsWeekly(checked);
                setPageIndex(0);
              }}
              label="Weekly"
            />

            {canViewManagerHours && (
              <ChartToggle
                id="variance-manager-hours-toggle"
                checked={showManagerHours}
                onCheckedChange={(checked) => {
                  setShowManagerHours(checked);
                  setPageIndex(0);
                }}
                label="Manager"
              />
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                safePageIndex < maxPages - 1 && setPageIndex((p) => p + 1)
              }
              disabled={
                safePageIndex >= maxPages - 1 || processedData.length === 0
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => safePageIndex > 0 && setPageIndex((p) => p - 1)}
              disabled={safePageIndex === 0 || processedData.length === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2 space-y-4">
        {visibleData.length > 0 ? (
          <>
            {/* Top Chart: Cost ($) */}
            <div>
              <div className="flex justify-between items-center mb-1 text-xs font-semibold text-slate-600">
                <span>Labor Cost ($)</span>
                <span className="text-[10px] text-muted-foreground">
                  Scheduled vs Actual
                </span>
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart
                  data={visibleData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="colorSchCost"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#64748b"
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="95%"
                        stopColor="#64748b"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                    <linearGradient
                      id="colorActCost"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#10b981"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor="#10b981"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 3"
                    opacity={0.5}
                  />
                  <XAxis dataKey="label" hide={true} />
                  <YAxis
                    domain={costDomain}
                    tickFormatter={(v) => `$${v}`}
                    tick={{ fontSize: 10 }}
                    width={40}
                  />
                  <Tooltip
                    content={
                      <MultiLineChartToolTip config={COST_VARIANCE_CONFIG} />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="scheduledCost"
                    stroke="#64748b"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSchCost)"
                    dot={{ r: 3, fill: "#64748b" }}
                    activeDot={{ r: 5 }}
                    name="Scheduled Cost"
                  />
                  <Area
                    type="monotone"
                    dataKey="actualCost"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorActCost)"
                    dot={{ r: 3, fill: "#10b981" }}
                    activeDot={{ r: 5 }}
                    name="Actual Cost"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Bottom Chart: Hours (h) */}
            <div>
              <div className="flex justify-between items-center mb-1 text-xs font-semibold text-slate-600">
                <span>Hours Worked (h)</span>
                <span className="text-[10px] text-muted-foreground">
                  Scheduled vs Actual
                </span>
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart
                  data={visibleData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="colorSchHours"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#3b82f6"
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="95%"
                        stopColor="#3b82f6"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                    <linearGradient
                      id="colorActHours"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#ec4899"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor="#ec4899"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 3"
                    opacity={0.5}
                  />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis
                    domain={hoursDomain}
                    tickFormatter={(v) => `${v}h`}
                    tick={{ fontSize: 10 }}
                    width={40}
                  />
                  <Tooltip
                    content={
                      <MultiLineChartToolTip config={HOURS_VARIANCE_CONFIG} />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="scheduledHours"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSchHours)"
                    dot={{ r: 3, fill: "#3b82f6" }}
                    activeDot={{ r: 5 }}
                    name="Scheduled Hours"
                  />
                  <Area
                    type="monotone"
                    dataKey="actualHours"
                    stroke="#ec4899"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorActHours)"
                    dot={{ r: 3, fill: "#ec4899" }}
                    activeDot={{ r: 5 }}
                    name="Hours Worked"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="flex h-[240px] items-center justify-center text-muted-foreground text-sm">
            No variance data available
          </div>
        )}
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground">
        Showing scheduled vs actual cost and hours for 5{" "}
        {isWeekly ? "weeks" : "days"} ({safePageIndex * 5} -{" "}
        {(safePageIndex + 1) * 5} of {processedData.length}).
      </CardFooter>
    </Card>
  );
}

// export function ScheduledVsActualLaborChart({
//   timesheetData,
//   className,
// }: ShiftsAndSalesChartProps) {
//   const [isWeekly, setIsWeekly] = useState(false);
//   const [pageIndex, setPageIndex] = useState(0);

//   const processedData = useMemo(() => {
//     if (!timesheetData || timesheetData.length === 0) return [];

//     // Map daily metrics
//     const dailyMap = new Map<
//       string,
//       {
//         date: string;
//         scheduledCost: number;
//         approvedCost: number;
//         pendingCost: number;
//         scheduledHours: number;
//         actualHours: number;
//       }
//     >();

//     timesheetData.forEach((item) => {
//       const dateStr = item.LaborDate || item.date || item.Date;
//       if (!dateStr) return;

//       const formattedDate = String(dateStr).slice(0, 10);

//       if (!dailyMap.has(formattedDate)) {
//         dailyMap.set(formattedDate, {
//           date: formattedDate,
//           scheduledCost: 0,
//           approvedCost: 0,
//           pendingCost: 0,
//           scheduledHours: 0,
//           actualHours: 0,
//         });
//       }

//       const rec = dailyMap.get(formattedDate)!;

//       const schCost = Number(item.ScheduledCost ?? item.scheduledCost ?? 0);
//       const schHours = Number(item.ScheduledHours ?? item.scheduledHours ?? 0);
//       const approved = Number(item.ApprovedLaborCost ?? item.approvedLaborCost ?? 0);
//       const pending = Number(item.PendingLaborCost ?? item.pendingLaborCost ?? 0);
//       const totalHours = Number(item.TotalHoursWorked ?? item.totalHoursWorked ?? item.hours ?? 0);

//       rec.scheduledCost += schCost;
//       rec.scheduledHours += schHours;
//       rec.actualHours += totalHours;

//       if (approved > 0 || pending > 0) {
//         rec.approvedCost += approved;
//         rec.pendingCost += pending;
//       } else {
//         const cost = Number(item.ActualLaborCost ?? item.ShiftCost ?? item.cost ?? item.amount ?? 0);
//         const status = String(item.Status || item.status || "").toLowerCase();

//         if (status === "approved" || status === "completed" || !status) {
//           rec.approvedCost += cost;
//         } else {
//           rec.pendingCost += cost;
//         }
//       }
//     });

//     const sortedDaily = Array.from(dailyMap.values()).sort(
//       (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
//     );

//     if (isWeekly) {
//       // Group by Week (Monday to Sunday)
//       const weekGroups = new Map<
//         string,
//         {
//           mondayDateStr: string;
//           scheduledCost: number;
//           approvedCost: number;
//           pendingCost: number;
//           scheduledHours: number;
//           actualHours: number;
//           daysCount: number;
//         }
//       >();

//       sortedDaily.forEach((d) => {
//         const dateObj = new Date(d.date + "T00:00:00");
//         const dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

//         // Calculate Monday of this week
//         const diffToMonday = (dayOfWeek + 6) % 7;
//         const monday = new Date(dateObj);
//         monday.setDate(dateObj.getDate() - diffToMonday);

//         const mondayKey = monday.toISOString().slice(0, 10);

//         if (!weekGroups.has(mondayKey)) {
//           weekGroups.set(mondayKey, {
//             mondayDateStr: mondayKey,
//             scheduledCost: 0,
//             approvedCost: 0,
//             pendingCost: 0,
//             scheduledHours: 0,
//             actualHours: 0,
//             daysCount: 0,
//           });
//         }

//         const w = weekGroups.get(mondayKey)!;
//         w.scheduledCost += d.scheduledCost;
//         w.approvedCost += d.approvedCost;
//         w.pendingCost += d.pendingCost;
//         w.scheduledHours += d.scheduledHours;
//         w.actualHours += d.actualHours;
//         w.daysCount += 1;
//       });

//       // Filter only completed 7-day weeks and slice the last 10 full weeks
//       return Array.from(weekGroups.values())
//         .filter((w) => w.daysCount === 7)
//         .slice(-10)
//         .map((w) => ({
//           label: `W/O ${w.mondayDateStr.slice(5, 10)}`,
//           scheduledCost: Math.round(w.scheduledCost),
//           approvedCost: Math.round(w.approvedCost),
//           pendingCost: Math.round(w.pendingCost),
//           scheduledHours: Math.round(w.scheduledHours),
//           actualHours: Math.round(w.actualHours),
//         }));
//     } else {
//       // Daily view
//       return sortedDaily.map((d) => ({
//         label: d.date.slice(5, 10),
//         scheduledCost: Math.round(d.scheduledCost),
//         approvedCost: Math.round(d.approvedCost),
//         pendingCost: Math.round(d.pendingCost),
//         scheduledHours: Math.round(d.scheduledHours),
//         actualHours: Math.round(d.actualHours),
//       }));
//     }
//   }, [timesheetData, isWeekly]);

//   // 5-Bar Pagination Window
//   const pageSize = 5;
//   const maxPages = Math.ceil(processedData.length / pageSize) || 1;
//   const safePageIndex = Math.min(pageIndex, Math.max(0, maxPages - 1));

//   const visibleData = useMemo(() => {
//     if (processedData.length === 0) return [];
//     const total = processedData.length;
//     const endIndex = total - safePageIndex * pageSize;
//     const startIndex = Math.max(0, endIndex - pageSize);
//     return processedData.slice(startIndex, Math.max(0, endIndex));
//   }, [processedData, safePageIndex, pageSize]);

//   return (
//     <Card className={cn("w-full", className)}>
//       <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
//         <div>
//           <CardTitle>Scheduled vs. Actual Labor</CardTitle>
//           <CardDescription>
//             Cost comparison & scheduled vs. worked hours
//           </CardDescription>
//         </div>

//         <div className="flex items-center gap-3">
//           {/* Toggle for Daily vs Weekly */}
//           <div className="flex items-center space-x-2">
//             <Switch
//               id="weekly-schedule-toggle"
//               checked={isWeekly}
//               onCheckedChange={(checked) => {
//                 setIsWeekly(checked);
//                 setPageIndex(0);
//               }}
//             />
//             <Label htmlFor="weekly-schedule-toggle" className="text-xs cursor-pointer font-medium">
//               Weekly
//             </Label>
//           </div>

//           <div className="flex items-center gap-1">
//             <Button
//               variant="outline"
//               size="icon"
//               className="h-8 w-8"
//               onClick={() => safePageIndex < maxPages - 1 && setPageIndex((p) => p + 1)}
//               disabled={safePageIndex >= maxPages - 1 || processedData.length === 0}
//               title="Previous Period"
//             >
//               <ChevronLeft className="h-4 w-4" />
//             </Button>
//             <Button
//               variant="outline"
//               size="icon"
//               className="h-8 w-8"
//               onClick={() => safePageIndex > 0 && setPageIndex((p) => p - 1)}
//               disabled={safePageIndex === 0 || processedData.length === 0}
//               title="Next Period"
//             >
//               <ChevronRight className="h-4 w-4" />
//             </Button>
//           </div>
//         </div>
//       </CardHeader>

//       <CardContent className="pt-4">
//         {visibleData.length > 0 ? (
//           <ResponsiveContainer width="100%" height={260}>
//             <ComposedChart data={visibleData}>
//               <CartesianGrid vertical={false} strokeDasharray="3 3" />
//               <XAxis
//                 dataKey="label"
//                 tickLine={false}
//                 axisLine={false}
//                 tick={{ fontSize: 11 }}
//               />

//               {/* Main Y-Axis: Cost ($) */}
//               <YAxis
//                 yAxisId="cost"
//                 tickLine={false}
//                 axisLine={false}
//                 tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
//                 tick={{ fontSize: 11 }}
//               />

//               {/* Secondary Right Y-Axis: Hours */}
//               <YAxis
//                 yAxisId="hours"
//                 orientation="right"
//                 tickLine={false}
//                 axisLine={false}
//                 tickFormatter={(val) => `${val}h`}
//                 tick={{ fontSize: 11 }}
//               />

//               <Tooltip content={<MultiLineChartToolTip config={SCHEDULED_VS_ACTUAL_CONFIG} />} />

//               {/* Bar 1: Standalone Scheduled Cost */}
//               <Bar
//                 yAxisId="cost"
//                 dataKey="scheduledCost"
//                 name={SCHEDULED_VS_ACTUAL_CONFIG.scheduledCost.label}
//                 fill={SCHEDULED_VS_ACTUAL_CONFIG.scheduledCost.color}
//                 barSize={16}
//                 radius={[4, 4, 0, 0]}
//               />

//               {/* Bar 2 Group: Stacked Approved Cost + Pending Cost */}
//               <Bar
//                 yAxisId="cost"
//                 dataKey="approvedCost"
//                 name={SCHEDULED_VS_ACTUAL_CONFIG.approvedCost.label}
//                 stackId="actualCost"
//                 fill={SCHEDULED_VS_ACTUAL_CONFIG.approvedCost.color}
//                 barSize={16}
//               />
//               <Bar
//                 yAxisId="cost"
//                 dataKey="pendingCost"
//                 name={SCHEDULED_VS_ACTUAL_CONFIG.pendingCost.label}
//                 stackId="actualCost"
//                 fill={SCHEDULED_VS_ACTUAL_CONFIG.pendingCost.color}
//                 barSize={16}
//                 radius={[4, 4, 0, 0]}
//               />

//               {/* Line 1: Scheduled Hours */}
//               <Line
//                 yAxisId="hours"
//                 type="monotone"
//                 dataKey="scheduledHours"
//                 name={SCHEDULED_VS_ACTUAL_CONFIG.scheduledHours.label}
//                 stroke={SCHEDULED_VS_ACTUAL_CONFIG.scheduledHours.color}
//                 strokeWidth={2}
//                 dot={{ r: 3 }}
//                 activeDot={{ r: 5 }}
//               />

//               {/* Line 2: Actual Hours Worked */}
//               <Line
//                 yAxisId="hours"
//                 type="monotone"
//                 dataKey="actualHours"
//                 name={SCHEDULED_VS_ACTUAL_CONFIG.actualHours.label}
//                 stroke={SCHEDULED_VS_ACTUAL_CONFIG.actualHours.color}
//                 strokeWidth={2}
//                 dot={{ r: 3 }}
//                 activeDot={{ r: 5 }}
//               />
//             </ComposedChart>
//           </ResponsiveContainer>
//         ) : (
//           <div className="flex h-[260px] items-center justify-center text-muted-foreground text-sm">
//             No scheduled or actual labor data available
//           </div>
//         )}

//         <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
//           {Object.entries(SCHEDULED_VS_ACTUAL_CONFIG).map(([key, config]) => (
//             <div key={key} className="flex items-center gap-2">
//               <div
//                 className="h-3 w-3 rounded-sm shrink-0"
//                 style={{ backgroundColor: config.color }}
//               />
//               <span className="text-xs font-medium text-slate-700">
//                 {config.label}
//               </span>
//             </div>
//           ))}
//         </div>
//       </CardContent>

//       <CardFooter className="text-xs text-muted-foreground">
//         Showing 5 {isWeekly ? "weeks" : "days"} ({safePageIndex * 5} - {(safePageIndex + 1) * 5} of {processedData.length})
//       </CardFooter>
//     </Card>
//   );
// }
