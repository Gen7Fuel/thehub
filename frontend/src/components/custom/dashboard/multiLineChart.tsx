"use client";

import {
  LineChart,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Bar
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { MultiLineChartToolTip } from "@/components/ui/chart";
import { cn } from "@/lib/utils"; // your helper for classNames
// import { formatNumberCompact } from '@/routes/_navbarLayout/dashboard';

interface Props {
  data: any[];
  config: Record<string, { label: string; color: string }>;
  hideIcon?: boolean;
  className?: string;
  verticalAlign?: "top" | "bottom";
  selectedGrade?: string | null;
}

export function MultiLineChart({
  data,
  config,
  hideIcon = false,
  className,
  verticalAlign = "top",
  selectedGrade,
}: Props) {
  // Compute min & max across all grade keys
  // Compute min & max across all grade keys
  const visibleKeys = selectedGrade ? [selectedGrade] : Object.keys(config);

  const values = data.flatMap(d =>
    visibleKeys.map(k => d[k])
  );


  const actualMin = Math.min(...values);
  const actualMax = Math.max(...values);

  // Padding for nice spacing
  const zoomPadding = 5;

  // Clamp domain between 0 and 100
  const yMin = Math.max(0, actualMin - zoomPadding);
  const yMax = Math.min(100, actualMax + zoomPadding);


  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Fuel Mix Trend (Last 5 weeks)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Total fuel volume per grade
        </p>
      </CardHeader>

      {/* Custom Legend */}

      <CardContent>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              unit="L"
              domain={[yMin, yMax]}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value.toFixed(0)}
              tick={{ fontSize: 12 }}
            />

            <Tooltip content={<MultiLineChartToolTip config={config} />} />

            {Object.keys(config)
              .filter(key => !selectedGrade || key === selectedGrade)
              .map((key) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={config[key].color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}

          </LineChart>
        </ResponsiveContainer>

        <div
          className={cn(
            "flex flex-wrap items-center justify-center gap-4",
            verticalAlign === "top" ? "pb-3" : "pt-3",
            className
          )}
        >
          {Object.keys(config).map((key) => (
            <div
              key={key}
              className="flex items-center gap-1.5 [&>div]:h-2 [&>div]:w-2 [&>div]:rounded-[2px]"
            >
              {!hideIcon && (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: config[key].color }}
                />
              )}
              <span className="text-sm font-medium text-black">{config[key].label || key}</span>
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="text-sm text-muted-foreground">
        Last 5 weeks ending yesterday
      </CardFooter>
    </Card>
  );
}


// -------------------- TRANSACTIONS LINE CHART --------------------

interface TransactionsLineChartProps {
  data: any[];
  config: {
    dataKey: string;
    label: string;
    stroke: string;
  }[];
  hideIcon?: boolean;
  className?: string;
  verticalAlign?: "top" | "bottom";
}

export function TransactionsLineChart({
  data,
  config,
  hideIcon = false,
  className,
  verticalAlign = "top",
}: TransactionsLineChartProps) {
  // Convert array → record for tooltip
  const tooltipConfig = Object.fromEntries(
    config.map((c) => [c.dataKey, { label: c.label, color: c.stroke }])
  );


  return (
    <Card>
      <CardHeader>
        <CardTitle>Store Activity Trend (Daily)</CardTitle>
        <CardDescription>Total Transactions, Visits and Avg Basket Size by Day</CardDescription>
      </CardHeader>                      

      <CardContent>
        {/* <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
            />
            <YAxis tickLine={false} axisLine={false} />

            {config.map((c) => (
              <Line
                key={c.dataKey}
                type="monotone"
                dataKey={c.dataKey}
                stroke={c.stroke}
                strokeWidth={2}
                dot={false}
                name={c.label}
              />
            ))}

            <Tooltip content={<MultiLineChartToolTip config={tooltipConfig} />} />
          </LineChart>
        </ResponsiveContainer> */}
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
            />

            {/* Left Axis for Transactions + Visits */}
            <YAxis tickLine={false} axisLine={false} />

            {/* Right Axis for Avg Basket */}
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `C$ ${value}`}
            />

            {/* Bar for Avg Basket Size */}
            <Bar
              yAxisId="right"
              dataKey="avgBasket"
              fill="#d97706"
              fillOpacity={0.50}
              barSize={22}
              radius={[4, 4, 0, 0]}
            />


            {/* Line Charts */}
            {config
              .filter((c) => c.dataKey !== "avgBasket")
              .map((c) => (
                <Line
                  key={c.dataKey}
                  type="monotone"
                  dataKey={c.dataKey}
                  stroke={c.stroke}
                  strokeWidth={3}
                  dot={false}
                  name={c.label}
                />

              ))}

            <Tooltip content={<MultiLineChartToolTip config={tooltipConfig} />} />
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
              <span className="text-sm font-medium text-black">{c.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        From 14th Nov till Yesterday
      </CardFooter>
    </Card>
  );
}