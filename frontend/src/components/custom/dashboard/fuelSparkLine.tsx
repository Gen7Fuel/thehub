"use client";

import { LineChart, Line } from "recharts";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

export function FuelSparkline({ title, color, data, onClick }: any) {
  return (
    <Card
      className="rounded-xl shadow-sm cursor-pointer hover:bg-gray-50 transition"
      onClick={onClick}
    >
      <CardContent className="pt-4">
        <div className="text-sm font-medium mb-2">{title}</div>

        <LineChart width={100} height={35} data={data}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="sma" stroke={color} strokeOpacity={0.3} strokeWidth={2} dot={false} />
        </LineChart>
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground">Last 5 weeks</CardFooter>
    </Card>
  );
}