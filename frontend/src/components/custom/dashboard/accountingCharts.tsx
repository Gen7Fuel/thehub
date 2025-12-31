import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import {
  ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip,
  ReferenceLine, LineChart, Line,
} from "recharts";

// interface OverShortChartItem {
//   date: string;
//   overShort: number;
//   canadian_cash_collected: number;
//   report_canadian_cash: number;
//   shifts: number;
//   notes: string;
//   fill?: string;
//   displayValue?: number; // normalized for chart
// }

// interface OverShortChartProps {
//   data: OverShortChartItem[];
// }

function OverShortTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;

  const d = payload[0].payload;

  return (
    <div
      className="grid min-w-[12rem] gap-1.5 rounded-lg border px-2.5 py-2 text-xs shadow-xl"
      style={{
        backgroundColor:
          d.overShort > 0
            ? "#94f594ff" // light green
            : d.overShort < 0
              ? "#f37171ff" // light red
              : "#999999", // gray for zero
      }}
    >
      <div
        className="text-sm font-medium"
        style={{ color: d.overShort <= 0 ? "#ffffff" : "#111827" }}
      >
        {d.date}
      </div>

      <div className="grid gap-1">
        <div className="flex justify-between">
          <span
            style={{ color: d.overShort <= 0 ? "#ffffff" : "#6b7280" }} // dark gray on green, white on red
            className="font-medium"
          >
            Over/Short
          </span>
          <span style={{ color: d.overShort <= 0 ? "#ffffff" : "#111827" }} className="font-mono font-medium">
            C$ {d.overShort.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between">
          <span style={{ color: d.overShort <= 0 ? "#ffffff" : "#6b7280" }}>Cash Collected</span>
          <span style={{ color: d.overShort <= 0 ? "#ffffff" : "#111827" }} className="font-mono font-medium">
            C$ {d.canadian_cash_collected.toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between">
          <span style={{ color: d.overShort <= 0 ? "#ffffff" : "#6b7280" }}>Reported Cash</span>
          <span style={{ color: d.overShort <= 0 ? "#ffffff" : "#111827" }} className="font-mono font-medium">
            C$ {d.report_canadian_cash.toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between">
          <span style={{ color: d.overShort <= 0 ? "#ffffff" : "#6b7280" }}>Shifts</span>
          <span style={{ color: d.overShort <= 0 ? "#ffffff" : "#111827" }} className="font-mono font-medium">
            {d.shifts}
          </span>
        </div>

        {d.notes && (
          <div className="flex justify-between items-start">
            <span style={{ color: d.overShort <= 0 ? "#ffffff" : "#6b7280" }}>Notes</span>
            <span
              style={{ color: d.overShort <= 0 ? "#ffffff" : "#111827" }}
              className="font-mono font-medium ml-2 break-words"
            >
              {d.notes}
            </span>
          </div>
        )}

      </div>
    </div>
  );
}

// export function OverShortChart({ data }: OverShortChartProps) {
//   // Compute absolute max for normalization
//   const maxAbs = Math.max(...data.map(d => Math.abs(d.overShort)), 1); // avoid divide by zero
//   const MIN_BAR_HEIGHT = 0.02;
//   // Normalize values for chart height and assign fill colors
//   const chartData = data.map(d => {
//     let relativeHeight = d.overShort / maxAbs; // -1 to 1
//     const abs = Math.abs(d.overShort);
//     let fill = "";
//     if (d.overShort > 0) fill = abs <= 20 ? "#94f594ff" : "#0af30aff"; // light/dark green
//     else if (d.overShort < 0) fill = abs <= 20 ? "#f37171ff" : "#f10b0bff"; // light/dark red
//     else fill = "#999999"

//     if (d.overShort === 0) {
//       relativeHeight = MIN_BAR_HEIGHT;
//     }
//     return {
//       ...d,
//       displayValue: relativeHeight,
//       fill,
//     };
//   });

//   return (
//     <Card className="w-full">
//       <CardHeader>
//         <CardTitle>Cash Summary Report - Over/Short</CardTitle>
//         <CardDescription>Last 10 days (normalized view)</CardDescription>
//       </CardHeader>

//       <CardContent>
//         <ResponsiveContainer width="100%" height={220}>
//           <BarChart
//             data={chartData}
//           // margin={{ top: 10, right: 0, left: 0, bottom: 10 }}
//           >
//             <CartesianGrid strokeDasharray="3 3" vertical={false} />
//             <XAxis
//               dataKey="date"
//               tick={{ fontSize: 12 }}
//               tickLine={false}
//               tickMargin={10}
//               axisLine={false}
//               tickFormatter={(value: string) => {
//                 // value is expected in YYYY-MM-DD format
//                 const [_, month, day] = value.split("-");
//                 return `${month}-${day}`;
//               }}
//             />
//             <YAxis
//               type="number"
//               domain={[-1, 1]} // normalized -1 to 1
//               tick={{ fontSize: 12 }}
//               tickLine={false}
//               axisLine={false}
//               tickFormatter={(v) => {
//                 // convert normalized back to actual value for display
//                 const realVal = Math.round(v * maxAbs * 100) / 100;
//                 return `$${realVal}`;
//               }}
//             />
//             <Tooltip content={<OverShortTooltip />} />
//             <Bar dataKey="displayValue" radius={[4, 4, 0, 0]}>
//               {chartData.map((entry, index) => (
//                 <Cell key={`cell-${index}`} fill={entry.fill} />
//               ))}
//             </Bar>
//           </BarChart>
//         </ResponsiveContainer>
//       </CardContent>

//       <CardFooter className="text-sm text-muted-foreground">
//         Bars normalized to show all differences. Click for actual values.
//       </CardFooter>
//     </Card>
//   );
// }

interface OverShortSparklineProps {
  data: {
    date: string; // YYYY-MM-DD
    overShort: number;
    canadian_cash_collected: number;
    report_canadian_cash: number;
    shifts: number;
    notes?: string;
  }[];
}

function OverShortDot({ cx, cy, payload }: any) {
  if (cx == null || cy == null) {
    return <circle cx={0} cy={0} r={0} opacity={0} />;
  }

  let fill = "#999999";
  if (payload.overShort > 0) fill = "#0af30aff"; // green
  else if (payload.overShort < 0) fill = "#f10b0bff"; // red

  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={fill}
      stroke="#111827"
      strokeWidth={0.5}
    />
  );
}

export function OverShortSparkline({ data }: OverShortSparklineProps) {
  const maxAbs = Math.max(
    ...data.map(d => Math.abs(d.overShort)),
    1 // prevent divide-by-zero
  );

  const normalizedData = data.map(d => ({
    ...d,
    normalizedOverShort: d.overShort / maxAbs,
  }));

  return (
    <Card className="w-full">
      <CardHeader>
         <CardTitle>Cash Summary Report - Over/Short</CardTitle>
        <CardDescription>Last 10 days (Trend View)</CardDescription>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={normalizedData}>
            {/* Light horizontal grid only */}
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e5e7eb"
            />

            {/* X Axis: MM-DD */}
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(v: string) => {
                const [, month, day] = v.split("-");
                return `${month}-${day}`;
              }}
            />

            {/* Y Axis hidden – sparkline style */}
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              width={52}
              domain={[-1, 1]}   // 👈 forces zero to middle
              tickFormatter={(v: number) => {
                const realVal = Math.round(v * maxAbs);
                return `C$ ${realVal}`;
              }}
            />



            {/* Zero reference line */}
            <ReferenceLine
              y={0}
              stroke="#111827"
              strokeDasharray="3 3"
              strokeWidth={1}
            />

            <Tooltip content={<OverShortTooltip />} />

            {/* Neutral bold line */}
            <Line
              type="monotone"
              dataKey="normalizedOverShort"
              stroke="#6b7280"
              strokeWidth={2.5}
              dot={<OverShortDot />}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        Click the dots for more details.
      </CardFooter>
    </Card>
  );
}