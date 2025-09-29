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
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import { DatePickerWithRange } from '@/components/custom/datePickerWithRange'
import type { DateRange } from "react-day-picker"

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
  sales: {
    label: "Total Sales",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

function RouteComponent() {
  const [site, setSite] = useState(localStorage.getItem("location") || "Rankin");
  const [orderRecs, setOrderRecs] = useState<Record<string, any[]>>({});
  const [vendorNames, setVendorNames] = useState<Record<string, string>>({});
  const [dailyCounts, setDailyCounts] = useState<{ date: string, count: number }[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("2025-09-21");
  const [endDate, setEndDate] = useState("2025-09-27");
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(startDate),
    to: new Date(endDate),
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
  const salesChartData = salesData.map((entry: { Date: string, "Total Sales": number }) => ({
    day: entry.Date.slice(5, 10), // e.g. "09-21"
    sales: entry["Total Sales"],
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
                  <CardTitle>Sales</CardTitle>
                  <CardDescription>
                    Daily total sales for {site}
                  </CardDescription>
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
                        tickFormatter={(value) => value}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Bar dataKey="sales" fill="var(--color-sales)" radius={8} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 text-sm">
                  <div className="text-muted-foreground leading-none">
                    Showing total sales per day for the selected range
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