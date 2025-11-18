"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { FuelChartTooltip } from "@/components/ui/chart";
import { cn } from "@/lib/utils"; // your helper for classNames

interface Props {
  data: any[];
  config: Record<string, { label: string; color: string }>;
  hideIcon?: boolean;
  className?: string;
  verticalAlign?: "top" | "bottom";
  selectedGrade?: string | null;
}

export function FuelMixAreaChart({
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
        {/* <AreaChart width={350} height={150} data={data}>
          <defs>
            {Object.keys(config).map((key) => (
              <linearGradient id={`grad-${key}`} key={key} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={config[key].color} stopOpacity={0.9} />
                <stop offset="95%" stopColor={config[key].color} stopOpacity={0.25} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }} // adjust font size here
          />

          <YAxis
            unit="%"
            domain={[yMin, yMax]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12 }}
          />




          <Tooltip content={<FuelChartTooltip config={config} />} />


          {Object.keys(config).map((key) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stackId="1"
              stroke={config[key].color}
              strokeWidth={1.5}
              fill={`url(#grad-${key})`}
            />
          ))}
        </AreaChart> */}
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
              tick={{ fontSize: 12 }}
            />

            <Tooltip content={<FuelChartTooltip config={config} />} />

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