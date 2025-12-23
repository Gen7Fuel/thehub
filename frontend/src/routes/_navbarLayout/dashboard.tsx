import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useMemo } from "react";
import { LocationPicker } from "@/components/custom/locationPicker";
import { getCsoCodeByStationName, getVendorNameById } from '@/lib/utils';
import { DonutSalesChart } from "@/components/custom/dashboard/salesByCategoryDonut";
import { getDashboardData, saveDashboardData, STORES } from "@/lib/dashboardIndexedDB"
import { PieTenderChart, type TenderTransaction } from "@/components/custom/dashboard/pieCharts"
import { BistroBarLineChart, Top10BistroChart } from "@/components/custom/dashboard/bistroCharts";
import {
  Bar, BarChart, CartesianGrid, XAxis, LabelList,
  Line, YAxis, Cell
} from "recharts";
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
  MultiLineChartToolTip,
  // CycleCountTooltip,
} from "@/components/ui/chart";
import { MultiLineChart, TransactionsLineChart } from "@/components/custom/dashboard/multiLineChart";
import { FuelSparkline } from "@/components/custom/dashboard/fuelSparkLine";
// import { DatePickerWithRange } from '@/components/custom/datePickerWithRange';
// import type { DateRange } from "react-day-picker";
import { useAuth } from "@/context/AuthContext";
import { getOrderRecStatusColor } from '@/lib/utils';
import { PasswordProtection } from "@/components/custom/PasswordProtection";

// Define the dashboard route using TanStack Router
export const Route = createFileRoute('/_navbarLayout/dashboard')({
  component: RouteComponent,
});

const STATUS_KEYS = ["created", "completed", "not placed", "placed", "delivered", "invoice_received"];

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
  Bistro: { label: "Bistro", color: "var(--chart-8)" },
} satisfies ChartConfig;

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CycleCountItem {
  name: string;
  upc_barcode: string;
  totalQty: number;
}

interface CycleCountDayData {
  day: string;
  count: number;
  items: CycleCountItem[];
}

interface ChartBarModalProps {
  data: CycleCountDayData | null;
  isOpen: boolean;
  onClose: () => void;
}

interface TransactionData {
  day: string;           // e.g., "11-14"
  transactions: number;
  visits: number;
  avgBasket: number;
}

type TxType = "Fuel" | "C-Store" | "Both";

export interface TimePeriodTransaction {
  Date_SK: string;
  hours: string; // normalized hour string like "05:00"
  transaction_type: TxType;
  transaction_count: number;
}

export interface HourlyRecord {
  Fuel: number;
  "C-Store": number;
  Both: number;
  count: number;
}

// type HourlyMap = Record<string, HourlyRecord>;

