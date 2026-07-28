import { useState, useMemo, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { cn } from "@/lib/utils";
import {
  Search,
  X,
  Settings2,
  Filter,
  Calendar as CalendarIcon,
  BarChart3,
  Car,
  Zap,
  Truck,
  Check,
  Package,
  XCircle,
  Clock,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  format,
  subMonths,
  isSameMonth,
  startOfMonth,
  isAfter,
  isBefore,
  parseISO,
} from "date-fns";

import { VolumePipelineChart } from "@/components/custom/fuelStatistics/VolumePipelineChart";
import { DeliveryVsConsumptionChart } from "@/components/custom/fuelStatistics/DeliveryVsConsumptionChart";

export const Route = createFileRoute(
  "/_navbarLayout/fuel-management/statistics",
)({
  component: FuelStatisticsComponent,
});

const authHeader = {
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
};

// Removed Mid Grade
const ALL_GRADES = ["Regular", "E15", "Premium", "Diesel", "Dyed Diesel"];

export const getStatusColor = (status: string) => {
  switch (status) {
    case "Created":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "In Transit":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "Delivered":
      return "bg-green-100 text-green-700 border-green-200";
    case "Cancelled":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-slate-100 text-slate-500";
  }
};

export const getGradeTheme = (grade: string) => {
  switch (grade) {
    case "Regular":
      return {
        color: "bg-green-500",
        label: "text-green-700",
        icon: Car,
        raw: "#22c55e",
        light: "bg-green-50",
      };
    case "Premium":
      return {
        color: "bg-red-500",
        label: "text-red-700",
        icon: Zap,
        raw: "#ef4444",
        light: "bg-red-50",
      };
    case "Diesel":
      return {
        color: "bg-amber-400",
        label: "text-amber-700",
        icon: Truck,
        raw: "#fbbf24",
        light: "bg-amber-50",
      };
    case "Dyed Diesel":
      return {
        color: "bg-red-800",
        label: "text-red-950",
        icon: Truck,
        raw: "#991b1b",
        light: "bg-red-50/40",
      };
    default:
      return {
        color: "bg-slate-600",
        label: "text-slate-700",
        icon: Car,
        raw: "#475569",
        light: "bg-slate-50",
      };
  }
};

// Smooth Animated Count-Up Component (2s duration)
function AnimatedNumber({
  value,
  suffix = "",
}: {
  value: number;
  suffix?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1800; // 1.8 seconds transition
    const startValue = displayValue;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);

      // Ease-out quadratic formula
      const easeOutProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(
        startValue + (value - startValue) * easeOutProgress,
      );

      setDisplayValue(current);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [value]);

  return (
    <span>
      {displayValue.toLocaleString()}{" "}
      {suffix && (
        <span className="text-sm font-semibold text-slate-500">{suffix}</span>
      )}
    </span>
  );
}

interface MonthOption {
  id: string;
  label: string;
  isCurrent: boolean;
  date: Date;
}

