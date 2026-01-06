import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import {
  ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip,
  ReferenceLine, LineChart, AreaChart, Area, Line,
  Bar, Cell,
  BarChart
} from "recharts";
import clsx from "clsx";

interface OverShortChartItem {
  date: string;
  overShort: number;
  canadian_cash_collected: number;
  report_canadian_cash: number;
  shifts: number;
  notes: string;
  fill?: string;
  displayValue?: number; // normalized for chart
}

interface OverShortChartProps {
  data: OverShortChartItem[];
}

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

export function OverShortChart({ data }: OverShortChartProps) {
  // Compute absolute max for normalization
  const maxAbs = Math.max(...data.map(d => Math.abs(d.overShort)), 1); // avoid divide by zero
  const MIN_BAR_HEIGHT = 0.02;
  // Normalize values for chart height and assign fill colors
  const chartData = data.map(d => {
    let relativeHeight = d.overShort / maxAbs; // -1 to 1
    const abs = Math.abs(d.overShort);
    let fill = "";
    if (d.overShort > 0) fill = abs <= 20 ? "#94f594ff" : "#0af30aff"; // light/dark green
    else if (d.overShort < 0) fill = abs <= 20 ? "#f37171ff" : "#f10b0bff"; // light/dark red
    else fill = "#999999"

    if (d.overShort === 0) {
      relativeHeight = MIN_BAR_HEIGHT;
    }
    return {
      ...d,
      displayValue: relativeHeight,
      fill,
    };
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Cash Summary Report - Over/Short</CardTitle>
        <CardDescription>Last 20 days (normalized view)</CardDescription>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={chartData}
          // margin={{ top: 10, right: 0, left: 0, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value: string) => {
                // value is expected in YYYY-MM-DD format
                const [_, month, day] = value.split("-");
                return `${month}-${day}`;
              }}
            />
            <YAxis
              type="number"
              domain={[-1, 1]} // normalized -1 to 1
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => {
                // convert normalized back to actual value for display
                const realVal = Math.round(v * maxAbs * 100) / 100;
                return `$${realVal}`;
              }}
            />
            <Tooltip content={<OverShortTooltip />} />
            <Bar dataKey="displayValue" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>

      <CardFooter className="text-sm text-muted-foreground">
        Bars normalized to show all differences. Click for actual values.
      </CardFooter>
    </Card>
  );
}

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
      r={3}
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
        <CardDescription>Last 20 days (Trend View)</CardDescription>
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
        <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
          <div className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 shrink-0 rounded-full" // circle
              style={{ backgroundColor: "#0af30aff" }}
            />
            <span className="text-sm font-medium text-black">
              Over
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 shrink-0 rounded-full" // circle
              style={{ backgroundColor: "#f10b0bff" }}
            />
            <span className="text-sm font-medium text-black">
              Short
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 shrink-0 rounded-full" // circle
              style={{ backgroundColor: "#999999" }}
            />
            <span className="text-sm font-medium text-black">
              Balanced
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        Click the dots for more details.
      </CardFooter>
    </Card>
  );
}


function SafeBalanceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const d = payload[0].payload;

  return (
    <div className="rounded-md border bg-background p-3 shadow-sm text-sm">
      <div className="font-medium mb-1">{label}</div>

      <div className="text-foreground">
        Balance: <span className="font-semibold">C$ {d.balance.toLocaleString()}</span>
      </div>

      {d.bankDeposit > 0 && (
        <div className="text-green-600 mt-1">
          Bank Deposit: +C$ {d.bankDeposit.toLocaleString()}
        </div>
      )}
    </div>
  );
}

interface SafeBalanceTrendChartProps {
  data: any[];
  maxBalance?: number;
}

