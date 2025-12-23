// import {
//   ComposedChart,
//   Bar,
//   Line,
//   XAxis,
//   YAxis,
//   Tooltip,
//   CartesianGrid,
//   ResponsiveContainer,
// } from "recharts";
// import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";

// interface BistroBarLineChartProps {
//   data: { week: string; sales: number; growth: number | null; units: number }[];
// }

// export function BistroBarLineChart({ data }: BistroBarLineChartProps) {
//   // Filter out rows with null growth (first week)
//   const chartData = data.filter(d => d.growth !== null);

//   return (
//     <Card className="w-full">
//       <CardHeader>
//         <CardTitle>Bistro Weekly Sales Trend</CardTitle>
//         <CardDescription>Weekly Bistro Sales and WoW Growth</CardDescription>
//       </CardHeader>

//       <CardContent>
//         <ResponsiveContainer width="100%" height={250}>
//           <ComposedChart data={chartData}>
//             <CartesianGrid strokeDasharray="3 3" vertical={false} />

//             <XAxis dataKey="week" tickLine={false} axisLine={false}
//               tick={{ fontSize: 12 }} />

//             {/* Left Y-axis for sales & units */}
//             <YAxis
//               yAxisId="left"
//               tickLine={false}
//               axisLine={false}
//               tickFormatter={(value) => `$${value.toLocaleString()}`}
//               tick={{ fontSize: 12 }}
//             />

//             {/* Right Y-axis for WoW Growth & ASP */}
//             <YAxis
//               yAxisId="right"
//               orientation="right"
//               tickLine={false}
//               axisLine={false}
//               domain={['dataMin - 5', 'dataMax + 5']}
//               tickFormatter={(value) => `${value.toFixed(1)}%`}
//               tick={{ fontSize: 12 }}
//             />

//             <Tooltip
//               formatter={(value: number, name: string) => {
//                 switch (name) {
//                   case "sales": return `$${value.toLocaleString()}`;
//                   case "units": return `${value.toLocaleString()} units`;
//                   case "asp": return `$${value.toFixed(2)}`;
//                   case "growth": return `${value.toFixed(1)}%`;
//                   default: return value;
//                 }
//               }}
//             />

//             {/* Bars */}
//             <Bar yAxisId="left" dataKey="sales" fill="#4f46e5" barSize={20} radius={[4, 4, 0, 0]} />
//             <Bar yAxisId="left" dataKey="units" fill="#10b981" barSize={20} radius={[4, 4, 0, 0]} />

//             {/* Lines */}
//             <Line yAxisId="right" type="monotone" dataKey="growth" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 5, fill: '#f97316' }} />
//             {/* <Line yAxisId="right" type="monotone" dataKey="asp" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 5, fill: '#6366f1' }} /> */}
//           </ComposedChart>
//         </ResponsiveContainer>
//       </CardContent>

//       <CardFooter className="text-sm text-muted-foreground">
//         Last 6 weeks excluding current week
//       </CardFooter>
//     </Card>
//   );
// }

