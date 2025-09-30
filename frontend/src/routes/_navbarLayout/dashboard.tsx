import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from "react";
import { LocationPicker } from "@/components/custom/locationPicker";
import { getCsoCodeByStationName, getVendorNameById } from '@/lib/utils';
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import { DatePickerWithRange } from '@/components/custom/datePickerWithRange'
import type { DateRange } from "react-day-picker"
import { TrendingUp } from 'lucide-react';

export const Route = createFileRoute('/_navbarLayout/dashboard')({
  component: RouteComponent,
})

const STATUS_KEYS = [
  "created",
  "completed",
  "placed",
  "delivered",
  "invoice_received"
];

const STATUS_LABELS: Record<string, string> = {
  created: "Created",
  completed: "Completed",
  placed: "Placed",
  delivered: "Delivered",
  invoice_received: "Invoice Received"
};

const chartConfig = {
  count: {
    label: "Cycle Counts",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const salesChartConfig = {
  FN: { label: "FN", color: "var(--chart-1)" },
  Quota: { label: "Quota", color: "var(--chart-2)" },
  Cannabis: { label: "Cannabis", color: "var(--chart-3)" },
  GRE: { label: "GRE", color: "var(--chart-4)" },
  Convenience: { label: "Convenience", color: "var(--chart-5)" },
} satisfies ChartConfig;

function RouteComponent() {
  const [site, setSite] = useState(localStorage.getItem("location") || "Rankin");
  const [orderRecs, setOrderRecs] = useState<Record<string, any[]>>({});
  const [vendorNames, setVendorNames] = useState<Record<string, string>>({});
  const [dailyCounts, setDailyCounts] = useState<{ date: string, count: number }[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);

  const [startDate, setStartDate] = useState(sevenDaysAgo.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [date, setDate] = useState<DateRange | undefined>({
    from: sevenDaysAgo,
    to: today,
  });

  useEffect(() => {
    if (date?.from && date?.to) {
      setStartDate(date.from.toISOString().slice(0, 10));
      setEndDate(date.to.toISOString().slice(0, 10));
    }
  }, [date]);

  useEffect(() => {
    setLoading(true);

    const fetchAllData = async () => {
      const params = new URLSearchParams({
        site,
        startDate,
        endDate,
      });

      // Fetch order recs by status
      const orderRecsRes = await fetch(`/api/order-rec/range?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }).then(res => res.json());

      // Fetch daily cycle count data
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const dailyCountsRes = await fetchDailyCounts(site, startDate, endDate, timezone);

      // Fetch sales data
      const csoCode = await getCsoCodeByStationName(site);
      console.log("CSO Code for", site, "is", csoCode);
      const salesDataRes = await fetchSalesData(csoCode ?? "", startDate, endDate);

      // Collect all vendor IDs from all statuses
      const vendorIds: string[] = [
        ...new Set(
          STATUS_KEYS.flatMap(key => (orderRecsRes[key] ?? []).map((rec: any) => String(rec.vendor)))
        )
      ];
      const vendorNamesObj: Record<string, string> = {};

      await Promise.all(
        vendorIds.map(async (id: string) => {
          const name = await getVendorNameById(id);
          if (name) vendorNamesObj[id] = name;
        })
      );

      setOrderRecs(orderRecsRes);
      setVendorNames(vendorNamesObj);
      setDailyCounts(dailyCountsRes.data ?? []);
      setSalesData(salesDataRes);
      setLoading(false);
    };

    fetchAllData();
  }, [site, startDate, endDate]);

  // Find the max number of vendors in any status for row count
  const maxRows = Math.max(...STATUS_KEYS.map(key => orderRecs[key]?.length ?? 0));

  // Prepare chart data from dailyCounts
  const chartData = dailyCounts.map((entry: { date: string, count: number }) => ({
    day: entry.date.slice(5), // e.g. "09-28"
    count: entry.count,
  }));

  // Prepare sales chart data
  const salesChartData = salesData.map((entry) => ({
    day: entry.Date.slice(5, 10),
    FN: entry.FN ?? 0,
    Quota: entry.Quota ?? 0,
    Cannabis: entry.Cannabis ?? 0,
    GRE: entry.GRE ?? 0,
    Convenience: entry.Convenience ?? 0,
  }));

  return (
    <div className="pt-16 flex flex-col items-center">
      <div className="flex gap-4">
        <LocationPicker
          setStationName={setSite}
          value="stationName"
          defaultValue={site}
        />

        <DatePickerWithRange date={date} setDate={setDate} />
      </div>

      <div className="mt-8 w-full max-w-4xl">
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-4">Order Recs by Status</h2>
            <table className="min-w-full border text-sm mb-8 table-fixed">
              <thead>
                <tr className="bg-gray-100">
                  {STATUS_KEYS.map(key => (
                    <th key={key} className="border px-2 py-1" style={{ width: "160px" }}>{STATUS_LABELS[key]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxRows }).map((_, rowIdx) => (
                  <tr key={rowIdx}>
                    {STATUS_KEYS.map(key => {
                      const rec = orderRecs[key]?.[rowIdx];
                      const value = rec ? (vendorNames[rec.vendor] ?? rec.vendor) : "";
                      return (
                        <td
                          key={key}
                          className="border px-2 py-1 truncate"
                          style={{
                            width: "160px",
                            maxWidth: "160px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}
                          title={value}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-col md:flex-row gap-8 mb-8">
              <Card className="w-1/2 mt-8">
                <CardHeader>
                  <CardTitle>Cycle Counts</CardTitle>
                  <CardDescription>
                    Daily cycle count entries for {site}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig}>
                    <BarChart accessibilityLayer data={chartData}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                        tickFormatter={(value) => value}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Bar dataKey="count" fill="var(--color-count)" radius={8} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 text-sm">
                  <div className="text-muted-foreground leading-none">
                    Showing cycle count entries per day for the selected range
                  </div>
                </CardFooter>
              </Card>

              <Card className="w-1/2 mt-8">
                <CardHeader>
                  <CardTitle>Sales by Category (Stacked)</CardTitle>
                  <CardDescription>Daily sales by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={salesChartConfig}>
                    <BarChart accessibilityLayer data={salesChartData}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                        tickFormatter={(value) => value.slice(0, 5)}
                      />
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="FN" stackId="a" fill="var(--chart-1)" />
                      <Bar dataKey="Quota" stackId="a" fill="var(--chart-2)" />
                      <Bar dataKey="Cannabis" stackId="a" fill="var(--chart-3)" />
                      <Bar dataKey="GRE" stackId="a" fill="var(--chart-4)" />
                      <Bar dataKey="Convenience" stackId="a" fill="var(--chart-5)" />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 text-sm">
                  <div className="text-muted-foreground leading-none">
                    Showing categorized sales per day
                  </div>
                </CardFooter>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const fetchDailyCounts = async (site: string, startDate: string, endDate: string, timezone: string) => {
  const params = new URLSearchParams({
    site,
    startDate,
    endDate,
    timezone,
  });

  return fetch(`/api/cycle-count/daily-counts?${params}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  }).then(res => res.json());
};

const fetchSalesData = async (csoCode: string, startDate: string, endDate: string) => {
  return fetch(`/api/sql/sales?csoCode=${csoCode}&startDate=${startDate}&endDate=${endDate}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  }).then(res => res.json());
};