export function SafeBalanceTrendChart({
  data,
  maxBalance = 25_000,
}: SafeBalanceTrendChartProps) {
  const balances = data.map(d => d.balance);
  const yMin = Math.min(...balances) - 1000;
  const yMax = Math.max(...balances, maxBalance) + 1000;

  const clamp = (v: number) => Math.min(100, Math.max(0, v));

  /* ------------------ Deposit marker ------------------ */
  function DepositDot({ cx, cy, payload }: any) {
    if (!payload?.bankDeposit) return null;
    return (
      <circle
        cx={cx}
        cy={cy - 4}
        r={6}
        fill="#5316a3"
        stroke="#fff"
        strokeWidth={2}
      />
    );
  }

  const legendConfig = {
    max: { label: "Max Suggested Balance", color: "#f00a0aff" },
    safe: { label: "Balance in Correct Range", color: "rgba(34,197,94,0.25)" },
    over: { label: "Over Threshold", color: "rgba(220,38,38,0.25)" },
    deposit: { label: "Bank Deposit", color: "#5316a3" },
  };

  const maxBalanceExceeded = balances.some(b => b > maxBalance);
  const maxOffset = maxBalanceExceeded
    ? clamp(((yMax - maxBalance) / (yMax - yMin)) * 100)
    : 0; // if nothing exceeds max, red area starts at 0%


  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>SafeSheet – Cash On Hand Balance</CardTitle>
        <CardDescription>Last 20 days (End of Day)</CardDescription>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" maxHeight={220}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />

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

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              width={64}
              domain={[yMin, yMax]}
              tickFormatter={(v: number) => `C$ ${Math.round(v / 1000)}k`}
            />

            {/* Max Threshold Reference Line */}
            <ReferenceLine
              y={maxBalance}
              stroke="#f00a0aff"
              strokeDasharray="3 3"
              strokeWidth={1}
              label={{ value: `Max: C$${maxBalance.toLocaleString()}`, position: "right", fontSize: 10 }}
            />

            <Tooltip content={<SafeBalanceTooltip />} />

            {/* Gradient area: green below max, red above */}
            <defs>
              <linearGradient id="safeBalanceGradient" x1="0" y1="0" x2="0" y2="1">
                {maxBalanceExceeded ? (
                  <>
                    {/* Red above max */}
                    <stop offset="0%" stopColor="rgba(220,38,38,0.25)" />
                    <stop offset={`${maxOffset}%`} stopColor="rgba(220,38,38,0.25)" />
                    <stop offset={`${maxOffset}%`} stopColor="rgba(34,197,94,0.25)" />
                    <stop offset="100%" stopColor="rgba(34,197,94,0.25)" />
                  </>
                ) : (
                  <>
                    {/* All green if under max */}
                    <stop offset="0%" stopColor="rgba(34,197,94,0.25)" />
                    <stop offset="100%" stopColor="rgba(34,197,94,0.25)" />
                  </>
                )}
              </linearGradient>
            </defs>


            {/* Area */}
            <Area
              type="monotone"
              dataKey="balance"
              stroke="none"
              fill="url(#safeBalanceGradient)"
              dot={(props: any) => <DepositDot {...props} />}
              isAnimationActive
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* ------------------ Legend ------------------ */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
          {(Object.keys(legendConfig) as Array<keyof typeof legendConfig>).map((key) => (
            <div key={key} className="flex items-center gap-1.5">
              {/* Purple dot for deposit, rectangles for areas/line */}
              {key === "deposit" ? (
                <div
                  className="h-2 w-2 shrink-0 rounded-full" // circle
                  style={{ backgroundColor: legendConfig[key].color }}
                />
              ) : key === "max" ? (
                // Dotted line for max threshold
                <div
                  className="h-0.5 w-2 shrink-0 border-b-2 border-dotted"
                  style={{ borderColor: legendConfig[key].color }}
                />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]" // rectangle
                  style={{ backgroundColor: legendConfig[key].color }}
                />
              )}
              <span className="text-sm font-medium text-black">
                {legendConfig[key].label}
              </span>
            </div>
          ))}
        </div>

      </CardContent>

      <CardFooter className="text-sm text-muted-foreground">
        End-of-day safe balance with threshold.
      </CardFooter>
    </Card>
  );
}

function DiscrepancyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const { posPayout, internalPayout, difference } = payload[0].payload;

  const diffLabel =
    difference > 0 ? "Till > POS" : "POS > Till";

  return (
    <div className="rounded-md border bg-background p-3 text-sm shadow">
      <div className="font-medium mb-1">{label}</div>

      <div className="flex justify-between gap-4">
        <span>POS Payout</span>
        <span>${posPayout.toFixed(2)}</span>
      </div>

      <div className="flex justify-between gap-4">
        <span>Till Payout</span>
        <span>${internalPayout.toFixed(2)}</span>
      </div>

      <div className="mt-2 flex justify-between font-semibold">
        <span>{diffLabel}</span>
        <span className={difference > 0 ? "text-red-600" : "text-orange-600"}>
          {difference > 0 ? "+" : ""}
          ${difference.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

interface PayablesComparisonDatum {
  date: string;              // YYYY-MM-DD
  posPayout: number;         // POS payout total for the day
  internalPayout: number;    // Till payout total for the day
  difference: number;        // internalPayout - posPayout
}

export function PayablesDiscrepancyChart({ data }: { data: PayablesComparisonDatum[] }) {
  // 1️⃣ Filter to actionable discrepancies only
  const chartData = (data || []).filter(d =>
    (d.posPayout !== 0 || d.internalPayout !== 0) &&
    d.posPayout !== d.internalPayout
  );

  // 2️⃣ Empty / success state
  if (!chartData.length) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Payout Discrepancies</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No payout discrepancies for the selected period ✅
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Payout Discrepancies</CardTitle>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
            />

            {/* Zero reference line */}
            <ReferenceLine y={0} stroke="#999" />

            <Tooltip content={<DiscrepancyTooltip />} />

            <Bar
              dataKey="difference"
              radius={[4, 4, 0, 0]}
              fill="#ef4444"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function PayablesDiscrepancyTable({
  data,
}: {
  data: PayablesComparisonDatum[];
}) {
  if (!data || data.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Payout Discrepancy Report</CardTitle>
          <CardDescription>Last 20 days (End of Day)</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No payout data available.
        </CardContent>
      </Card>
    );
  }

  // ✅ Sort newest → oldest (YYYY-MM-DD is lexicographically safe)
  const sortedData = [...data].sort(
    (a, b) => b.date.localeCompare(a.date)
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Payout Discrepancy Report</CardTitle>
        <CardDescription>Last 20 days (End of Day)</CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        {/* Table header */}
        <div className="border-b">
          <table className="w-full text-xs">
            <thead className="bg-background">
              <tr className="text-muted-foreground">
                <th className="py-2 px-3 text-left">Date</th>
                <th className="py-2 px-3 pl-10 text-right">Bulloch Payouts</th>
                <th className="py-2 px-3 text-right">Hub Payouts (Till)</th>
                <th className="py-2 px-3 text-right">Difference</th>
              </tr>
            </thead>
          </table>
        </div>

        {/* Scrollable body */}
        <div className="max-h-[220px] overflow-y-auto">
          <table className="w-full text-sm border-collapse">
            <tbody>
              {sortedData.map(row => {
                const rowClass = clsx(
                  "border-b last:border-b-0",
                  row.difference === 0 && "bg-green-50 text-green-700",
                  row.difference > 0 && "bg-red-50 text-red-700",
                  row.difference < 0 && "bg-orange-50 text-orange-700"
                );

                return (
                  <tr key={row.date} className={rowClass}>
                    <td className="py-2 px-3 font-medium">
                      {row.date}
                    </td>

                    <td className="py-2 px-3 pr-20 text-right">
                      ${row.posPayout.toFixed(2)}
                    </td>

                    <td className="py-2 px-3 pr-8 text-center">
                      ${row.internalPayout.toFixed(2)}
                    </td>

                    <td className="py-2 px-3 text-right font-semibold">
                      {row.difference > 0 && "+"}
                      ${row.difference.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* ------------------ Discrepancy Legend ------------------ */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-[2px] bg-green-50 border border-green-300" />
            <span className="text-xs font-medium text-black">
              Balanced (Bulloch Payouts = Hub Payouts)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-[2px] bg-red-50 border border-red-300" />
            <span className="text-xs font-medium text-black">
              Hub Payouts &gt; Bulloch Payouts
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-[2px] bg-orange-50 border border-orange-300" />
            <span className="text-xs font-medium text-black">
              Bulloch Payouts &gt; Hub Payouts
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}