export const ChartBarModal: React.FC<ChartBarModalProps> = ({ data, isOpen, onClose }) => {
  if (!data) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white max-w-3xl w-full rounded-lg shadow-lg">
        <DialogHeader>
          <DialogTitle>{`Date: ${data.day}`}</DialogTitle>
          <DialogDescription>{`Total Count: ${data.count}`}</DialogDescription>
        </DialogHeader>

        {data.items.length === 0 ? (
          <div className="text-muted-foreground mt-4">No items</div>
        ) : (
          <div className="mt-4 max-h-80 overflow-y-auto w-full">
            <table className="min-w-full table-fixed border border-slate-200 divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left font-medium w-1/2 max-w-[250px] truncate">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left font-medium w-1/4 max-w-[120px]">
                    UPC
                  </th>
                  <th className="px-3 py-2 text-right font-medium w-1/4 max-w-[80px]">
                    Qty
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 truncate max-w-[250px]">{item.name}</td>
                    <td className="px-3 py-2 max-w-[120px]">{item.upc_barcode}</td>
                    <td className="px-3 py-2 text-right max-w-[80px]">{item.totalQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface SalesCards {
  month: { current: number; previous: number; changePct: string };
  week: { current: number; previous: number; changePct: string };
}

interface SalesData {
  daily: any[];
  weekly: any[];
  cards: SalesCards;
}

interface BistroWowSales {
  WeekStart: string; // or Date
  BistroSales: number;
  WoW_Growth_Pct: number | null;
  UnitsSold: number;
  Category: string;
}

export const fetchFuelMonthToMonth = async (data: any) => {
  const today = new Date();
  const end = new Date(today);
  end.setDate(today.getDate() - 1); // yesterday

  const start = new Date(end);
  start.setDate(end.getDate() - 60); // last 60 days

  const fuelData = data ?? [];
  console.log('fueldata60:', fuelData)

  if (!fuelData.length) return null;

  const byDate: Record<string, number> = {};

  fuelData.forEach((row: any) => {
    const key = (row.businessDate || "").slice(0, 10);
    if (!key.match(/^\d{4}-\d{2}-\d{2}$/)) return;
    if (!byDate[key]) byDate[key] = 0;
    byDate[key] += Number(row.fuelGradeSalesVolume || row.volume || 0) || 0;
  });

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  // --- Month-to-Month calculation (1 → yesterday) ---
  // const today = new Date();
  today.setDate(today.getDate() - 1); // yesterday

  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthEnd = new Date(prevMonthStart.getFullYear(), prevMonthStart.getMonth(), today.getDate());

  // --- Helper: sum volumes in a date range ---
  const sumVolumeByDateRange = (startD: Date, endD: Date) => {
    const startKey = fmt(startD);
    const endKey = fmt(endD);

    return Object.entries(byDate)
      .filter(([dateStr]) => dateStr >= startKey && dateStr <= endKey)
      .reduce((acc, [, vol]) => acc + vol, 0);
  };

  const currentMonthVolume = sumVolumeByDateRange(currentMonthStart, today);
  const prevMonthVolume = sumVolumeByDateRange(prevMonthStart, prevMonthEnd);
  const changePct = prevMonthVolume
    ? ((currentMonthVolume - prevMonthVolume) / prevMonthVolume) * 100
    : 0;

  return {
    currentMonthVolume,
    previousMonthVolume: prevMonthVolume,
    percent: Number(changePct.toFixed(2)),
  };
}

export function formatNumberCompact(value: number | undefined | null): string {
  if (value === null || value === undefined) return "0";

  const absValue = Math.abs(value);

  if (absValue >= 1_000_000_000) {
    return (value / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "") + "B";
  } else if (absValue >= 1_000_000) {
    return (value / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  } else if (absValue >= 1_000) {
    return (value / 1_000).toFixed(2).replace(/\.?0+$/, "") + "K";
  } else {
    return value.toString();
  }
}

interface BistroStackedChartRow {
  week: string;              // "11-17"
  sales_130: number;         // category 130 sales
  sales_134: number;         // category 134 sales
  units_130: number;         // category 130 units
  units_134: number;         // category 134 units
  growth: number | null;     // WoW growth (same for both categories)
}

interface Top10Bistro {
  Station: string; // or Date
  Item: string;
  UnitsSold: number;
  TotalSales: number;
  UnitsPerDay: number;
}

function RouteComponent() {
  const { user } = useAuth();
  const [site, setSite] = useState(user?.location || "Rankin");
  const [_orderRecs, setOrderRecs] = useState<Record<string, any[]>>({});
  const [_vendorNames, setVendorNames] = useState<Record<string, string>>({});
  const [_vendors, setVendors] = useState<any[]>([]);
  const [dailyCounts, setDailyCounts] = useState<{ date: string, count: number, items: any }[]>([]);
  const [selectedDay, setSelectedDay] = useState<CycleCountDayData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [transactionChartData, setTransactionChartData] = useState<TransactionData[]>([]);
  const [tenderTransactions, setTenderTransactions] = useState<TenderTransaction[]>([]);
  const [bistroWoWSales, setBistroWoWSales] = useState<BistroWowSales[]>([]);
  const [top10Bistro, setTop10Bistro] = useState<Top10Bistro[]>([]);

  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [vendorStatus, setVendorStatus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timePeriodData, setTimePeriodData] = useState<TimePeriodTransaction[]>([]);


  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  const [startDate,] = useState(sevenDaysAgo.toISOString().slice(0, 10));
  const [endDate,] = useState(today.toISOString().slice(0, 10));

  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [fuelData, setFuelData] = useState<any[]>([]);
  const [fuelMonthStats, setFuelMonthStats] = useState<{
    currentMonthVolume: number;
    previousMonthVolume: number;
    percent: number;
  } | null>(null);
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
  // Fetch dashboard data whenever site/date changes
  // ----------------------------
  useEffect(() => {
    setLoading(true);

    const fetchAllData = async () => {
      try {
        const params = new URLSearchParams({ site, startDate, endDate });

        // Order recs
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

        // const today = new Date();
        // const end = new Date(today);

        const today = new Date();

        // ------------------- END (yesterday) -------------------
        const end = new Date(today);
        end.setDate(end.getDate() - 1);

        // ------------------- FUEL -------------------
        const fuelStart = new Date(end);
        fuelStart.setDate(fuelStart.getDate() - 60);

        const fuelStartDate = fuelStart.toISOString().slice(0, 10);
        const fuelEndDate = end.toISOString().slice(0, 10);

        // ------------------- TRANSACTIONS -------------------
        const transStart = new Date(end);
        transStart.setDate(transStart.getDate() - 14);

        const transStartDate = transStart.toISOString().slice(0, 10);
        const transEndDate = end.toISOString().slice(0, 10);

        // ------------------- SALES -------------------
        const salesStart = new Date(end);
        salesStart.setDate(salesStart.getDate() - 59);
        salesStart.setHours(0, 0, 0, 0);

        const salesEnd = new Date(end);
        salesEnd.setHours(23, 59, 59, 999);

        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        const salesStartDate = fmt(salesStart);
        const salesEndDate = fmt(salesEnd);

        // Cycle counts
        const timezone = await fetchLocation(site).then(loc => loc.timezone || "UTC");
        const dailyCountsRes = await fetchDailyCounts(site, sevenDaysAgo.toISOString().slice(0, 10), today.toISOString().slice(0, 10), timezone);
        // const dailyCountsRes = await fetchDailyCounts(site, startDate, endDate, timezone);



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


        // end.setDate(today.getDate() - 1); // yesterday

        // const start = new Date(end);
        // start.setDate(end.getDate() - 60); // last 60 days

        // const fuelStartDate = start.toISOString().slice(0, 10)
        // const fuelEndDate = end.toISOString().slice(0, 10)

        // start.setDate(end.getDate() - 14); // last 14 days

        // const transStartDate = start.toISOString().slice(0, 10)
        // const transEndDate = end.toISOString().slice(0, 10)

        // // Sales data
        // // start.setDate(end.getDate() - 35); // last 35 days

        // end.setHours(23, 59, 59, 999)

        // start.setDate(start.getDate() - (60 - 1)) // 60 days window
        // start.setHours(0, 0, 0, 0)

        // const fmt = (d: Date) => d.toISOString().slice(0, 10)
        // const salesStartDate = fmt(start)
        // const salesEndDate = fmt(end)

        // ------------------------------------------------------------
        // 1️⃣ CHECK INDEXEDDB FIRST
        // ------------------------------------------------------------
        const salesCached = await getDashboardData(STORES.SALES, site);
        const fuelCached = await getDashboardData(STORES.FUEL, site);
        const transCached = await getDashboardData(STORES.TRANS, site);
        const timePeriodCached = await getDashboardData(STORES.TIME_PERIOD_TRANS, site);
        const tenderCached = await getDashboardData(STORES.TENDER_TRANS, site);
        const bistroWowSalesCached = await getDashboardData(STORES.BISTRO_WOW_SALES, site);
        const top10BistroCached = await getDashboardData(STORES.TOP_10_BISTRO, site);
        let sqlSales = salesCached;
        let sqlFuel = fuelCached;
        let sqlTrans = transCached;
        let sqlTimePeriodTrans = timePeriodCached;
        let sqlTenderTrans = tenderCached;
        let sqlBistroWoWSales = bistroWowSalesCached;
        let sqlTop10Bistro = top10BistroCached;

        if (
          !sqlSales?.length ||
          !sqlFuel?.length ||
          !sqlTrans?.length ||
          !sqlTimePeriodTrans?.length ||
          !sqlTenderTrans?.length ||
          !sqlBistroWoWSales?.length ||
          !sqlTop10Bistro?.length
        ) {
          console.log("📡 No cache → Calling SQL backend...");

          const csoCode = await getCsoCodeByStationName(site);

          const data = await fetchAllSqlData(
            csoCode ?? "",
            salesStartDate,
            salesEndDate,
            fuelStartDate,
            fuelEndDate,
            transStartDate,
            transEndDate
          );

          sqlSales = data.sales;
          sqlFuel = data.fuel;
          sqlTrans = data.transactions;
          sqlTimePeriodTrans = data.timePeriodTransactions;
          sqlTenderTrans = data.tenderTransactions;
          sqlBistroWoWSales = data.bistroWoWSales;
          sqlTop10Bistro = data.top10Bistro;

          // Save to IDB
          await saveDashboardData(STORES.SALES, site, sqlSales);
          await saveDashboardData(STORES.FUEL, site, sqlFuel);
          await saveDashboardData(STORES.TRANS, site, sqlTrans);
          await saveDashboardData(STORES.TIME_PERIOD_TRANS, site, sqlTimePeriodTrans);
          await saveDashboardData(STORES.TENDER_TRANS, site, sqlTenderTrans);
          await saveDashboardData(STORES.BISTRO_WOW_SALES, site, sqlBistroWoWSales);
          await saveDashboardData(STORES.TOP_10_BISTRO, site, sqlTop10Bistro);
        } else {
          console.log("⚡ Using cached dashboard SQL data");
        }

        // Fuel processing
        const { cleaned: cleanedFuelData, fullFuelData } = await fetchFuelData(sqlFuel);
        const stats = await fetchFuelMonthToMonth(fullFuelData);

        // Sales
        const salesDataRes = await fetchSalesData(sqlSales);

        // Transactions
        const transactions = sqlTrans;
        const timePeriodTransactions = sqlTimePeriodTrans;
        const tenderTransactions = sqlTenderTrans;

        const transactionModChartData = transactions.map((t: any) => ({
          day: t.Date.slice(5, 10),   // X-axis key
          transactions: t.transactions,
          visits: t.visits,
          avgBasket: t.bucket_size,
        }));



        // Set states
        setOrderRecs(orderRecsRes);
        setVendorNames(vendorNamesObj);
        setDailyCounts(dailyCountsRes.data ?? []);
        setSalesData(salesDataRes);
        setVendors(updatedVendors);
        setVendorStatus(updatedVendors);
        setFuelData(cleanedFuelData);
        setFuelMonthStats(stats);
        setTransactionChartData(transactionModChartData);
        setTenderTransactions(tenderTransactions);
        setTimePeriodData(timePeriodTransactions);
        setBistroWoWSales(sqlBistroWoWSales);
        setTop10Bistro(sqlTop10Bistro);

        console.log('top 10 bistro:', sqlTop10Bistro)
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [site, startDate, endDate]);

  // build past 7 days fuel chart data
  const fuelChartData = useMemo(() => {
    if (!fuelData?.length) return [];

    // Get unique last 7 days from the data
    const allDates = Array.from(new Set(fuelData.map(d => d.businessDate.slice(0, 10)))).sort();
    const last7Dates = allDates.slice(-7); // last 7 days

    const grades = Array.from(new Set(fuelData.map(d => d.fuelGradeDescription)));

    // Build map: day -> grade -> volume
    const byDate: Record<string, Record<string, number>> = {};
    fuelData.forEach(d => {
      const day = d.businessDate.slice(0, 10);
      if (!last7Dates.includes(day)) return; // only keep last 7 days
      if (!byDate[day]) byDate[day] = {};
      byDate[day][d.fuelGradeDescription] = Number(d.fuelGradeSalesVolume ?? 0);
    });

    // Build chart rows
    return last7Dates.map(day => {
      const row: Record<string, any> = { day: day.slice(5, 10) }; // MM-DD for x-axis
      grades.forEach(g => (row[g] = byDate[day]?.[g] ?? 0));
      return row;
    });
  }, [fuelData]);

  // Step 1: Get all unique grades from the fuel data
  const allGrades = useMemo(() => {
    if (!fuelData?.length) return [];
    return Array.from(new Set(fuelData.map(d => d.fuelGradeDescription)));
  }, [fuelData]);

  // Step 2: Assign colors to grades (same color for same grade)
  const gradeColors: Record<string, string> = useMemo(() => {
    const colors = [
      "#FF7F50", // Coral
      "#6495ED", // Cornflower Blue
      "#FFD700", // Gold
      "#40E0D0", // Turquoise
      "#FF69B4", // Hot Pink
      "#7CFC00", // Lawn Green
    ];

    return Object.fromEntries(
      allGrades.map((grade, idx) => [grade, colors[idx % colors.length]])
    );
  }, [allGrades]);

  // Step 3: Build chart configs using the same color mapping
  const fuelChartConfig: ChartConfig = useMemo(() => {
    return Object.fromEntries(
      allGrades.map(grade => [grade, { label: grade, color: gradeColors[grade] }])
    );
  }, [allGrades, gradeColors]);

  // Use the same config for 90-day chart


  const fuelChartConfig90: ChartConfig = fuelChartConfig; // reuse the same

  // 1️⃣ Compute daily total volumes and SMA
  const fuelChartDataWithSMA = useMemo(() => {
    if (!fuelChartData.length) return [];

    const totalPerDay = fuelChartData.map(row => {
      const total = Object.keys(row)
        .filter(k => k !== "day")
        .reduce((acc, grade) => acc + (row[grade] ?? 0), 0);
      return { ...row, total };
    });

    // 7-day moving average of total
    return totalPerDay.map((row, idx, arr) => {
      const slice = arr.slice(Math.max(0, idx - 6), idx + 1);
      const sma = slice.reduce((acc, r) => acc + r.total, 0) / slice.length;
      return { ...row, sma };
    });
  }, [fuelChartData]);


  const normalizedFuelChartConfig90 = Object.fromEntries(
    Object.entries(fuelChartConfig90).map(([key, val]) => [
      key,
      {
        label: val.label ? String(val.label) : key,
        color: val.color ?? "#f10f0fff", // fallback if no color
      },
    ])
  );

  const last35FuelData = useMemo(() => {
    if (!fuelData?.length) return [];

    // Get unique sorted MM-DD dates
    const allDates = Array.from(
      new Set(fuelData.map(d => d.businessDate.slice(5, 10)))
    ).sort();

    const last35Dates = new Set(allDates.slice(-35));

    return fuelData.filter(d =>
      last35Dates.has(d.businessDate.slice(5, 10))
    );
  }, [fuelData]);



  // Build 35-day  fuel chart data
  // const fuelMix90 = useMemo(() => {
  //   if (!fuelData?.length) return [];

  //   const allDates = Array.from(new Set(fuelData.map(d => d.businessDate.slice(5, 10)))).sort();
  //   const last7Dates = allDates.slice(-35); // last 35 days

  //   const grades = Array.from(new Set(fuelData.map(d => d.fuelGradeDescription)));

  //   // group by date
  //   const byDate: Record<string, Record<string, number>> = {};
  //   fuelData.forEach(d => {
  //     const day = d.businessDate.slice(5, 10);
  //     if (!last7Dates.includes(day)) return;
  //     if (!byDate[day]) byDate[day] = {};
  //     byDate[day][d.fuelGradeDescription] = Number(d.fuelGradeSalesVolume ?? 0);
  //   });

  //   // Build chart rows
  //   return last7Dates.map(day => {
  //     const row: Record<string, any> = { day }; // MM-DD for x-axis
  //     grades.forEach(g => (row[g] = byDate[day]?.[g] ?? 0));
  //     return row;
  //   });
  // }, [fuelData]);
  const fuelMix90 = useMemo(() => {
    if (!last35FuelData.length) return [];

    const grades = Array.from(
      new Set(last35FuelData.map(d => d.fuelGradeDescription))
    );

    const byDate: Record<string, Record<string, number>> = {};

    last35FuelData.forEach(d => {
      const day = d.businessDate.slice(5, 10);
      if (!byDate[day]) byDate[day] = {};
      byDate[day][d.fuelGradeDescription] =
        Number(d.fuelGradeSalesVolume ?? 0);
    });

    const dates = Object.keys(byDate).sort();

    return dates.map(day => {
      const row: Record<string, any> = { day };
      grades.forEach(g => (row[g] = byDate[day]?.[g] ?? 0));
      return row;
    });
  }, [last35FuelData]);



  // Mini fuel sparkline datasets per grade
  // const fuelSparklines = useMemo(() => {
  //   if (!fuelData?.length) return {};

  //   const grades = Array.from(new Set(fuelData.map(d => d.fuelGradeDescription)));

  //   const byGrade: Record<string, any[]> = {};

  //   grades.forEach(g => {
  //     byGrade[g] = fuelData
  //       .filter(d => d.fuelGradeDescription === g)
  //       .map(d => ({
  //         day: d.businessDate.slice(5, 10),
  //         value: Number(d.fuelGradeSalesVolume ?? 0)
  //       }))
  //       .sort((a, b) => a.day.localeCompare(b.day));
  //   });

  //   return byGrade;
  // }, [fuelData]);
  const fuelSparklines = useMemo(() => {
    if (!last35FuelData.length) return {};

    const grades = Array.from(
      new Set(last35FuelData.map(d => d.fuelGradeDescription))
    );

    const byGrade: Record<string, any[]> = {};

    grades.forEach(g => {
      byGrade[g] = last35FuelData
        .filter(d => d.fuelGradeDescription === g)
        .map(d => ({
          day: d.businessDate.slice(5, 10),
          value: Number(d.fuelGradeSalesVolume ?? 0)
        }))
        .sort((a, b) => a.day.localeCompare(b.day));
    });

    return byGrade;
  }, [last35FuelData]);



  //transactions and visits char config
  const transactionChartConfig = [
    {
      dataKey: "transactions",
      label: "Transactions",
      stroke: "#2563eb", // Blue
    },
    {
      dataKey: "visits",
      label: "Visits",
      stroke: "#16a34a", // Green
    },
    {
      dataKey: "avgBasket",
      label: "Basket Size",
      stroke: "#d97706", // Amber
    },
  ];


  // Process tender transactions for Pie chart
  const tenderChartData = useMemo(() => {
    // If tenderTransactions is null, undefined, or NOT an array → return empty
    if (!Array.isArray(tenderTransactions) || tenderTransactions.length === 0) return [];

    const totals: Record<string, number> = {};

    tenderTransactions.forEach((t) => {
      // skip invalid records
      if (!t || typeof t !== "object") return;

      // handle tender value safely
      let tender = "Other";
      if (typeof t.tender === "string" && t.tender.trim() !== "") {
        tender = t.tender.trim();
      }


      // safe transaction value
      const tx =
        typeof t.transactions === "number"
          ? t.transactions
          : Number(t.transactions) || 0;

      totals[tender] = (totals[tender] || 0) + tx;
    });

    return Object.entries(totals).map(([tender, transactions]) => ({
      tender,
      transactions,
    }));
  }, [tenderTransactions]);





  // 2️⃣ Create config with colors
  const DEFAULT_COLORS = [
    "#2563eb", "#16a34a", "#d97706", "#db2777", "#4b5563",
    "#8b5cf6", "#f59e0b", "#e11d48", "#14b8a6", "#0ea5e9",
    "#7c3aed", "#22c55e", "#f97316", "#6366f1", "#a855f7",
    "#ec4899", "#84cc16", "#06b6d4", "#facc15", "#e879f9",
  ];

  //config for the tendor pie chart
  const tenderConfig = useMemo(() => {
    if (!Array.isArray(tenderTransactions) || tenderTransactions.length === 0) return {};

    // Get unique tenders
    const uniqueTenders = Array.from(
      new Set(
        tenderTransactions.map((t) => {
          if (!t || typeof t !== "object") return "Other";
          const raw = t.tender;
          if (typeof raw === "string") return raw.trim();
          console.warn("⚠️ Non-string tender found:", raw);
          return "Other";
        })
      )
    );

    // Sort alphabetically so the same tender always gets the same color
    uniqueTenders.sort((a, b) => (a || "").localeCompare(b || ""));

    const config: Record<string, { label: string; color: string }> = {};

    uniqueTenders.forEach((tender, index) => {
      const safeTender = tender && tender !== "" ? tender : "Other";

      config[safeTender] = {
        label: safeTender,
        color: DEFAULT_COLORS[index % DEFAULT_COLORS.length], // consistent color
      };
    });

    return config;
  }, [tenderTransactions]);


  // const timePeriodChartData = useMemo(() => {
  //   if (!timePeriodData || timePeriodData.length === 0) return [];

  //   const hourlyMap: HourlyMap = {};

  //   timePeriodData.forEach((entry) => {
  //     const hour = entry.hours;                     // "15:00"
  //     const type: TxType = entry.transaction_type;  // "Fuel" | "C-Store"
  //     const count = entry.transaction_count;

  //     if (!hourlyMap[hour]) {
  //       hourlyMap[hour] = { Fuel: 0, "C-Store": 0, Both: 0, count: 0 };
  //     }

  //     hourlyMap[hour][type] += count;
  //     hourlyMap[hour].count += 1;
  //   });

  //   return Object.keys(hourlyMap)
  //     .sort()
  //     .map((hour) => {
  //       const rec = hourlyMap[hour];
  //       return {
  //         hour,
  //         Fuel: Number((rec.Fuel / rec.count).toFixed(0)),
  //         CStore: Number((rec["C-Store"] / rec.count).toFixed(0)),
  //         Both: Number((rec.Both / rec.count).toFixed(0)),
  //       };
  //     });

  // }, [timePeriodData]);
  const timePeriodChartData = useMemo(() => {
    if (!timePeriodData || timePeriodData.length === 0) return [];

    // Structure:
    // hourlyMap[hour][type] = { total: X, dates: Set([...]) }
    const hourlyMap: Record<
      string,
      Record<TxType, { total: number; dates: Set<string> }>
    > = {};

    timePeriodData.forEach((entry) => {
      const hour = entry.hours;
      const type = entry.transaction_type as TxType;
      const count = entry.transaction_count;
      const date = entry.Date_SK;

      if (!hourlyMap[hour]) {
        hourlyMap[hour] = {
          Fuel: { total: 0, dates: new Set() },
          "C-Store": { total: 0, dates: new Set() },
          Both: { total: 0, dates: new Set() }
        };
      }

      hourlyMap[hour][type].total += count;
      hourlyMap[hour][type].dates.add(date);
    });

    return Object.keys(hourlyMap)
      .sort() // sort by "05:00", "06:00", ...
      .map((hour) => {
        const rec = hourlyMap[hour];

        const avgFuel =
          rec.Fuel.total / rec.Fuel.dates.size || 0;
        const avgCStore =
          rec["C-Store"].total / rec["C-Store"].dates.size || 0;
        const avgBoth =
          rec.Both.total / rec.Both.dates.size || 0;

        return {
          hour,
          Fuel: Number(avgFuel.toFixed(0)),
          CStore: Number(avgCStore.toFixed(0)),
          Both: Number(avgBoth.toFixed(0))
        };
      });
  }, [timePeriodData]);


  const timePeriodChartConfig = useMemo(() => {
    return {
      Fuel: { label: "Fuel", color: "#2563eb" },
      CStore: { label: "C-Store", color: "#16a34a" },
      Both: { label: "Both", color: "#d97706" },
    };
  }, []);


  // Compute current and previous 7-day average basket sizes
  const avgBasketStats = useMemo(() => {
    if (!transactionChartData || transactionChartData.length === 0) return { current: 0, previous: 0, changePct: 0 };

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const formatKey = (date: Date) => date.toISOString().slice(5, 10); // 'MM-DD'

    const currentStart = new Date(yesterday);
    currentStart.setDate(yesterday.getDate() - 6); // 7-day range
    const previousStart = new Date(currentStart);
    previousStart.setDate(currentStart.getDate() - 7); // previous 7 days
    const previousEnd = new Date(currentStart);
    previousEnd.setDate(currentStart.getDate() - 1);

    const currentSlice = transactionChartData.filter(
      (d: TransactionData) => d.day >= formatKey(currentStart) && d.day <= formatKey(yesterday)
    );
    const previousSlice = transactionChartData.filter(
      (d: TransactionData) => d.day >= formatKey(previousStart) && d.day <= formatKey(previousEnd)
    );

    const currentAvg = currentSlice.length
      ? currentSlice.reduce((sum, d) => sum + (d.avgBasket || 0), 0) / currentSlice.length
      : 0;
    const previousAvg = previousSlice.length
      ? previousSlice.reduce((sum, d) => sum + (d.avgBasket || 0), 0) / previousSlice.length
      : 0;

    const changePct = previousAvg > 0 ? ((currentAvg - previousAvg) / previousAvg) * 100 : 0;

    return {
      current: Number(currentAvg.toFixed(2)),
      previous: Number(previousAvg.toFixed(2)),
      changePct: Number(changePct.toFixed(1)),
    };
  }, [transactionChartData]);

  const bistroChartData: BistroStackedChartRow[] = Object.values(
    bistroWoWSales.reduce<Record<string, BistroStackedChartRow>>(
      (acc, d) => {
        const weekDate = new Date(d.WeekStart);
        const key = `${weekDate.getMonth() + 1}-${weekDate.getDate()}`;

        if (!acc[key]) {
          acc[key] = {
            week: key,
            sales_130: 0,
            sales_134: 0,
            units_130: 0,
            units_134: 0,
            growth: d.WoW_Growth_Pct, // same across categories
          };
        }

        if (d.Category === '130') {
          acc[key].sales_130 += d.BistroSales;
          acc[key].units_130 += d.UnitsSold;
        }

        if (d.Category === '134') {
          acc[key].sales_134 += d.BistroSales;
          acc[key].units_134 += d.UnitsSold;
        }

        return acc;
      },
      {}
    )
  ).filter(d => d.growth !== null);

  const top10BistroChartData = top10Bistro.map(d => ({
    item: d.Item,
    sales: d.TotalSales,
    units: d.UnitsSold,
    unitsPerDay: d.UnitsPerDay,
  }));



  // ----------------------------
  // Prepare chart data
  // ----------------------------
  // const chartData = dailyCounts.map(({ date, count }) => ({ day: date.slice(5), count }));
  const chartData = dailyCounts.map(({ date, count, items }) => ({
    day: date.slice(5), // or whatever format you like
    count,
    items: items ?? [], // default to empty array if missing
  }));


  // Use daily (last 7 days) for the existing stacked chart
  const salesChartData = salesData?.daily.map((entry) => ({
    day: entry.day, // 'MM-DD'
    FN: entry.FN ?? 0,
    Quota: entry.Quota ?? 0,
    Cannabis: entry.Cannabis ?? 0,
    GRE: entry.GRE ?? 0,
    Convenience: entry.Convenience ?? 0,
    Vapes: entry.Vapes ?? 0,
    "Native Gifts": entry["Native Gifts"] ?? 0,
    Bistro: entry.Bistro ?? 0,
  }))

  // Weekly aggregated (last 5 weeks)
  const weeklySalesChartData = salesData?.weekly.map(entry => ({
    week: entry.week,            // e.g., 'Wk of MM-DD'
    FN: entry.FN ?? 0,
    Quota: entry.Quota ?? 0,
    Cannabis: entry.Cannabis ?? 0,
    GRE: entry.GRE ?? 0,
    Convenience: entry.Convenience ?? 0,
    Vapes: entry.Vapes ?? 0,
    "Native Gifts": entry['Native Gifts'] ?? 0,
    Bistro: entry.Bistro ?? 0,
  }))

  // Build 7-day totals for the donut chart
  const donutCategories = [
    "FN",
    "Quota",
    "Cannabis",
    "GRE",
    "Convenience",
    "Vapes",
    "Native Gifts",
    "Bistro",
  ] as const;

  // Build proper data shape for DonutSalesChart
  const donutData = donutCategories.map((cat) => ({
    category: cat,
    total: salesChartData
      ? salesChartData.reduce((sum, row) => sum + Number(row[cat] || 0), 0)
      : 0, // default to 0 if salesChartData is undefined
  }));


  const donutConfig = Object.fromEntries(
    donutCategories.map((cat, idx) => [
      cat,
      {
        label: cat,
        color: `var(--chart-${idx + 1})`,
      },
    ])
  );

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
          {/* Filters */}
          <div className="flex gap-4">
            <LocationPicker setStationName={setSite} value="stationName" defaultValue={site} />
            {/* <DatePickerWithRange date={date} setDate={setDate} /> */}
          </div>

          {/* Main container */}
          <div className="mt-8 w-full max-w-7xl">
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <>
                {/* ======================= */}
                {/*     CARD SECTION   */}
                {/* ======================= */}
                <section aria-labelledby="overview-heading" className="mb-10">
                  <h2 id="overview-heading" className="text-2xl font-bold mb-4 pl-4">Overview</h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">

                    {/* Month-to-Month Sales Card */}
                    <div className="col-span-1">
                      <div className="bg-white rounded-xl shadow p-4 flex flex-col">
                        <div className="text-sm text-muted-foreground">M-to-M C-Store Sales</div>
                        <div className="text-2xl font-bold mt-1">
                          C$ {formatNumberCompact(salesData?.cards?.month?.current).toLocaleString() ?? 0}
                        </div>
                        <div className="text-sm mt-1">
                          <span className="text-muted-foreground">
                            C$ {formatNumberCompact(salesData?.cards?.month?.previous).toLocaleString() ?? 0}
                          </span>
                          <span
                            className={`ml-2 font-semibold ${Number(salesData?.cards?.month?.changePct) >= 0
                              ? "text-green-600"
                              : "text-red-600"
                              }`}
                          >
                            ({salesData?.cards?.month?.changePct}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Week-to-Week Sales Card */}
                    <div className="col-span-1">
                      <div className="bg-white rounded-xl shadow p-4 flex flex-col">
                        <div className="text-sm text-muted-foreground">W-to-W C-Store Sales</div>
                        <div className="text-2xl font-bold mt-1">
                          C$ {formatNumberCompact(salesData?.cards?.week?.current).toLocaleString() ?? 0}
                        </div>
                        <div className="text-sm mt-1">
                          <span className="text-muted-foreground">
                            C$ {formatNumberCompact(salesData?.cards?.week?.previous).toLocaleString() ?? 0}
                          </span>
                          <span
                            className={`ml-2 font-semibold ${Number(salesData?.cards?.week?.changePct) >= 0
                              ? "text-green-600"
                              : "text-red-600"
                              }`}
                          >
                            ({salesData?.cards?.week?.changePct}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Mont to Month Fuel Volume */}
                    <div className="col-span-1">
                      <div className="bg-white rounded-xl shadow p-4 flex flex-col">
                        <div className="text-sm text-muted-foreground">M-to-M Fuel Volume</div>
                        <div className="text-2xl font-bold mt-1">
                          {formatNumberCompact(fuelMonthStats?.currentMonthVolume).toLocaleString() ?? 0} Ltrs
                        </div>
                        <div className="text-sm mt-1">
                          <span className="text-muted-foreground">
                            {formatNumberCompact(fuelMonthStats?.previousMonthVolume).toLocaleString() ?? 0} Ltrs
                          </span>
                          <span
                            className={`ml-2 font-semibold ${Number(fuelMonthStats?.percent) >= 0
                              ? "text-green-600"
                              : "text-red-600"
                              }`}
                          >
                            ({fuelMonthStats?.percent}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Cash on Hand (Accounting) */}
                    {/* <div className="col-span-1">
                      <CashOnHandDisplay site={site} />
                    </div> */}
                    {/* Avg Basket Size Card */}
                    {site !== "Jocko Point" && (
                      <div className="col-span-1">
                        <div className="bg-white rounded-xl shadow p-4 flex flex-col">
                          <div className="text-sm text-muted-foreground">Avg Basket Size (Last 7 days)</div>
                          <div className="text-2xl font-bold mt-1">
                            C$ {avgBasketStats.current}
                          </div>
                          <div className="text-sm mt-1">
                            <span className="text-muted-foreground">C$ {avgBasketStats.previous}</span>
                            <span
                              className={`ml-2 font-semibold ${avgBasketStats.changePct >= 0 ? "text-green-600" : "text-red-600"
                                }`}
                            >
                              ({avgBasketStats.changePct}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>


                {/* ======================= */}
                {/*     INVENTORY SECTION   */}
                {/* ======================= */}
                {site !== "Jocko Point" && (
                  <section aria-labelledby="inventory-heading" className="mb-10">
                    <h2 id="inventory-heading" className="text-2xl font-bold mb-4 pl-4">Inventory</h2>

                    {/* Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Vendor Status (Inventory) */}
                      <Card className="min-h-[365px] flex flex-col col-span-1">
                        <CardHeader className="space-y-2">
                          {/* Title + Description */}
                          <div>
                            <CardTitle>Vendor Status</CardTitle>
                            <CardDescription>Order Status (This Week)</CardDescription>
                          </div>

                          {/* Legend */}
                          <div className="w-full flex flex-wrap items-center gap-3 text-xs">
                            {["Created", "Completed", "Not Placed", "Placed", "Delivered", "Invoice Received"].map((status) => (
                              <div
                                key={status}
                                className="flex items-center gap-1.5 whitespace-nowrap"
                              >
                                <div
                                  className="h-2 w-2 rounded-[2px] shrink-0"
                                  style={{ backgroundColor: getOrderRecStatusColor(status) }}
                                />
                                <span className="text-xs font-medium text-black">{status}</span>
                              </div>
                            ))}
                          </div>
                        </CardHeader>


                        <CardContent className="flex-1 overflow-y-auto max-h-60">
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

                      {/* Cycle Counts (Inventory) */}
                      <Card className="col-span-1">
                        <CardHeader>
                          <CardTitle>Cycle Counts</CardTitle>
                          <CardDescription>Daily cycle count entries for {site}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ChartContainer config={chartConfig}>
                            <BarChart accessibilityLayer data={chartData}>
                              <CartesianGrid vertical={false} />
                              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={10} />
                              <YAxis axisLine={false} tickLine={false} />
                              {/* <Tooltip content={<CycleCountTooltip />} /> */}
                              {/* <Bar
                              dataKey="count"
                              fill="var(--color-count)"
                              radius={8}
                              onClick={(data) => {
                                setSelectedDay(data.payload as CycleCountDayData);
                                setIsModalOpen(true);
                              }}
                            >
                              <LabelList position="top" offset={12} className="fill-foreground" fontSize={12} />
                            </Bar> */}
                              <Bar
                                dataKey="count"
                                radius={8}
                                onClick={(data) => {
                                  setSelectedDay(data.payload as CycleCountDayData);
                                  setIsModalOpen(true);
                                }}
                              >
                                {chartData.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={entry.count === 20 ? "#22c55e" : "var(--color-count)"}
                                  />
                                ))}

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
                      <ChartBarModal
                        data={selectedDay}
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                      />

                      {/* Empty slot / placeholder: keeps grid balanced on larger screens.
                      Remove or replace with another inventory widget later. */}
                      <div className="col-span-1" />
                    </div>
                  </section>
                )}

                {/* ======================= */}
                {/*        Catgory SECTION    */}
                {/* ======================= */}
                <section aria-labelledby="sales-heading" className="mb-10">
                  <h2 id="sales-heading" className="text-2xl font-bold mb-4 pl-4">Category</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Sales by Category (Daily) */}
                    <Card className="col-span-1">
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
                              tickFormatter={(value) => value}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
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
                            <Bar dataKey="Bistro" stackId="a" fill="var(--chart-8)" />
                          </BarChart>
                        </ChartContainer>
                      </CardContent>
                      <CardFooter className="flex-col items-start gap-2 text-sm">
                        <div className="text-muted-foreground leading-none">Last 7 days ending yesterday</div>
                      </CardFooter>
                    </Card>

                    {/* Sales by Category (Weekly) */}
                    <Card className="col-span-1">
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
                              tickFormatter={(value) => value.replace(/wk of\s*/i, "")}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
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
                            <Bar dataKey="Bistro" stackId="a" fill="var(--chart-8)" />
                          </BarChart>
                        </ChartContainer>
                      </CardContent>
                      <CardFooter className="flex-col items-start gap-2 text-sm">
                        <div className="text-muted-foreground leading-none">Weeks end on Sunday; bars labeled by week start (Mon)</div>
                      </CardFooter>
                    </Card>

                    {/* Sales Breakdown (7-Day Donut) */}
                    <Card className="col-span-1">
                      <CardHeader>
                        <CardTitle>Sales Breakdown (7-Day)</CardTitle>
                        <CardDescription>Category share of last 7 days</CardDescription>
                      </CardHeader>

                      <CardContent>

                        <DonutSalesChart data={donutData} config={donutConfig} />
                      </CardContent>

                      <CardFooter className="text-sm text-muted-foreground">
                        Last 7 days ending yesterday
                      </CardFooter>
                    </Card>


                  </div>
                </section>
                {/* ======================= */}
                {/*     BISTRO SECTION   */}
                {/* ======================= */}

                {["Rankin", "Couchiching", "Silver Grizzly"].includes(site) && (
                  <section aria-labelledby="bistro-heading" className="mb-10">
                    <h2 id="bistro-heading" className="text-2xl font-bold mb-4 pl-4">
                      Bistro
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <BistroBarLineChart data={bistroChartData} />
                      <Top10BistroChart data={top10BistroChartData} />
                    </div>
                  </section>
                )}
                
                {/* ======================= */}
                {/*     FUEL SECTION   */}
                {/* ======================= */}
                <section aria-labelledby="fuel-heading" className="mb-10">
                  <h2 id="fuel-heading" className="text-2xl font-bold mb-4 pl-4">Fuel</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* 90-Day Fuel Mix Area Chart */}
                    {/* <FuelMixAreaChart data={fuelMix90} config={normalizedFuelChartConfig90} /> */}
                    <MultiLineChart
                      data={fuelMix90}
                      config={normalizedFuelChartConfig90}
                      selectedGrade={selectedGrade}
                    />

                    {/* Sparklines for each grade */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 col-span-1">
                      {Object.keys(fuelSparklines).map((grade) => (
                        <FuelSparkline
                          key={grade}
                          title={grade}
                          color={fuelChartConfig90[grade]?.color}
                          data={fuelSparklines[grade]}
                          onClick={() =>
                            setSelectedGrade(prev => (prev === grade ? null : grade))
                          }
                        />
                      ))}
                    </div>

                    {/* 7-Day Stacked Bar with SMA */}
                    <Card className="col-span-1">
                      <CardHeader>
                        <CardTitle>Fuel Volume by Grade (Daily)</CardTitle>
                        <CardDescription>Last 7 days (Stacked)</CardDescription>
                      </CardHeader>

                      <CardContent>
                        <ChartContainer config={fuelChartConfig}>
                          <BarChart data={fuelChartDataWithSMA}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="day" tickLine={false} axisLine={false} />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                            />
                            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                            <ChartLegend content={<ChartLegendContent data={fuelChartDataWithSMA} />} />

                            {/* Stacked bars */}
                            {Object.keys(fuelChartConfig).map(grade => (
                              <Bar key={grade} dataKey={grade} stackId="a" fill={fuelChartConfig[grade].color} />
                            ))}

                            {/* 7-day moving average line (total volume) */}
                            <Line type="monotone" dataKey="sma" stroke="#1F2937" strokeWidth={2} dot={false} />
                          </BarChart>
                        </ChartContainer>
                      </CardContent>

                      <CardFooter className="text-sm text-muted-foreground">
                        Last 7 days ending yesterday
                      </CardFooter>
                    </Card>

                  </div>
                </section>

                {/* ======================= */}
                {/*     Store Activity Section   */}
                {/* ======================= */}
                {site !== "Jocko Point" && (
                  <section aria-labelledby="fuel-heading" className="mb-10">
                    <h2 id="fuel-heading" className="text-2xl font-bold mb-4 pl-4">Store Activity Trend</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                      <TransactionsLineChart
                        data={transactionChartData}
                        config={transactionChartConfig}
                      />

                      <Card className="col-span-1">
                        <CardHeader>
                          <CardTitle>Avg Transactions by Hour</CardTitle>
                          <CardDescription>Aggregated across hours by Days</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ChartContainer config={timePeriodChartConfig}>
                            <BarChart data={timePeriodChartData}>
                              <CartesianGrid vertical={false} />
                              <XAxis dataKey="hour" />
                              <YAxis axisLine={false} tickLine={false} />
                              <ChartTooltip content={<MultiLineChartToolTip config={timePeriodChartConfig} labelTypeIsHour={true} />} />
                              <ChartLegend content={<ChartLegendContent data={timePeriodChartData} />} />

                              <Bar dataKey="Fuel" stackId="a" fill={timePeriodChartConfig.Fuel.color} />
                              <Bar dataKey="CStore" stackId="a" fill={timePeriodChartConfig.CStore.color} />
                              <Bar dataKey="Both" stackId="a" fill={timePeriodChartConfig.Both.color} />
                            </BarChart>
                          </ChartContainer>
                        </CardContent>
                        <CardFooter className="text-sm text-muted-foreground">
                          Aggregated hourly data - last 14 days ending Yesterday
                        </CardFooter>
                      </Card>


                      <Card className="col-span-1">
                        <CardHeader>
                          <CardTitle>Tender Breakdown (%)</CardTitle>
                          <CardDescription>Tender share by Transactions</CardDescription>
                        </CardHeader>

                        <CardContent>
                          {tenderChartData.length > 0 ? (
                            <PieTenderChart data={tenderChartData} config={tenderConfig} />
                          ) : (
                            <div className="text-center text-muted-foreground py-10">Loading...</div>
                          )}
                        </CardContent>
                        <CardFooter className="text-sm text-muted-foreground">
                          Cumulative from last 14 days ending Yesterday
                        </CardFooter>
                      </Card>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );

}

// function CashOnHandDisplay({ site }: { site: string }) {
//   const [value, setValue] = useState<number | null>(null);
//   const [noSafesheet, setNoSafesheet] = useState(false);
//   const [loadingCash, setLoadingCash] = useState(false);

//   useEffect(() => {
//     if (!site) {
//       setValue(null);
//       setNoSafesheet(false);
//       return;
//     }

//     let mounted = true;

//     const fetchCurrent = async () => {
//       setLoadingCash(true);
//       setNoSafesheet(false);

//       try {
//         const res = await fetch(
//           `/api/safesheets/site/${encodeURIComponent(site)}/current`,
//           {
//             headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
//           }
//         );

//         const body = await res.json().catch(() => null);

//         if (body?.error === "No safesheet found") {
//           if (mounted) setNoSafesheet(true);
//           return;
//         }

//         if (!res.ok) throw new Error(body?.error || "Failed to fetch cash on hand");

//         if (mounted) setValue(Number(body?.cashOnHandSafe ?? null));
//       } finally {
//         if (mounted) setLoadingCash(false);
//       }
//     };

//     fetchCurrent();
//     const interval = setInterval(fetchCurrent, 60000);
//     return () => {
//       mounted = false;
//       clearInterval(interval);
//     };
//   }, [site]);

//   // 👉 If no safesheet: show an empty card (styled but blank)
//   if (noSafesheet) {
//     return (
//       <div className="bg-white rounded-xl shadow p-4 flex flex-col w-[260px] mt-6" />
//     );
//   }

//   // Normal card
//   return (
//     <div className="col-span-1">
//       <div className="bg-white rounded-xl shadow p-4 flex flex-col">
//         <div className="text-sm text-muted-foreground">Cash on Hand (Safe)</div>
//         <div className="text-2xl font-bold mt-1">
//           {loadingCash ? (
//             <span className="text-sm">Loading...</span>
//           ) : (
//             <>C${value !== null ? value.toFixed(2) : " —"}</>
//           )}
//         </div>
//         <div className="text-sm mt-1">
//           <span className="text-muted-foreground">
//             {site ? `Site: ${site}` : ""}
//           </span>
//         </div>
//       </div>
//     </div>
//   );
// }

// ----------------------------
// Helper functions
// ----------------------------
const fetchDailyCounts = async (site: string, startDate: string, endDate: string, timezone: string) => {
  const params = new URLSearchParams({ site, startDate, endDate, timezone });
  return fetch(`/api/cycle-count/daily-counts?${params}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  }).then(res => res.json());
};

const fetchSalesData = async (rows: any) => {
  // Categories used across charts
  const CATS = ['FN', 'Quota', 'Cannabis', 'GRE', 'Convenience', 'Vapes', 'Native Gifts', 'Bistro'] as const

  // Compute date window: last 5 weeks ending yesterday
  const end = new Date()
  end.setDate(end.getDate() - 1) // yesterday
  end.setHours(23, 59, 59, 999)

  const start = new Date(end)
  // <-- changed to 60 days window (instead of 35)
  start.setDate(start.getDate() - (60 - 1)) // 60 days window
  start.setHours(0, 0, 0, 0)

  const fmt = (d: Date) => d.toISOString().slice(0, 10)

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
    const day = d.getDay(); // 0=Sun, 1=Mon
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMon);
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const addDays = (d: Date, n: number) => {
    const newDate = new Date(d);
    newDate.setDate(d.getDate() + n);
    return newDate;
  };

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

  // Build weekly (past 5 full weeks, excluding the current in-progress week)
  // We don't want to include the current week (the week that contains 'end'), so start from one week earlier.
  const weeks: { start: Date; end: Date }[] = []
  // wkStart is the Monday of the week *before* the current week
  let wkStart = startOfWeek(addDays(end, -7))
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

  // ----- Cards Calculation -----
  const today = end; // yesterday

  // Month-to-Month
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  // previous month should end on the same day-of-month as 'today' (yesterday) e.g. 1 Oct -> 18 Oct
  const prevMonthEnd = new Date(prevMonthStart.getFullYear(), prevMonthStart.getMonth(), today.getDate());

  // Helper to sum sales in a date range from byDate map using string-key comparisons (avoid timezone pitfalls)
  const sumSalesByDateRange = (startD: Date, endD: Date) => {
    const startKey = fmt(startD)
    const endKey = fmt(endD)
    return Object.entries(byDate)
      .filter(([dateStr]) => dateStr >= startKey && dateStr <= endKey)
      .reduce(
        (acc, [, row]) =>
          acc +
          Object.values(row).reduce((a, v) => a + (typeof v === "number" ? v : 0), 0),
        0
      );
  }

  const currentMonthSales = sumSalesByDateRange(currentMonthStart, today);
  const prevMonthSales = sumSalesByDateRange(prevMonthStart, prevMonthEnd);
  const monthChangePct = prevMonthSales
    ? ((currentMonthSales - prevMonthSales) / prevMonthSales) * 100
    : 0;

  // Week-to-week cards: compare Monday..yesterday of current week to matching Monday..same-weekday last week
  const currentWeekStart = startOfWeek(today);
  // number of days between currentWeekStart (Mon) and today (yesterday)
  const msPerDay = 24 * 60 * 60 * 1000;
  // const daysCount = Math.round((today.getTime() - currentWeekStart.getTime()) / msPerDay);
  const daysCount = Math.floor(
    (today.getTime() - currentWeekStart.getTime()) / msPerDay
  );
  // previous week's same weekday period:
  const prevWeekStart = addDays(currentWeekStart, -7);
  const prevWeekEnd = addDays(prevWeekStart, daysCount);

  const currentWeekSales = sumSalesByDateRange(currentWeekStart, today);
  const prevWeekSales = sumSalesByDateRange(prevWeekStart, prevWeekEnd);
  const weekChangePct = prevWeekSales
    ? ((currentWeekSales - prevWeekSales) / prevWeekSales) * 100
    : 0;

  // Return updated cards
  return {
    daily,
    weekly,
    cards: {
      month: {
        current: currentMonthSales,
        previous: prevMonthSales,
        changePct: monthChangePct.toFixed(2),
      },
      week: {
        current: currentWeekSales,
        previous: prevWeekSales,
        changePct: weekChangePct.toFixed(2),
      },
    },
  };
}

const fetchFuelData = async (rows: any) => {
  // let rows = await res.json();
  const fullFuelData = rows;
  rows = rows ?? [];

  // 1️⃣ Remove Mix&Match rows
  rows = rows.filter((r: any) => r.fuelGradeDescription !== "Mix&Match");

  // 2️⃣ Group by grade
  const grouped = rows.reduce((acc: Record<string, any[]>, row: any) => {
    const grade = row.fuelGradeDescription;
    if (!acc[grade]) acc[grade] = [];
    acc[grade].push(row);
    return acc;
  }, {});

  // Remove grades where *all* values are zero
  const cleaned = Object.values(grouped)
    .filter((gradeRows) => {
      const rowsArray = gradeRows as any[]; // assert type here
      return !rowsArray.every(r => Number(r.value) === 0);
    })
    .flat();
  return {
    cleaned,
    fullFuelData
  };
};

const fetchAllSqlData = async (
  csoCode: string,
  salesStart: string, salesEnd: string,
  fuelStart: string, fuelEnd: string,
  transStart: string, transEnd: string
) => {
  const params = new URLSearchParams({
    csoCode,

    salesStart,
    salesEnd,

    fuelStart,
    fuelEnd,

    transStart,
    transEnd
  });

  const res = await fetch(`/api/sql/all-data?${params}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
  });

  return await res.json();
};


const fetchVendors = async (site: string) => {
  const params = new URLSearchParams({ location: site });
  return fetch(`/api/vendors?${params}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }).then(res => res.json());
};

const fetchOrderRecs = async (site: string, startDate: string, endDate: string) => {
  const params = new URLSearchParams({ site, startDate, endDate });
  return fetch(`/api/order-rec?${params}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }).then(res => res.json());
};

export const fetchLocation = async (stationName: string) => {
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
