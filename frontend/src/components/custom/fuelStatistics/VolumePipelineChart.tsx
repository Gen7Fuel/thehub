import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface OrderItem {
  grade: string;
  ltrs: number;
}

interface RawOrder {
  _id: string;
  currentStatus: "Created" | "In Transit" | "Delivered" | "Cancelled" | string;
  station: { _id: string };
  items: OrderItem[];
}

export interface GradeTheme {
  color: string;
  label: string;
  icon?: React.ElementType;
  raw: string;
  light: string;
}

interface VolumePipelineChartProps {
  orders: RawOrder[];
  selectedGrades: string[];
  getGradeTheme: (grade: string) => GradeTheme;
  isLoading?: boolean;
}

const ORDER_STATUSES = ["Delivered", "In Transit", "Created", "Cancelled"];

export function VolumePipelineChart({
  orders,
  selectedGrades,
  getGradeTheme,
  isLoading = false,
}: VolumePipelineChartProps) {
  // Aggregate volume grouped by Order Status and Fuel Grade
  const { chartData, totalVolume } = useMemo(() => {
    const statusMap: Record<string, Record<string, number>> = {
      Delivered: {},
      "In Transit": {},
      Created: {},
      Cancelled: {},
    };

    let grandTotal = 0;

    (orders || []).forEach((order) => {
      const status = order.currentStatus;
      if (!statusMap[status]) return;

      (order.items || []).forEach((item) => {
        if (!selectedGrades.includes(item.grade)) return;
        const volume = Number(item.ltrs) || 0;
        statusMap[status][item.grade] =
          (statusMap[status][item.grade] || 0) + volume;
        grandTotal += volume;
      });
    });

    const data = ORDER_STATUSES.map((status) => {
      const rowVolume = Object.values(statusMap[status]).reduce(
        (a, b) => a + b,
        0,
      );
      return {
        status,
        statusTotal: rowVolume,
        ...statusMap[status],
      };
    });

    return { chartData: data, totalVolume: grandTotal };
  }, [orders, selectedGrades]);

  if (isLoading) {
    return (
      <div className="w-full h-[380px] bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-center">
        <span className="text-xs font-bold text-slate-400 animate-pulse">
          Loading pipeline chart data...
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-[380px] bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-sm font-black uppercase text-slate-800 tracking-tight">
            Volume Pipeline
          </h2>
          <p className="text-[11px] font-semibold text-slate-400">
            Horizontal status vs. volume (Liters)
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
            Total
          </span>
          <span className="text-xs font-black text-slate-700">
            {totalVolume >= 1000
              ? `${(totalVolume / 1000).toFixed(1)}k L`
              : `${totalVolume} L`}
          </span>
        </div>
      </div>

      {/* Horizontal Canvas */}
      <div className="w-full h-[290px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 10, right: 15, left: 0, bottom: 0 }} // Slightly tighter left margin
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="#f1f5f9"
            />

            {/* Statuses on Y-Axis */}
            <YAxis
              type="category"
              dataKey="status"
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              tick={{ fill: "#334155", fontSize: 10, fontWeight: 800 }} // reduced fontSize slightly
              width={70} // reduced width from 80
            />

            {/* Liters on X-Axis */}
            <XAxis
              type="number"
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }}
              tickFormatter={(val) =>
                val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`
              }
            />

            {/* White Tooltip with Grade Names and Color Indicators */}
            <Tooltip
              cursor={{ fill: "#f8fafc" }}
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
                `${Number(value).toLocaleString()} Liters`,
                name,
              ]}
            />

            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{
                fontSize: "11px",
                fontWeight: "bold",
                paddingBottom: "8px",
              }}
            />

            {/* Dynamic Stacked Bars for Selected Grades */}
            {selectedGrades.map((grade, index) => {
              const theme = getGradeTheme(grade);
              const isLast = index === selectedGrades.length - 1;

              return (
                <Bar
                  key={grade}
                  dataKey={grade}
                  name={grade}
                  stackId="pipeline"
                  fill={theme?.raw || "#94a3b8"}
                  radius={isLast ? [0, 6, 6, 0] : [0, 0, 0, 0]}
                  barSize={24}
                />
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default VolumePipelineChart;
