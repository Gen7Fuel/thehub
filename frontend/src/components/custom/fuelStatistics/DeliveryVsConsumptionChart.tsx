import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  parseISO,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  format,
  isBefore,
  startOfDay,
} from "date-fns";

export interface RawOrder {
  _id: string;
  currentStatus: string;
  estimatedDeliveryDate: string;
  items: { grade: string; ltrs: number }[];
}

export interface DailySalesRecord {
  date: string;
  salesData: { grade: string; volume: number }[];
}

interface DeliveryVsConsumptionChartProps {
  orders: RawOrder[];
  sales: DailySalesRecord[];
  selectedGrades: string[];
  fromMonth: string;
  toMonth: string;
  isLoading?: boolean;
}

export function DeliveryVsConsumptionChart({
  orders,
  sales,
  selectedGrades,
  fromMonth,
  toMonth,
  isLoading = false,
}: DeliveryVsConsumptionChartProps) {
  const { chartData, totals } = useMemo(() => {
    if (!fromMonth || !toMonth)
      return { chartData: [], totals: { delivered: 0, sales: 0 } };

    const start = startOfMonth(parseISO(fromMonth));
    const rawEnd = endOfMonth(parseISO(toMonth));
    const today = startOfDay(new Date());

    const allDaysInInterval = eachDayOfInterval({ start, end: rawEnd });
    // Filter so that only days strictly before today are kept (up to yesterday)
    const validDays = allDaysInInterval.filter((day) =>
      isBefore(startOfDay(day), today),
    );
    const dailyMap = new Map<
      string,
      {
        dateStr: string;
        dayLabel: string;
        deliveredLtrs: number;
        salesLtrs: number;
      }
    >();

    validDays.forEach((day) => {
      const dateKey = format(day, "yyyy-MM-dd");
      const dayLabel = format(day, "MMM d");
      dailyMap.set(dateKey, {
        dateStr: dateKey,
        dayLabel,
        deliveredLtrs: 0,
        salesLtrs: 0,
      });
    });

    let totalDelivered = 0;
    let totalSales = 0;

    (orders || []).forEach((order) => {
      if (order.currentStatus !== "Delivered" || !order.estimatedDeliveryDate)
        return;

      const dateKey = format(
        parseISO(order.estimatedDeliveryDate),
        "yyyy-MM-dd",
      );
      const targetDay = dailyMap.get(dateKey);
      if (!targetDay) return;

      (order.items || []).forEach((item) => {
        if (!selectedGrades.includes(item.grade)) return;
        const volume = Number(item.ltrs) || 0;
        targetDay.deliveredLtrs += volume;
        totalDelivered += volume;
      });
    });

    (sales || []).forEach((record) => {
      const dateKey = record.date;
      const targetDay = dailyMap.get(dateKey);
      if (!targetDay) return;

      (record.salesData || []).forEach((item) => {
        if (!selectedGrades.includes(item.grade)) return;
        const volume = Number(item.volume) || 0;
        targetDay.salesLtrs += volume;
        totalSales += volume;
      });
    });

    return {
      chartData: Array.from(dailyMap.values()),
      totals: { delivered: totalDelivered, sales: totalSales },
    };
  }, [orders, sales, selectedGrades, fromMonth, toMonth]);

  if (isLoading) {
    return (
      <div className="w-full h-[380px] bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-center">
        <span className="text-xs font-bold text-slate-400 animate-pulse">
          Loading delivery vs. consumption trends...
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-[380px] bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-sm font-black uppercase text-slate-800 tracking-tight">
            Delivery Pacing vs. Daily Consumption
          </h2>
          <p className="text-[11px] font-semibold text-slate-400">
            Daily Delivered Volume vs. Station Burn Rate (Liters)
          </p>
        </div>

        {/* Totals Summary */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] font-extrabold uppercase text-emerald-600 block">
              Delivered
            </span>
            <span className="text-xs font-black text-slate-800">
              {totals.delivered >= 1000
                ? `${(totals.delivered / 1000).toFixed(1)}k L`
                : `${Math.round(totals.delivered)} L`}
            </span>
          </div>
          <div className="h-5 w-[1px] bg-slate-200" />
          <div className="text-right">
            <span className="text-[10px] font-extrabold uppercase text-indigo-600 block">
              Sales Burn
            </span>
            <span className="text-xs font-black text-slate-800">
              {totals.sales >= 1000
                ? `${(totals.sales / 1000).toFixed(1)}k L`
                : `${Math.round(totals.sales)} L`}
            </span>
          </div>
        </div>
      </div>

      {/* Chart Flex Container matching Volume Pipeline */}
      <div className="w-full flex-1 min-h-0 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 15, left: -10, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#f1f5f9"
            />

            <XAxis
              dataKey="dayLabel"
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }}
              minTickGap={25}
            />

            <YAxis
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }}
              tickFormatter={(val) =>
                val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`
              }
            />

            <Tooltip
              cursor={{
                stroke: "#cbd5e1",
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
              contentStyle={{
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                boxShadow:
                  "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                fontSize: "12px",
                padding: "10px 14px",
              }}
              labelStyle={{
                color: "#0f172a",
                fontWeight: 800,
                marginBottom: "6px",
              }}
              itemStyle={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 0",
              }}
              formatter={(value: number, name: string) => [
                `${Number(value).toLocaleString()} L`,
                name === "deliveredLtrs" ? "Delivered Volume" : "Sales Volume",
              ]}
            />

            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{
                fontSize: "11px",
                fontWeight: "bold",
                paddingBottom: "10px",
              }}
              formatter={(value) =>
                value === "deliveredLtrs"
                  ? "Delivered Fuel (L)"
                  : "Sales Consumption (L)"
              }
            />

            <Line
              type="monotone"
              dataKey="deliveredLtrs"
              name="deliveredLtrs"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={false}
              activeDot={{
                r: 5,
                fill: "#10b981",
                stroke: "#ffffff",
                strokeWidth: 2,
              }}
            />

            <Line
              type="monotone"
              dataKey="salesLtrs"
              name="salesLtrs"
              stroke="#6366f1"
              strokeWidth={2.5}
              strokeDasharray="4 2"
              dot={false}
              activeDot={{
                r: 5,
                fill: "#6366f1",
                stroke: "#ffffff",
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default DeliveryVsConsumptionChart;
