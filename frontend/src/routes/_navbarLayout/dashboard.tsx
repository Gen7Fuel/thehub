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

import { DatePickerWithRange } from '@/components/custom/datePickerWithRange';
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
} satisfies ChartConfig;

function RouteComponent() {
  const { user } = useAuth();
  const [site, setSite] = useState(user?.location || "Rankin");
  const [_orderRecs, setOrderRecs] = useState<Record<string, any[]>>({});
  const [_vendorNames, setVendorNames] = useState<Record<string, string>>({});
  const [_vendors, setVendors] = useState<any[]>([]);
  const [dailyCounts, setDailyCounts] = useState<{ date: string, count: number }[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [vendorStatus, setVendorStatus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  const [startDate, setStartDate] = useState(sevenDaysAgo.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [date, setDate] = useState<DateRange | undefined>({ from: sevenDaysAgo, to: today });
  
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
        const orderRecsRes = await fetch(`/api/order-rec/range?${params}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }).then(res => res.json());

        // Cycle counts
        const timezone = await fetchLocation(site).then(loc => loc.timezone || "UTC");
        const dailyCountsRes = await fetchDailyCounts(site, startDate, endDate, timezone);

        // Sales data
        const csoCode = await getCsoCodeByStationName(site);
        const salesDataRes = await fetchSalesData(csoCode ?? "", startDate, endDate);

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
  const salesChartData = salesData.map(entry => ({
    day: entry.Date.slice(5, 10),
    FN: entry.FN ?? 0,
    Quota: entry.Quota ?? 0,
    Cannabis: entry.Cannabis ?? 0,
    GRE: entry.GRE ?? 0,
    Convenience: entry.Convenience ?? 0,
  }));
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
            <DatePickerWithRange date={date} setDate={setDate} />
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
                  {/* Sales by Category */}
                  <Card className="w-full">
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
                          <ChartLegend content={<ChartLegendContent data={salesChartData} />} />
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
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
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

const fetchSalesData = async (csoCode: string, startDate: string, endDate: string) => {
  return fetch(`/api/sql/sales?csoCode=${csoCode}&startDate=${startDate}&endDate=${endDate}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  }).then(res => res.json());
};

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