import {
  ComposedChart,
  Bar,
  BarChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

function BistroTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="border-border/50 bg-background grid min-w-[10rem] gap-1.5 rounded-lg border px-2.5 py-2 text-xs shadow-xl">
      <div className="text-sm font-medium">{label}</div>

      <div className="grid gap-1.5">
        {payload
          .filter((p: any) => p.value !== 0 && p.value != null)
          .map((item: any) => {
            const key = String(item.dataKey);
            const color = item.color;

            let labelText = "";
            let valueText = "";

            switch (key) {
              case "sales_130":
                labelText = "Bakery Sales";
                valueText = `$${item.value.toFixed(2).toLocaleString()}`;
                break;
              case "sales_134":
                labelText = "Hot Food Sales";
                valueText = `$${item.value.toFixed(2).toLocaleString()}`;
                break;
              case "units_130":
                labelText = "Bakery Units";
                valueText = item.value.toFixed(0).toLocaleString();
                break;
              case "units_134":
                labelText = "Hot Food Units";
                valueText = item.value.toFixed(0).toLocaleString();
                break;
              case "growth":
                labelText = "WoW Growth";
                valueText = `${item.value.toFixed(1)}%`;
                break;
              default:
                return null;
            }

            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-[2px]"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-muted-foreground">
                    {labelText}
                  </span>
                </div>

                <span className="font-mono font-medium tabular-nums">
                  {valueText}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

/* ======================= */
/*        TYPES            */
/* ======================= */

interface BistroStackedChartRow {
  week: string;
  sales_130: number;
  sales_134: number;
  units_130: number;
  units_134: number;
  growth: number | null;
}

interface BistroBarLineChartProps {
  data: BistroStackedChartRow[];
  hideIcon?: boolean;
  className?: string;
  verticalAlign?: "top" | "bottom";
}

/* ======================= */
/*       COMPONENT         */
/* ======================= */

export function BistroBarLineChart({
  data,
  hideIcon = false,
  className,
  verticalAlign = "top",
}: BistroBarLineChartProps) {

  const chartData = data

  const config = [
    { dataKey: "sales_130", label: "Bakery Sales", stroke: "#bbfa47ff" },
    { dataKey: "sales_134", label: "Hot Food Sales", stroke: "#FF9F1C" },
    { dataKey: "units_130", label: "Bakery Units Sold", stroke: "#473affff" },
    { dataKey: "units_134", label: "Hot Food Units Sold", stroke: "#E84855" },
    { dataKey: "growth", label: "WoW Growth", stroke: "#a7035dff" },
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Bistro Weekly Performance</CardTitle>
        <CardDescription>
          Stacked Sales & Units by Category with WoW Growth
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />

            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
            />

            {/* Left axis → Sales & Units */}
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => `$${v.toLocaleString()}`}
            />

            {/* Right axis → WoW Growth */}
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              domain={["dataMin - 5", "dataMax + 5"]}
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => `${v.toFixed(1)}%`}
            />

            {/* Tooltip – stays EXACTLY the same */}
            <Tooltip content={<BistroTooltip />} />

            {/* ===== SALES STACK ===== */}
            <Bar
              yAxisId="left"
              dataKey="sales_130"
              stackId="sales"
              fill="#bbfa47ff"
              barSize={22}
            // radius={[4, 4, 0, 0]}
            />
            <Bar
              yAxisId="left"
              dataKey="sales_134"
              stackId="sales"
              fill="#FF9F1C"
              barSize={22}
            // radius={[4, 4, 0, 0]}
            />

            {/* ===== UNITS STACK ===== */}
            <Bar
              yAxisId="left"
              dataKey="units_130"
              stackId="units"
              fill="#473affff"
              barSize={22}
            // radius={[4, 4, 0, 0]}
            />
            <Bar
              yAxisId="left"
              dataKey="units_134"
              stackId="units"
              fill="#E84855"
              barSize={22}
            // radius={[4, 4, 0, 0]}
            />

            {/* ===== GROWTH LINE ===== */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="growth"
              stroke="#a7035dff"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 5, fill: "#a7035dff" }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div
          className={cn(
            "flex flex-wrap items-center justify-center gap-4",
            verticalAlign === "top" ? "pb-3" : "pt-3",
            className
          )}
        >
          {config.map((c) => (
            <div
              key={c.dataKey}
              className="flex items-center gap-1.5 [&>div]:h-2 [&>div]:w-2 [&>div]:rounded-[2px]"
            >
              {!hideIcon && (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: c.stroke }}
                />
              )}
              <span className="text-sm font-medium text-black">
                {c.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="text-sm text-muted-foreground">
        Last 5 weeks (excluding current week)
      </CardFooter>
    </Card>
  );
}


interface Top10BistroChartProps {
  data: {
    item: string;
    sales: number;
    units: number;
    unitsPerDay: number;
  }[];
}

function BarItemLabel(props: any) {
  const { x, y, width, height, value } = props;

  const isSmallBar = width < 150; // tweak threshold if needed
  const textY = y + height / 2 + 4;

  return (
    <text
      x={isSmallBar ? x + width + 8 : x + 8}
      y={textY}
      fill={isSmallBar ? "#111827" : "#ffffff"}
      fontSize={11}
      fontWeight={500}
      textAnchor="start"
    >
      {/* {value.length > 42 ? `${value.slice(0, 42)}…` : value} */}
      {value}
    </text>
  );
}

function Top10Tooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;

  const d = payload[0].payload;

  return (
    <div className="border-border/50 bg-background grid min-w-[10rem] gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <div className="text-sm font-medium">{d.item}</div>

      <div className="grid gap-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Sales</span>
          <span className="font-mono font-medium">
            ${d.sales.toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Units Sold</span>
          <span className="font-mono font-medium">
            {d.units.toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Avg. Units / Day</span>
          <span className="font-mono font-medium">
            {d.unitsPerDay.toFixed(0)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Top10BistroChart({ data }: Top10BistroChartProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Top 10 Bistro Items</CardTitle>
        <CardDescription>Last 30 days • Sorted by sales</CardDescription>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            layout="vertical"
            data={data}
            barCategoryGap={12}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />

            {/* REQUIRED for tooltip mapping – hidden */}
            <YAxis
              type="category"
              dataKey="item"
              hide
            />

            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => `$${v.toLocaleString()}`}
            />

            <Tooltip content={<Top10Tooltip />} />

            <Bar
              dataKey="sales"
              fill="#c59100ff"
              radius={[4, 4, 4, 4]}
              barSize={22}
            >
              <LabelList
                dataKey="item"
                content={<BarItemLabel />}
              />
            </Bar>

          </BarChart>
        </ResponsiveContainer>
      </CardContent>

      <CardFooter className="text-sm text-muted-foreground">
        Hover bars to see units and velocity
      </CardFooter>
    </Card>
  );
}