function FuelStatisticsComponent() {
  const [stationSearch, setStationSearch] = useState("");
  const [selectedStationIds, setSelectedStationIds] = useState<string[]>([]);
  const [selectedGrades, setSelectedGrades] = useState<string[]>(ALL_GRADES);

  // Modal inspection state for KPI Cards
  const [inspectModalStatus, setInspectModalStatus] = useState<string | null>(
    null,
  );
  const [poSearchFilter, setPoSearchFilter] = useState("");

  const SYSTEM_START_DATE = useMemo(
    () => startOfMonth(new Date(2026, 3, 1)),
    [],
  );

  const availableMonths = useMemo<MonthOption[]>(() => {
    const months: MonthOption[] = [];
    const now = new Date();
    let currentIter = startOfMonth(now);

    while (currentIter >= SYSTEM_START_DATE) {
      const isCurrent = isSameMonth(currentIter, now);
      const formattedName = format(currentIter, "MMMM yyyy");

      months.push({
        id: currentIter.toISOString(),
        label: isCurrent ? `${formattedName} [Current]` : formattedName,
        isCurrent,
        date: currentIter,
      });

      currentIter = subMonths(currentIter, 1);
    }
    return months;
  }, [SYSTEM_START_DATE]);

  const currentMonthIso = useMemo(() => {
    const current = availableMonths.find((m) => m.isCurrent);
    return current ? current.id : availableMonths[0]?.id;
  }, [availableMonths]);

  const [fromMonth, setFromMonth] = useState<string>(currentMonthIso);
  const [toMonth, setToMonth] = useState<string>(currentMonthIso);

  const handleFromMonthChange = (val: string) => {
    setFromMonth(val);
    if (isAfter(parseISO(val), parseISO(toMonth))) {
      setToMonth(val);
    }
  };

  const handleToMonthChange = (val: string) => {
    setToMonth(val);
    if (isBefore(parseISO(val), parseISO(fromMonth))) {
      setFromMonth(val);
    }
  };

  // Fetch Locations
  const { data: locations = [] } = useQuery({
    queryKey: ["all-locations"],
    queryFn: async () => {
      const res = await axios.get(
        "/api/fuel-station-tanks/all-locations",
        authHeader,
      );
      return res.data;
    },
    retry: 2,
  });

  const hasInitialLoaded = useRef(false);

  useEffect(() => {
    if (locations.length > 0 && !hasInitialLoaded.current) {
      const stationsWithTanks = locations
        .filter((loc: any) => loc.tankCount > 0)
        .map((loc: any) => loc._id);

      setSelectedStationIds(stationsWithTanks);
      hasInitialLoaded.current = true;
    }
  }, [locations]);

  // Query Backend Pipeline Summary
  const { data: rawOrdersResponse = [], isLoading: isOrdersLoading } = useQuery(
    {
      queryKey: ["pipeline-summary", selectedStationIds, fromMonth, toMonth],
      queryFn: async () => {
        if (selectedStationIds.length === 0 || !fromMonth || !toMonth) {
          return [];
        }
        const res = await axios.post(
          "/api/fuel-statistics/pipeline-summary",
          { stationIds: selectedStationIds, fromMonth, toMonth },
          authHeader,
        );
        return res.data?.data || [];
      },
      enabled:
        selectedStationIds.length > 0 && Boolean(fromMonth) && Boolean(toMonth),
    },
  );
  // --- Query 2: Backend Daily Sales Summary (FuelSales + FuelSalesArchived) ---
  const { data: rawSalesResponse = [], isLoading: isSalesLoading } = useQuery({
    queryKey: ["sales-summary", selectedStationIds, fromMonth, toMonth],
    queryFn: async () => {
      if (selectedStationIds.length === 0 || !fromMonth || !toMonth) {
        return [];
      }
      const res = await axios.post(
        "/api/fuel-statistics/sales-summary",
        { stationIds: selectedStationIds, fromMonth, toMonth },
        authHeader,
      );
      return res.data?.data || [];
    },
    enabled:
      selectedStationIds.length > 0 && Boolean(fromMonth) && Boolean(toMonth),
  });

  // Temporarily consume the variables to satisfy TypeScript compiler
  useEffect(() => {
    if (rawSalesResponse.length > 0) {
      console.log("Sales data loaded:", rawSalesResponse.length, "days");
    }
  }, [rawSalesResponse]);

  // Calculate Metrics & Categorized Orders
  const { kpiMetrics, categorizedOrders } = useMemo(() => {
    const orders = rawOrdersResponse || [];

    let deliveredLtrs = 0;
    let inTransitLtrs = 0;
    let pipelineLtrs = 0;
    let cancelledLtrs = 0;

    const categorized: Record<string, any[]> = {
      Delivered: [],
      "In Transit": [],
      Created: [],
      Cancelled: [],
      All: [],
    };

    orders.forEach((order: any) => {
      const status = order.currentStatus;
      const items = order.items || [];
      let hasMatchingGrade = false;

      items.forEach((item: any) => {
        if (!selectedGrades.includes(item.grade)) return;
        hasMatchingGrade = true;

        const volume = Number(item.ltrs) || 0;

        if (status === "Delivered") {
          deliveredLtrs += volume;
        } else if (status === "In Transit") {
          inTransitLtrs += volume;
        } else if (status === "Created") {
          pipelineLtrs += volume;
        } else if (status === "Cancelled") {
          cancelledLtrs += volume;
        }
      });

      if (hasMatchingGrade) {
        categorized.All.push(order);
        if (categorized[status]) {
          categorized[status].push(order);
        }
      }
    });

    return {
      kpiMetrics: {
        deliveredLtrs,
        inTransitLtrs,
        pipelineLtrs,
        cancelledLtrs,
        deliveredCount: categorized.Delivered.length,
        inTransitCount: categorized["In Transit"].length,
        pipelineCount: categorized.Created.length,
        cancelledCount: categorized.Cancelled.length,
        totalOrdersCount: categorized.All.length,
      },
      categorizedOrders: categorized,
    };
  }, [rawOrdersResponse, selectedGrades]);

  const filteredLocations = useMemo(() => {
    return locations.filter((loc: any) =>
      (loc.site ?? loc.stationName)
        .toLowerCase()
        .includes(stationSearch.toLowerCase()),
    );
  }, [locations, stationSearch]);

  const toggleStation = (id: string) => {
    setSelectedStationIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const toggleAllStations = () => {
    if (selectedStationIds.length === locations.length) {
      setSelectedStationIds([]);
    } else {
      setSelectedStationIds(locations.map((loc: any) => loc._id));
    }
  };

  const toggleGrade = (grade: string) => {
    setSelectedGrades((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade],
    );
  };

  const toggleAllGrades = () => {
    if (selectedGrades.length === ALL_GRADES.length) {
      setSelectedGrades([]);
    } else {
      setSelectedGrades(ALL_GRADES);
    }
  };

  const fromMonthLabel = availableMonths
    .find((m) => m.id === fromMonth)
    ?.label.replace(" [Current]", "");
  const toMonthLabel = availableMonths
    .find((m) => m.id === toMonth)
    ?.label.replace(" [Current]", "");

  // Orders displayed inside dialog
  const activeDialogOrders = useMemo(() => {
    if (!inspectModalStatus) return [];
    const list = categorizedOrders[inspectModalStatus] || [];
    return list.filter(
      (o: any) =>
        o.poNumber.toLowerCase().includes(poSearchFilter.toLowerCase()) ||
        (o.carrier?.carrierName ?? o.carrier?.name ?? "")
          .toLowerCase()
          .includes(poSearchFilter.toLowerCase()) ||
        (o.rack?.rackName ?? o.rack?.terminalName ?? "")
          .toLowerCase()
          .includes(poSearchFilter.toLowerCase()),
    );
  }, [inspectModalStatus, categorizedOrders, poSearchFilter]);

  return (
    <div className="w-full min-h-screen bg-[#f8fafc] pb-10">
      {/* HEADER SECTION */}
      <div className="w-full bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="w-full px-6 py-4 flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left: Title & Site Authorization */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-600 p-1.5 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-white" />
                  </div>
                  <h1 className="text-xl font-black tracking-tight text-slate-800 uppercase">
                    Fuel Statistics
                  </h1>
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-blue-200 text-blue-700 hover:bg-blue-50 font-bold gap-2"
                    >
                      <Settings2 className="h-4 w-4" />
                      Manage Sites
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader className="flex flex-row items-center justify-between pr-6">
                      <DialogTitle className="flex items-center gap-2 text-2xl font-black uppercase">
                        <Filter className="h-5 w-5 text-blue-600" />
                        Authorize Sites for Statistics
                      </DialogTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleAllStations}
                        className="text-[10px] font-black uppercase tracking-tighter text-blue-600 hover:bg-blue-50"
                      >
                        {selectedStationIds.length === locations.length
                          ? "Deselect All"
                          : "Select All"}
                      </Button>
                    </DialogHeader>

                    <div className="relative my-4">
                      <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                      <Input
                        placeholder="Search stations by name..."
                        className="pl-10 h-12 text-lg shadow-sm"
                        value={stationSearch}
                        onChange={(e) => setStationSearch(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                      {filteredLocations.map((loc: any) => {
                        const hasNoTanks = loc.tankCount === 0;

                        return (
                          <div
                            key={loc._id}
                            className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all ${
                              selectedStationIds.includes(loc._id)
                                ? "border-blue-500 bg-blue-50/50 shadow-md"
                                : hasNoTanks
                                  ? "border-slate-50 bg-slate-50/30 opacity-60 grayscale"
                                  : "border-slate-100 hover:border-slate-300"
                            }`}
                            onClick={() =>
                              !hasNoTanks && toggleStation(loc._id)
                            }
                          >
                            <div className="flex flex-col">
                              <span
                                className={`font-bold ${hasNoTanks ? "text-slate-400" : "text-slate-800"}`}
                              >
                                {loc.site ?? loc.stationName}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono uppercase">
                                {loc.fuelStationNumber} • {loc.tankCount} Tanks
                              </span>
                            </div>

                            {hasNoTanks ? (
                              <span className="text-[8px] font-black uppercase text-slate-400 bg-slate-100 px-2 py-1 rounded">
                                Inactive
                              </span>
                            ) : (
                              <Checkbox
                                checked={selectedStationIds.includes(loc._id)}
                                className="h-5 w-5 border-2 rounded-md"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Station Tag Cloud */}
              <div className="flex flex-wrap gap-2 min-h-[46px] p-2 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 items-center">
                {selectedStationIds.length === 0 ? (
                  <span className="text-xs text-slate-400 italic px-2">
                    No stations selected. Click 'Manage Sites' to populate your
                    dashboard.
                  </span>
                ) : (
                  selectedStationIds.map((id) => {
                    const loc = locations.find((l: any) => l._id === id);
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-1.5 bg-white border border-blue-100 pl-3 pr-1.5 py-1 rounded-full text-xs font-black text-blue-800 shadow-sm"
                      >
                        {loc?.site ?? loc?.stationName}
                        <button
                          onClick={() => toggleStation(id)}
                          className="p-0.5 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: From & To Month Selectors */}
            <div className="flex flex-col items-start lg:items-end gap-2 shrink-0 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-black uppercase text-slate-600 tracking-wider">
                  Reporting Range
                </span>
              </div>

              <div className="flex items-center gap-2 w-full lg:w-auto">
                <Select value={fromMonth} onValueChange={handleFromMonthChange}>
                  <SelectTrigger className="w-[160px] h-9 bg-white font-bold text-xs border-slate-300">
                    <SelectValue placeholder="From Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.map((m) => (
                      <SelectItem
                        key={m.id}
                        value={m.id}
                        className="text-xs font-medium"
                      >
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />

                <Select value={toMonth} onValueChange={handleToMonthChange}>
                  <SelectTrigger className="w-[160px] h-9 bg-white font-bold text-xs border-slate-300">
                    <SelectValue placeholder="To Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.map((m) => (
                      <SelectItem
                        key={m.id}
                        value={m.id}
                        className="text-xs font-medium"
                      >
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <span className="text-[10px] font-bold text-blue-700">
                Range: {fromMonthLabel} to {toMonthLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="w-full px-6 py-6 space-y-6">
        {/* GRADE FILTER TOOLBAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
              Filter by Grade:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAllGrades}
              className="text-xs font-black uppercase tracking-wider text-blue-600 hover:bg-blue-50 mr-2"
            >
              {selectedGrades.length === ALL_GRADES.length
                ? "Clear All"
                : "Select All"}
            </Button>

            {ALL_GRADES.map((grade) => {
              const theme = getGradeTheme(grade);
              const isSelected = selectedGrades.includes(grade);

              return (
                <button
                  key={grade}
                  onClick={() => toggleGrade(grade)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-black transition-all shadow-sm",
                    isSelected
                      ? `${theme.color} text-white border-transparent shadow-md scale-105`
                      : "bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300",
                  )}
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      isSelected ? "bg-white" : "bg-slate-400",
                    )}
                  />
                  {grade}
                  {isSelected && <Check className="h-3 w-3 ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* TOP KPI SUMMARY CARDS (5-CARD GRID LAYOUT) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Delivered Card */}
          <Card
            onClick={() => setInspectModalStatus("Delivered")}
            className="border-2 border-green-100 bg-gradient-to-br from-green-50/50 to-white shadow-sm hover:shadow-md hover:border-green-300 transition-all cursor-pointer group"
          >
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-wider text-green-700 flex items-center gap-1">
                  Total Delivered{" "}
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>

                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  {isOrdersLoading ? (
                    "---"
                  ) : (
                    <AnimatedNumber
                      value={kpiMetrics.deliveredLtrs}
                      suffix="Ltrs"
                    />
                  )}
                </h3>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="bg-green-500 p-3 rounded-2xl shadow-sm text-white">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <span className="text-[11px] font-black uppercase text-green-800 bg-green-100 px-2.5 py-0.5 rounded-full border border-green-200">
                  {kpiMetrics.deliveredCount} Orders
                </span>
              </div>
            </CardContent>
          </Card>

          {/* In Transit Card */}
          <Card
            onClick={() => setInspectModalStatus("In Transit")}
            className="border-2 border-blue-100 bg-gradient-to-br from-blue-50/50 to-white shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
          >
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-wider text-blue-700 flex items-center gap-1">
                  In Transit{" "}
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>

                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  {isOrdersLoading ? (
                    "---"
                  ) : (
                    <AnimatedNumber
                      value={kpiMetrics.inTransitLtrs}
                      suffix="Ltrs"
                    />
                  )}
                </h3>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="bg-blue-600 p-3 rounded-2xl shadow-sm text-white">
                  <Truck className="h-6 w-6" />
                </div>
                <span className="text-[11px] font-black uppercase text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full border border-blue-200">
                  {kpiMetrics.inTransitCount} Orders
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline/Created Card */}
          <Card
            onClick={() => setInspectModalStatus("Created")}
            className="border-2 border-amber-100 bg-gradient-to-br from-amber-50/50 to-white shadow-sm hover:shadow-md hover:border-amber-300 transition-all cursor-pointer group"
          >
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-wider text-amber-700 flex items-center gap-1">
                  Scheduled / Pipeline{" "}
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>

                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  {isOrdersLoading ? (
                    "---"
                  ) : (
                    <AnimatedNumber
                      value={kpiMetrics.pipelineLtrs}
                      suffix="Ltrs"
                    />
                  )}
                </h3>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="bg-amber-500 p-3 rounded-2xl shadow-sm text-white">
                  <Clock className="h-6 w-6" />
                </div>
                <span className="text-[11px] font-black uppercase text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                  {kpiMetrics.pipelineCount} Orders
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Cancelled Card */}
          <Card
            onClick={() => setInspectModalStatus("Cancelled")}
            className="border-2 border-rose-100 bg-gradient-to-br from-rose-50/50 to-white shadow-sm hover:shadow-md hover:border-rose-300 transition-all cursor-pointer group"
          >
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-wider text-rose-700 flex items-center gap-1">
                  Cancelled{" "}
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>

                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  {isOrdersLoading ? (
                    "---"
                  ) : (
                    <AnimatedNumber
                      value={kpiMetrics.cancelledLtrs}
                      suffix="Ltrs"
                    />
                  )}
                </h3>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="bg-rose-500 p-3 rounded-2xl shadow-sm text-white">
                  <XCircle className="h-6 w-6" />
                </div>
                <span className="text-[11px] font-black uppercase text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200">
                  {kpiMetrics.cancelledCount} Orders
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Total Orders Card */}
          <Card
            onClick={() => setInspectModalStatus("All")}
            className="border-2 border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-400 transition-all cursor-pointer group"
          >
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  Total Orders{" "}
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>

                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  {isOrdersLoading ? (
                    "---"
                  ) : (
                    <AnimatedNumber
                      value={kpiMetrics.totalOrdersCount}
                      suffix="Orders"
                    />
                  )}
                </h3>
              </div>

              <div className="bg-slate-700 p-3 rounded-2xl shadow-sm text-white">
                <Package className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>
        {/* CHART SECTION: 3 EQUAL PARTS LAYOUT */}
        {/* CHARTS ROW */}
        {/* 12-column or 3-column grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {/* Takes 1/3 width on large screens */}
          <div className="lg:col-span-1 min-w-0">
            <VolumePipelineChart
              orders={rawOrdersResponse}
              selectedGrades={selectedGrades}
              getGradeTheme={getGradeTheme}
              isLoading={isOrdersLoading}
            />
          </div>

          {/* Takes 2/3 width on large screens */}
          <div className="lg:col-span-2 min-w-0">
            <DeliveryVsConsumptionChart
              orders={rawOrdersResponse}
              sales={rawSalesResponse}
              selectedGrades={selectedGrades}
              fromMonth={fromMonth}
              toMonth={toMonth}
              isLoading={isOrdersLoading || isSalesLoading}
            />
          </div>
        </div>
      </div>

      {/* INSPECT ORDERS DIALOG */}
      <Dialog
        open={Boolean(inspectModalStatus)}
        onOpenChange={() => {
          setInspectModalStatus(null);
          setPoSearchFilter("");
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-1xl font-black uppercase">
              <Package className="h-6 w-6 text-blue-600" />
              Orders Breakdown - {inspectModalStatus} (
              {activeDialogOrders.length})
            </DialogTitle>
          </DialogHeader>

          <div className="relative my-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search PO Number, Carrier, or Rack..."
              className="pl-9 h-10 text-sm"
              value={poSearchFilter}
              onChange={(e) => setPoSearchFilter(e.target.value)}
            />
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
            {activeDialogOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm font-semibold">
                No matching orders found.
              </div>
            ) : (
              activeDialogOrders.map((order: any) => {
                const carrierName =
                  order.carrier?.carrierName ??
                  order.carrier?.name ??
                  "Unassigned Carrier";
                const rackName =
                  order.rack?.rackName ??
                  order.rack?.terminalName ??
                  "Unassigned Rack";
                const siteName =
                  order.station?.site ?? order.station?.stationName ?? "Store";

                return (
                  <div
                    key={order._id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4 shadow-sm"
                  >
                    {/* Left Column: PO, Status, Site, Carrier, Rack */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-900 text-sm">
                          {order.poNumber}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${getStatusColor(order.currentStatus)}`}
                        >
                          {order.currentStatus}
                        </span>
                      </div>

                      <div className="flex flex-col gap-0.5 text-xs text-slate-600 font-medium">
                        <span>
                          <strong>Site:</strong> {siteName}
                        </span>
                        <span>
                          <strong>Carrier:</strong> {carrierName}
                        </span>
                        <span>
                          <strong>Rack:</strong> {rackName}
                        </span>
                      </div>
                    </div>

                    {/* Right Column: Grades Stacked Vertically */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0 self-start sm:self-center">
                      {(order.items || []).map((it: any) => {
                        if (!it.ltrs) return null;
                        return (
                          <span
                            key={it._id}
                            className="text-[11px] font-black px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap text-right min-w-[130px]"
                          >
                            {it.grade}: {it.ltrs.toLocaleString()} L
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
