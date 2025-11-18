import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from "react";
import { LocationPicker } from "@/components/custom/locationPicker";
import { getCsoCodeByStationName, getVendorNameById } from '@/lib/utils';
import { Bar, BarChart, CartesianGrid, XAxis, LabelList } from "recharts";
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

// import { DatePickerWithRange } from '@/components/custom/datePickerWithRange';
import type { DateRange } from "react-day-picker";
import { useAuth } from "@/context/AuthContext";
import { getOrderRecStatusColor } from '@/lib/utils';
import { PasswordProtection } from "@/components/custom/PasswordProtection";

// Define the dashboard route using TanStack Router
export const Route = createFileRoute('/_navbarLayout/dashboard')({
  component: RouteComponent,
});

const STATUS_KEYS = ["created", "completed", "placed", "delivered", "invoice_received"];

const chartConfig = {
  count: { label: "Cycle Counts", color: "var(--chart-1)" },
} satisfies ChartConfig;

const salesChartConfig = {
  FN: { label: "FN", color: "var(--chart-1)" },
  Quota: { label: "Quota", color: "var(--chart-2)" },
  Cannabis: { label: "Cannabis", color: "var(--chart-3)" },
  GRE: { label: "GRE", color: "var(--chart-4)" },
  Convenience: { label: "Convenience", color: "var(--chart-5)" },
  Vapes: { label: "Vapes", color: "var(--chart-6)" },
  "Native Gifts": { label: "Native Gifts", color: "var(--chart-7)" },
} satisfies ChartConfig;

function RouteComponent() {
  const { user } = useAuth();
  const [site, setSite] = useState(user?.location || "Rankin");
  const [_orderRecs, setOrderRecs] = useState<Record<string, any[]>>({});
  const [_vendorNames, setVendorNames] = useState<Record<string, string>>({});
  const [_vendors, setVendors] = useState<any[]>([]);
  const [dailyCounts, setDailyCounts] = useState<{ date: string, count: number }[]>([]);
  const [salesData, setSalesData] = useState<{ daily: any[]; weekly: any[] }>({ daily: [], weekly: [] })
  const [vendorStatus, setVendorStatus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  const [startDate, setStartDate] = useState(sevenDaysAgo.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [date, _] = useState<DateRange | undefined>({ from: sevenDaysAgo, to: today });
  
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const navigate = useNavigate({ from: Route.fullPath })

  // Rendering passcode dialog for manager access 
  useEffect(() => {
    setShowPasswordDialog(true);
  }, []);

  const handlePasswordSuccess = () => {
    setHasAccess(true);
    setShowPasswordDialog(false);
  };

  const handlePasswordCancel = () => {
    setShowPasswordDialog(false)
    // Navigate back to cycle-count main page
    navigate({ to: '/' })
  }

  // ----------------------------
  // Update start/end dates when date range changes
  // ----------------------------
  useEffect(() => {
    if (date?.from && date?.to) {
      setStartDate(date.from.toISOString().slice(0, 10));
      setEndDate(date.to.toISOString().slice(0, 10));
    }
  }, [date]);

  // ----------------------------
  // Fetch dashboard data whenever site/date changes
  // ----------------------------
  useEffect(() => {
    setLoading(true);

    const fetchAllData = async () => {
      try {
        const params = new URLSearchParams({ site, startDate, endDate });

        // Order recs
        // const orderRecsRes = await fetch(`/api/order-rec/range?${params}`, {
        //   headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "X-Required-Permission": "dashboard" },
        // }).then(res => res.json());
        let orderRecsRes: any = []
        try {
          const res = await fetch(`/api/order-rec/range?${params}`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
              "X-Required-Permission": "dashboard",
            },
          });

          if (res.status === 403) {
            // Redirect to no-access page
            navigate({ to: "/no-access" });
            return;
          }

          if (!res.ok) {
            throw new Error(`Failed to fetch order records: ${res.statusText}`);
          }

          orderRecsRes = await res.json();
          // Use orderRecsRes as needed
        } catch (error: any) {
          console.error("Error fetching order records:", error);
          // Optionally handle other errors here
        }


        // Cycle counts
        const timezone = await fetchLocation(site).then(loc => loc.timezone || "UTC");
        const dailyCountsRes = await fetchDailyCounts(site, startDate, endDate, timezone);

        // Sales data
        const csoCode = await getCsoCodeByStationName(site);
        const salesDataRes = await fetchSalesData(csoCode ?? "");

        // Vendor names
        const vendorIds = [...new Set(STATUS_KEYS.flatMap(key => (orderRecsRes[key] ?? []).map((r: any) => String(r.vendor))))];
        const vendorNamesObj: Record<string, string> = {};
        await Promise.all(vendorIds.map(async (id: string) => {
          const name = await getVendorNameById(id);
          if (name) vendorNamesObj[id] = name;
        }));

        // Current week vendors
        const { startDate: weekStart, endDate: weekEnd } = getCurrentWeekRange();
        const vendorsArr = await fetchVendors(site);
        const orderRecsArr = await fetchOrderRecs(site, weekStart, weekEnd);

        const vendorOrderMap: Record<string, { orderRecId: string; currentStatus: string; date: string }> = {};
        for (const rec of orderRecsArr) {
          if (!rec.vendor) continue;
          if (!vendorOrderMap[rec.vendor] || new Date(rec.date) > new Date(vendorOrderMap[rec.vendor].date)) {
            vendorOrderMap[rec.vendor] = { orderRecId: rec._id, currentStatus: rec.currentStatus, date: rec.createdAt };
          }
        }

        const updatedVendors = vendorsArr.map((vendor: any) => ({
          ...vendor,
          orderRec: vendorOrderMap[vendor._id] ?? null,
        }));

        // Set states
        setOrderRecs(orderRecsRes);
        setVendorNames(vendorNamesObj);
        setDailyCounts(dailyCountsRes.data ?? []);
        setSalesData(salesDataRes);
        setVendors(updatedVendors);
        setVendorStatus(updatedVendors);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [site, startDate, endDate]);

  // ----------------------------
  // Prepare chart data
  // ----------------------------
  const chartData = dailyCounts.map(({ date, count }) => ({ day: date.slice(5), count }));

  // Use daily (last 7 days) for the existing stacked chart
  const salesChartData = salesData.daily.map((entry) => ({
    day: entry.day, // 'MM-DD'
    FN: entry.FN ?? 0,
    Quota: entry.Quota ?? 0,
    Cannabis: entry.Cannabis ?? 0,
    GRE: entry.GRE ?? 0,
    Convenience: entry.Convenience ?? 0,
    Vapes: entry.Vapes ?? 0,
    "Native Gifts": entry["Native Gifts"] ?? 0,
  }))

  // Weekly aggregated (last 5 weeks)
  const weeklySalesChartData = salesData.weekly.map(entry => ({
    week: entry.week,            // e.g., 'Wk of MM-DD'
    FN: entry.FN ?? 0,
    Quota: entry.Quota ?? 0,
    Cannabis: entry.Cannabis ?? 0,
    GRE: entry.GRE ?? 0,
    Convenience: entry.Convenience ?? 0,
    Vapes: entry.Vapes ?? 0,
    "Native Gifts": entry['Native Gifts'] ?? 0,
  }))
  // ----------------------------
  // Render dashboard
  // ----------------------------
  return (
    <>
      {!hasAccess && (
        <PasswordProtection
          isOpen={showPasswordDialog}
          onSuccess={handlePasswordSuccess}
          onCancel={handlePasswordCancel}
          userLocation={user?.location || "Rankin"}
        />
      )}
      {hasAccess && (
        <div className="pt-16 flex flex-col items-center">
          <div className="flex gap-4">
            <LocationPicker setStationName={setSite} value="stationName" defaultValue={site} />
            {/* <DatePickerWithRange date={date} setDate={setDate} /> */}
          </div>

          <div className="mt-8 w-full max-w-6xl">
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <div className="flex gap-8 items-start">
                <div className="w-full md:w-1/2">
                  <Card className="h-[435px] flex flex-col"> {/* Match Cycle Counts chart height */}
                    <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                      {/* Left: Title and Description */}
                      <div className="flex-1">
                        <CardTitle>Vendor Status (This Week)</CardTitle>
                        <CardDescription>Current week's vendor order status</CardDescription>
                      </div>
                      {/* Right: Status Legend */}
                      <div className="flex-1 flex flex-wrap gap-2">
                        {["Created", "Completed", "Placed", "Delivered", "Invoice Received"].map((status) => (
                          <div
                            key={status}
                            className="flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3"
                          >
                            {/* Small colored square matching chart legend */}
                            <div
                              className="h-2 w-2 shrink-0 rounded-[2px]"
                              style={{ backgroundColor: getOrderRecStatusColor(status) }}
                            />
                            {/* Text matching chart legend */}
                            <span className="text-sm font-medium text-black">{status}</span>
                          </div>
                        ))}
                      </div>

                    </CardHeader>

                    <CardContent className="flex-1 overflow-y-auto">
                      <ul className="divide-y divide-gray-200">
                        {vendorStatus.map((vendor) => (
                          <li
                            key={vendor._id}
                            className="px-2 py-1 font-medium rounded mb-1"
                            style={{
                              backgroundColor: vendor.orderRec
                                ? getOrderRecStatusColor(vendor.orderRec.currentStatus)
                                : "#F3F3F3",
                            }}
                          >
                            {vendor.orderRec ? (
                              <Link
                                to="/order-rec/$id"
                                params={{ id: vendor.orderRec.orderRecId }}
                                className="underline"
                                style={{ color: "inherit" }}
                              >
                                {vendor.name}
                              </Link>
                            ) : (
                              vendor.name
                            )}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                  <CashOnHandDisplay site={site} />
                </div>

                {/* Charts Column */}
                <div className="w-full md:w-1/2 flex flex-col gap-8">
                  {/* Cycle Counts */}
                  <Card className="w-full">
                    <CardHeader>
                      <CardTitle>Cycle Counts</CardTitle>
                      <CardDescription>Daily cycle count entries for {site}</CardDescription>
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
                          <Bar dataKey="count" fill="var(--color-count)" radius={8}>
                            <LabelList
                              position="top"
                              offset={12}
                              className="fill-foreground"
                              fontSize={12}
                            />
                          </Bar>
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                    <CardFooter className="flex-col items-start gap-2 text-sm">
                      <div className="text-muted-foreground leading-none">
                        Showing cycle count entries per day for the selected range
                      </div>
                    </CardFooter>
                  </Card>
                  {/* Sales by Category (Daily, last 7 days) */}
                  <Card className="w-full">
                    <CardHeader>
                      <CardTitle>Sales by Category (Daily)</CardTitle>
                      <CardDescription>Last 7 days (stacked)</CardDescription>
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
                            tickFormatter={(value) => value} // MM-DD
                          />
                          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                          <ChartLegend content={<ChartLegendContent data={salesChartData} />} />
                          <Bar dataKey="FN" stackId="a" fill="var(--chart-1)" />
                          <Bar dataKey="Quota" stackId="a" fill="var(--chart-2)" />
                          <Bar dataKey="Cannabis" stackId="a" fill="var(--chart-3)" />
                          <Bar dataKey="GRE" stackId="a" fill="var(--chart-4)" />
                          <Bar dataKey="Convenience" stackId="a" fill="var(--chart-5)" />
                          <Bar dataKey="Vapes" stackId="a" fill="var(--chart-6)" />
                          <Bar dataKey="Native Gifts" stackId="a" fill="var(--chart-7)" />
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                    <CardFooter className="flex-col items-start gap-2 text-sm">
                      <div className="text-muted-foreground leading-none">
                        Last 7 days ending yesterday
                      </div>
                    </CardFooter>
                  </Card>

                  {/* Sales by Category (Weekly, last 5 weeks) */}
                  <Card className="w-full">
                    <CardHeader>
                      <CardTitle>Sales by Category (Weekly)</CardTitle>
                      <CardDescription>Last 5 weeks aggregated (stacked)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={salesChartConfig}>
                        <BarChart accessibilityLayer data={weeklySalesChartData}>
                          <CartesianGrid vertical={false} />
                          <XAxis
                            dataKey="week"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                            tickFormatter={(value) => value} // e.g., Wk of MM-DD
                          />
                          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                          <ChartLegend content={<ChartLegendContent data={weeklySalesChartData} />} />
                          <Bar dataKey="FN" stackId="a" fill="var(--chart-1)" />
                          <Bar dataKey="Quota" stackId="a" fill="var(--chart-2)" />
                          <Bar dataKey="Cannabis" stackId="a" fill="var(--chart-3)" />
                          <Bar dataKey="GRE" stackId="a" fill="var(--chart-4)" />
                          <Bar dataKey="Convenience" stackId="a" fill="var(--chart-5)" />
                          <Bar dataKey="Vapes" stackId="a" fill="var(--chart-6)" />
                          <Bar dataKey="Native Gifts" stackId="a" fill="var(--chart-7)" />
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                    <CardFooter className="flex-col items-start gap-2 text-sm">
                      <div className="text-muted-foreground leading-none">
                        Weeks end on Sunday; bars labeled by week start (Mon)
                      </div>
                    </CardFooter>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function CashOnHandDisplay({ site }: { site: string }) {
  const [value, setValue] = useState<number | null>(null);
  const [loadingCash, setLoadingCash] = useState(false);
  const [errorCash, setErrorCash] = useState<string | null>(null);

  useEffect(() => {
    if (!site) {
      setValue(null);
      setErrorCash(null);
      return;
    }
    let mounted = true;

    const fetchCurrent = async () => {
      setLoadingCash(true);
      setErrorCash(null);
      console.log('[CashOnHand] fetching for site:', site);
      try {
        const res = await fetch(`/api/safesheets/site/${encodeURIComponent(site)}/current`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        console.log('[CashOnHand] raw response', res);
        const body = await res.json().catch(() => null);
        console.log('[CashOnHand] response body', body);
        if (!res.ok) throw new Error(body?.error || 'Failed to fetch cash on hand');
        if (mounted) setValue(Number(body?.cashOnHandSafe ?? null));
      } catch (err: any) {
        console.error('[CashOnHand] fetch error', err);
        if (mounted) setErrorCash(err.message || 'Unknown error');
      } finally {
        if (mounted) setLoadingCash(false);
      }
    };

    fetchCurrent();
    const interval = setInterval(fetchCurrent, 60_000); // refresh every 60s
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [site]);

  if (!site) return <div className="text-sm text-muted-foreground">No site selected</div>;
  if (loadingCash) return <div className="text-sm">Loading cash on hand...</div>;
  if (errorCash) return <div className="text-sm text-red-600">Error: {errorCash}</div>;
  return (
    <Card className="w-[260px] mt-6">
      <CardHeader className="pb-2">
        <CardTitle>Cash on hand (safe)</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        {loadingCash ? (
          <div className="text-sm">Loading...</div>
        ) : errorCash ? (
          <div className="text-sm text-red-600">Error: {errorCash}</div>
        ) : (
          <div className="text-2xl font-semibold">
            ${value !== null ? value.toFixed(2) : '—'}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          {site ? `Site: ${site}` : 'No site selected'}
        </div>
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground">
        {/* optional: last updated timestamp could go here */}
        Updated periodically
      </CardFooter>
    </Card>
  )
  // return (
  //   <div className="">
  //     Cash on hand (safe): <span className="font-semibold">${value !== null ? value.toFixed(2) : '—'}</span>
  //   </div>
  // );
}

// ----------------------------
// Helper functions
// ----------------------------
const fetchDailyCounts = async (site: string, startDate: string, endDate: string, timezone: string) => {
  const params = new URLSearchParams({ site, startDate, endDate, timezone });
  return fetch(`/api/cycle-count/daily-counts?${params}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  }).then(res => res.json());
};

// const fetchSalesData = async (csoCode: string, startDate: string, endDate: string) => {
//   return fetch(`/api/sql/sales?csoCode=${csoCode}&startDate=${startDate}&endDate=${endDate}`, {
//     headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
//   }).then(res => res.json());
// };
const fetchSalesData = async (csoCode: string) => {
  // Categories used across charts
  const CATS = ['FN', 'Quota', 'Cannabis', 'GRE', 'Convenience', 'Vapes', 'Native Gifts'] as const

  // Compute date window: last 5 weeks ending yesterday
  const end = new Date()
  end.setDate(end.getDate() - 1)           // yesterday
  end.setHours(23, 59, 59, 999)

  const start = new Date(end)
  start.setDate(start.getDate() - (7 * 5 - 1)) // 35 days window
  start.setHours(0, 0, 0, 0)

  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const startDate = fmt(start)
  const endDate = fmt(end)

  // Fetch raw rows
  const rows = await fetch(`/api/sql/sales?csoCode=${encodeURIComponent(csoCode)}&startDate=${startDate}&endDate=${endDate}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  }).then(res => res.json())

  // Build date-indexed map with sums
  const byDate: Record<string, Record<string, number>> = {}

  for (const r of Array.isArray(rows) ? rows : []) {
    const dateKey = String(r.Date_SK || r.date || '').slice(0, 10) // 'YYYY-MM-DD'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue
    byDate[dateKey] = byDate[dateKey] || Object.fromEntries(CATS.map(c => [c, 0]))
    for (const c of CATS) {
      const v = Number(r[c] ?? 0)
      if (!Number.isNaN(v)) byDate[dateKey][c] += v
    }
  }

  // Helpers for week calc (Mon-Sun weeks)
  const startOfWeek = (d: Date) => {
    const x = new Date(d)
    const day = x.getDay() // 0 Sun .. 6 Sat
    const diffToMon = day === 0 ? -6 : 1 - day
    x.setDate(x.getDate() + diffToMon)
    x.setHours(0, 0, 0, 0)
    return x
  }
  const addDays = (d: Date, n: number) => {
    const x = new Date(d); x.setDate(x.getDate() + n); return x
  }

  // Build daily (last 7 days ending yesterday), ascending by date
  const daily: any[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(end.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const k = fmt(d)
    const sums = byDate[k] || Object.fromEntries(CATS.map(c => [c, 0]))
    daily.push({ day: k.slice(5), ...sums }) // day: 'MM-DD'
  }

  // Build weekly (last 5 full weeks, ending with the week containing 'end')
  const weeks: { start: Date; end: Date }[] = []
  let wkStart = startOfWeek(end)
  for (let i = 4; i >= 0; i--) {
    const ws = new Date(wkStart); ws.setDate(wkStart.getDate() - i * 7)
    const we = addDays(ws, 6)
    weeks.push({ start: ws, end: we })
  }

  const weekly: any[] = weeks.map(({ start: ws, end: we }) => {
    const sums: Record<string, number> = Object.fromEntries(CATS.map(c => [c, 0]))
    for (let d = new Date(ws); d <= we; d = addDays(d, 1)) {
      const k = fmt(d)
      const daySums = byDate[k]
      if (!daySums) continue
      for (const c of CATS) sums[c] += Number(daySums[c] || 0)
    }
    const label = `Wk of ${fmt(ws).slice(5)}` // 'Wk of MM-DD'
    return { week: label, ...sums }
  })

  return { daily, weekly }
}

const fetchVendors = async (site: string) => {
  const params = new URLSearchParams({ location: site });
  return fetch(`/api/vendors?${params}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }).then(res => res.json());
};

const fetchOrderRecs = async (site: string, startDate: string, endDate: string) => {
  const params = new URLSearchParams({ site, startDate, endDate });
  return fetch(`/api/order-rec?${params}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }).then(res => res.json());
};

const fetchLocation = async (stationName: string) => {
  return fetch(`/api/locations/name/${encodeURIComponent(stationName)}`).then(res => res.json());
};

const getCurrentWeekRange = () => {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today); monday.setDate(today.getDate() + diffToMonday); monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999);
  return { startDate: monday.toISOString().slice(0, 10), endDate: sunday.toISOString().slice(0, 10) };
};
