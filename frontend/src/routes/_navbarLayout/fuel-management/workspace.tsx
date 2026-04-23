import { useState, useMemo, useEffect, useRef } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // Recommended for fetching
import axios from 'axios';
import { cn } from "@/lib/utils";
import {
  Search, X, ChevronLeft, ChevronRight, Building2,
  Settings2, Filter, History, ArrowRight
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { format, addDays, isAfter, startOfDay } from "date-fns";
import { WorkspaceDatePicker, DatePicker } from '@/components/custom/datePicker';
import { Loader2, RefreshCw, Truck, Clock, Edit3, CheckCircle2, PackagePlus, AlertTriangle, FileText, Download } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
// import { Label } from "@/components/ui/label";
import { getGradeTheme } from "./manage/locations/$id"
import { POPreviewDocument, formatPDFDate, getISODateOnly } from "@/components/custom/fuelPoPDF"
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { formatInTimeZone } from 'date-fns-tz';

export const Route = createFileRoute('/_navbarLayout/fuel-management/workspace')({
  component: WorkspaceComponent,
});

interface RescheduleDialogProps {
  order: any;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string;
}

const authHeader = {
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'Created': return 'bg-yellow-100 text-yellow-600 border-yellow-200'; // Neutral for new orders
    case 'In Transit': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'Delivered': return 'bg-green-100 text-green-700 border-green-200';
    default: return 'bg-slate-100 text-slate-500';
  }
};

function WorkspaceComponent() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [stationSearch, setStationSearch] = useState("");
  const [selectedStationIds, setSelectedStationIds] = useState<string[]>([]);
  const authHeader = {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  };

  // 1. Fetch Real Locations from your Backend
  const { data: locations = [] } = useQuery({
    queryKey: ['all-locations'],
    queryFn: async () => {
      const res = await axios.get('/api/fuel-station-tanks/all-locations', authHeader);
      return res.data;
    }
  });

  // Place this inside WorkspaceComponent, after the 'locations' useQuery

  const sortedSelectedStations = useMemo(() => {
    // 1. Map IDs to full objects
    const selectedLocs = selectedStationIds
      .map(id => locations.find((l: any) => l._id === id))
      .filter(Boolean);

    // 2. Sort logic
    return [...selectedLocs].sort((a: any, b: any) => {
      const provA = (a.province || "").toUpperCase();
      const provB = (b.province || "").toUpperCase();

      // --- STEP 1: PROVINCE PRIORITY ---
      // If provinces are different, handle Ontario vs Others
      if (provA !== provB) {
        if (provA === "ON" || provA === "ONTARIO") return -1;
        if (provB === "ON" || provB === "ONTARIO") return 1;
        return provA.localeCompare(provB);
      }

      // --- STEP 2: NATURAL SELECTION ORDER ---
      // If they are in the same province, use the order of selectedStationIds
      const indexA = selectedStationIds.indexOf(a._id);
      const indexB = selectedStationIds.indexOf(b._id);

      return indexA - indexB;
    });
  }, [selectedStationIds, locations]);

  const hasInitialLoaded = useRef(false);

  useEffect(() => {
    if (locations.length > 0 && !hasInitialLoaded.current) {
      // Filter out stations with 0 tanks, then map to their IDs
      const stationsWithTanks = locations
        .filter((loc: any) => loc.tankCount > 0)
        .map((loc: any) => loc._id);

      setSelectedStationIds(stationsWithTanks);
      hasInitialLoaded.current = true;
    }
  }, [locations]);

  // Filter locations for the Dialog Search
  const filteredLocations = useMemo(() => {
    return locations.filter((loc: any) =>
      loc.stationName.toLowerCase().includes(stationSearch.toLowerCase())
    );
  }, [locations, stationSearch]);

  const shiftDate = (amount: number) => {
    // Use pure local system time for the "Future" boundary
    const localToday = startOfDay(new Date());
    const maxFuture = addDays(localToday, 4);
    const newDate = addDays(selectedDate, amount);

    if (isAfter(newDate, maxFuture)) return;
    setSelectedDate(newDate);
  };

  const toggleStation = (id: string) => {
    setSelectedStationIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // 1. Bulk toggle function for convenience
  const toggleAll = () => {
    if (selectedStationIds.length === locations.length) {
      setSelectedStationIds([]); // Deselect all
    } else {
      setSelectedStationIds(locations.map((loc: any) => loc._id)); // Select all
    }
  };

  return (
    // "w-full" and no max-width ensures it hits the edges of the screen
    <div className="w-full min-h-screen bg-[#f8fafc] pb-10">

      {/* HEADER SECTION: CONTROL CENTER */}
      <div className="w-full bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="w-full px-6 py-4 flex flex-col gap-4">

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">

            {/* Left: Station Selection Logic */}
            {/* Left: Station Selection Logic */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6"> {/* Increased gap to separate Title and Legend */}
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-600 p-1.5 rounded-lg">
                      <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <h1 className="text-xl font-black tracking-tight text-slate-800 uppercase">
                      Fuel Workspace
                    </h1>
                  </div>

                  {/* --- INVENTORY LEGEND --- */}
                  <div className="hidden md:flex items-center gap-4 px-4 py-1.5 bg-slate-100/80 border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-r border-slate-300 pr-4">
                      Status Legend
                    </span>

                    {/* Critical Low */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      <span className="text-[10px] font-bold text-slate-600">Critical Low</span>
                    </div>

                    {/* Physical Overflow */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-orange-400 border border-orange-600 animate-pulse" />
                      <span className="text-[10px] font-bold text-slate-600">Overflow Risk</span>
                    </div>

                    {/* Above Max */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span className="text-[10px] font-bold text-slate-600">Above Max</span>
                    </div>

                    {/* Live Data Indicator */}
                    <div className="flex items-center gap-1.5 ml-2 border-l border-slate-300 pl-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                      <span className="text-[10px] font-bold text-blue-600 uppercase">Live Sales</span>
                    </div>
                  </div>
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="border-blue-200 text-blue-700 hover:bg-blue-50 font-bold gap-2">
                      <Settings2 className="h-4 w-4" />
                      Manage Sites
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-2xl font-black uppercase">
                        <Filter className="h-5 w-5 text-blue-600" />
                        Authorize Sites for Workspace
                      </DialogTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleAll}
                        className="text-[10px] font-black uppercase tracking-tighter text-blue-600 hover:bg-blue-50"
                      >
                        {selectedStationIds.length === locations.length ? "Deselect All" : "Select All"}
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
                            className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedStationIds.includes(loc._id)
                              ? "border-blue-500 bg-blue-50/50 shadow-md"
                              : hasNoTanks
                                ? "border-slate-50 bg-slate-50/30 opacity-60 grayscale" // Dim out empty stations
                                : "border-slate-100 hover:border-slate-300"
                              }`}
                            onClick={() => !hasNoTanks && toggleStation(loc._id)} // Prevent clicking if no tanks
                          >
                            <div className="flex flex-col">
                              <span className={`font-bold ${hasNoTanks ? 'text-slate-400' : 'text-slate-800'}`}>
                                {loc.stationName}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono uppercase">
                                {loc.fuelStationNumber} • {loc.tankCount} Tanks
                              </span>
                            </div>

                            {hasNoTanks ? (
                              <span className="text-[8px] font-black uppercase text-slate-400 bg-slate-100 px-2 py-1 rounded">Inactive</span>
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

              {/* Tag Cloud for Selected Stations */}
              <div className="flex flex-wrap gap-2 min-h-[54px] p-3 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 items-center">
                {selectedStationIds.length === 0 ? (
                  <span className="text-sm text-slate-400 italic px-2">No stations selected. Click 'Manage Sites' to populate your workspace.</span>
                ) : (
                  selectedStationIds.map(id => {
                    const loc = locations.find((l: any) => l._id === id);
                    return (
                      <div key={id} className="flex items-center gap-2 bg-white border-2 border-blue-100 pl-4 pr-2 py-1.5 rounded-full text-xs font-black text-blue-800 shadow-sm animate-in fade-in zoom-in duration-200">
                        {loc?.stationName}
                        <button
                          onClick={() => toggleStation(id)}
                          className="p-1 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Date Selection Navigation */}
            <div className="flex flex-col items-center lg:items-end gap-2 shrink-0">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Viewing Data For</p>
              <div className="flex items-center gap-3 bg-white-900 p-2 rounded-2xl shadow-xl border-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-400 hover:text-white hover:bg-slate-800"
                  onClick={() => shiftDate(-1)}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>

                <div className="flex items-center gap-2 px-2">
                  <WorkspaceDatePicker date={selectedDate} setDate={setSelectedDate} />
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-400 hover:text-white hover:bg-slate-800"
                  onClick={() => shiftDate(1)}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div >

      {/* WORKSPACE STRIPS AREA */}
      {/* < div className="w-full px-0 py-0 space-y-0" >
        {
          selectedStationIds.length === 0 ? (
            <div className="w-full h-96 border-4 border-dashed rounded-3xl flex flex-col items-center justify-center text-slate-300">
              <Building2 className="h-20 w-20 mb-4 opacity-20" />
              <p className="text-xl font-bold italic opacity-30">Select stations above to begin operations</p>
            </div>
          ) : (
            selectedStationIds.map(stationId => {
              const locData = locations.find((l: any) => l._id === stationId);
              return (
                <StationStrip key={stationId} location={locData} date={selectedDate} />
              );
            })
          )
        }
      </div > */}
      {/* WORKSPACE STRIPS AREA */}
      <div className="w-full px-0 py-0 space-y-0">
        {selectedStationIds.length === 0 ? (
          <div className="w-full h-96 border-4 border-dashed rounded-3xl flex flex-col items-center justify-center text-slate-300">
            <Building2 className="h-20 w-20 mb-4 opacity-20" />
            <p className="text-xl font-bold italic opacity-30">Select stations above to begin operations</p>
          </div>
        ) : (
          // Use the sorted objects here
          sortedSelectedStations.map((locData: any) => (
            <StationStrip
              key={locData._id}
              location={locData}
              date={selectedDate}
            />
          ))
        )}
      </div>
    </div >
  );
}

function StationStrip({ location, date }: { location: any, date: Date }) {

  const [rescheduleOrder, setRescheduleOrder] = useState<any>(null);
  const [updateStatusOrder, setUpdateStatusOrder] = useState<any>(null);
  const [editQtyOrder, setEditQtyOrder] = useState<any>(null);
  const [viewingPO, setViewingPO] = useState<any | null>(null);

  const stationTz = location.timezone || 'America/Toronto';
  const selectedDateStr = format(date, 'yyyy-MM-dd');

  const { data: tankResponse, isLoading: isTanksLoading } = useQuery({
    queryKey: ['station-tanks', location?._id, selectedDateStr],
    queryFn: async () => {
      const res = await axios.get(
        `/api/fuel-station-tanks/station/${location._id}?date=${selectedDateStr}`,
        authHeader
      );
      return res.data;
    },
  });

  // Use the date provided by the SERVER
  const stationTodayStr = tankResponse?.stationToday || formatInTimeZone(new Date(), stationTz, 'yyyy-MM-dd');

  // Now comparisons are relative to the SERVER clock
  const isToday = selectedDateStr === stationTodayStr;
  const isPast = stationTodayStr ? selectedDateStr < stationTodayStr : false;
  const isFuture = stationTodayStr ? selectedDateStr > stationTodayStr : false;

  const dateParam = selectedDateStr;
  // Extract data from response
  const tanks = tankResponse?.tanks || [];
  const lastTxAt = tankResponse?.lastTransaction;

  // 2. Aggregate tanks by grade (handling multiple tanks per grade)
  const gradeInventory = useMemo(() => {
    const summary: Record<string, any> = {};

    tanks.forEach((tank: any) => {
      const gradeKey = tank.grade;
      if (!summary[gradeKey]) {
        summary[gradeKey] = {
          grade: gradeKey,
          opening: 0,
          estSales: 0,
          currentSales: 0,
          closing: 0,
          minLimit: 0,
          maxLimit: 0,
          totalCapacity: 0
        };
      }
      // Summing values from the enriched backend fields
      summary[gradeKey].opening += (tank.openingL || 0);
      summary[gradeKey].estSales += (tank.estSalesL || 0);
      summary[gradeKey].currentSales += (tank.currentSalesL || 0);
      summary[gradeKey].closing += (tank.closingL || 0);
      summary[gradeKey].minLimit += (tank.minVolumeCapacity || 0);
      summary[gradeKey].maxLimit += (tank.maxVolumeCapacity || 0);
      summary[gradeKey].totalCapacity += (tank.tankCapacity || 0);
    });

    return Object.values(summary).sort((a: any, b: any) => {
      const priority: Record<string, number> = {
        'Regular': 1, 'Premium': 2, 'Diesel': 3, 'Dyed Diesel': 4
      };
      return (priority[a.grade] || 99) - (priority[b.grade] || 99);
    });
  }, [tanks]);

  // Fetch Orders (Your existing logic)
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['workspace-orders', location?._id, dateParam], // Use dateParam
    queryFn: async () => {
      const res = await axios.get(
        `/api/fuel-orders/workspace-orders?stationId=${location._id}&date=${dateParam}`, // Send string, not ISO
        authHeader
      );
      return res.data;
    },
    enabled: !!location?._id,
  });

  const getRowStatusColor = (item: any) => {
    if (isPast) return 'hover:bg-slate-50/50';

    const isCriticalLow = item.closing <= item.minLimit || item.opening <= item.minLimit;
    const isPhysicalOverflow = item.closing > item.totalCapacity;
    const isAboveMaxLimit = item.closing > item.maxLimit;

    if (isCriticalLow) return 'bg-red-50/80 hover:bg-red-100/80';
    if (isPhysicalOverflow) return 'bg-orange-50/90 hover:bg-orange-100/90'; // Brighter for overflow
    if (isAboveMaxLimit) return 'bg-amber-50/80 hover:bg-amber-100/80';

    return 'hover:bg-slate-50/50';
  };

  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: async () => {
      return axios.post(`/api/fuel-sales/sync/${location._id}`, {}, authHeader);
    },
    onSuccess: () => {
      // Refresh the tank query to show updated currentSales and closing volumes
      queryClient.invalidateQueries({ queryKey: ['station-tanks', location?._id] });
      // toast.success("Sales Synced");
    }
  });

  const gradeMap: Record<string, string> = {
    'Regular': 'REG',
    'Premium': 'PUL',
    'Diesel': 'ULSD',
    'Dyed Diesel': 'DYED'
  };

  // const today = new Date();
  // today.setHours(0, 0, 0, 0);

  // const selected = new Date(date);
  // selected.setHours(0, 0, 0, 0);

  // const isPast = selected.getTime() < today.getTime();
  // const isToday = selected.getTime() === today.getTime();
  // const isFuture = selected.getTime() > today.getTime();

  // Helper to get the YYYY-MM-DD string without timezone shifting
  // const getUTCString = (dateInput: string | Date) => {
  //   const d = new Date(dateInput);
  //   // This extracts the year, month, and day directly from the UTC values
  //   return d.toISOString().split('T')[0];
  // };

  return (
    <>
      <Card className="w-full border-2 rounded-2xl gap-0 py-0 overflow-hidden shadow-lg border-slate-200/60 hover:border-blue-300 transition-all duration-300">
        <CardContent className="p-0 flex flex-col xl:flex-row">

          {/* LEFT SIDE: STATION INFO & INVENTORY - Tightened padding and flex */}
          <div className="w-full xl:w-2/5 p-3 bg-slate-50/50 border-r border-slate-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2"> {/* Reduced margin from mb-6 */}
                <div className="bg-white p-0 rounded-xl border-2 border-slate-100 shadow-sm font-black text-blue-700 font-mono text-lg">
                  {location?.fuelStationNumber || '00'}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 leading-tight tracking-tight uppercase">
                    {location?.stationName}
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    {location?.address}
                  </p>
                </div>
              </div>

              {/* INVENTORY TABLE - Compact rows */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/50 border-b border-slate-200">
                      <th className="py-1.5 px-3 text-[9px] font-black text-slate-500 uppercase">Grade</th>
                      <th className="py-1.5 px-3 text-[9px] font-black text-slate-500 uppercase text-right">
                        {isFuture ? 'Est Opening' : 'Opening'} (L)
                      </th>
                      {/* Label changes: "Sales" for past, "Est Sales" for now/future */}
                      <th className="py-1.5 px-3 text-[9px] font-black text-slate-500 uppercase text-right">
                        {isPast ? 'Sales' : 'Est Sales'} (L)
                      </th>
                      {/* Hide Current column if not Today */}
                      {isToday && (
                        <th className="py-1.5 px-3 text-[9px] font-black text-slate-500 uppercase text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="flex items-center gap-1">
                              <span>Current (L)</span>
                              {/* Check for the string and split by either 'T' or a space ' ' */}
                              {lastTxAt && typeof lastTxAt === 'string' && (
                                <span className="text-[8px] font-bold text-blue-500 lowercase">
                                  [{lastTxAt.includes('T')
                                    ? lastTxAt.split('T')[1]?.substring(0, 5)
                                    : lastTxAt.split(' ')[1]?.substring(0, 5)
                                  }]
                                </span>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                syncMutation.mutate();
                              }}
                              disabled={syncMutation.isPending}
                              className="hover:text-blue-600 transition-colors disabled:opacity-50"
                            >
                              <RefreshCw className={`h-2.5 w-2.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                            </button>
                          </div>
                        </th>
                      )}
                      <th className="py-1.5 px-3 text-[9px] font-black text-slate-500 uppercase text-right">
                        {isPast ? 'Closing' : 'Est Closing'} (L)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isTanksLoading ? (
                      <tr>
                        <td colSpan={isToday ? 5 : 4} className="p-4 text-center">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto text-slate-300" />
                        </td>
                      </tr>
                    ) : (
                      gradeInventory.map((item: any) => {
                        const theme = getGradeTheme(item.grade);
                        const rowColorClass = getRowStatusColor(item);

                        // Status Flags
                        const isLow = !isPast && (item.closing <= item.minLimit);
                        const isOverflow = !isPast && (item.closing > item.totalCapacity);
                        const isWarning = !isPast && (item.closing > item.maxLimit && !isOverflow);

                        return (
                          <tr key={item.grade} className={`${rowColorClass} transition-colors`}>
                            <td className="py-1.5 px-3 flex items-center gap-2">
                              <span
                                className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${theme.label}`}
                                style={{ backgroundColor: `${theme.raw}15`, borderColor: `${theme.raw}30` }}
                              >
                                {gradeMap[item.grade] || item.grade}
                              </span>

                              {/* ALERT DOTS */}
                              {isLow && (
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" title="Low Inventory" />
                              )}
                              {isOverflow && (
                                <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse border border-orange-600" title="Physical Overflow Warning" />
                              )}
                              {isWarning && (
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Above Max Limit" />
                              )}
                            </td>

                            <td className="py-1.5 px-3 text-right font-mono text-[11px] font-bold text-slate-600">
                              {item.opening.toLocaleString()}
                            </td>

                            <td className="py-1.5 px-3 text-right font-mono text-[11px] font-bold text-slate-400">
                              {item.estSales.toLocaleString()}
                            </td>

                            {isToday && (
                              <td className="py-1.5 px-3 text-right font-mono text-[11px] font-bold text-blue-600">
                                {item.currentSales.toLocaleString()}
                              </td>
                            )}

                            <td className={`py-1.5 px-3 text-right font-mono text-[11px] font-black 
                            ${isLow ? 'text-red-600' : isOverflow ? 'text-yellow-700' : 'text-slate-800'}`}>
                              {item.closing.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* VIEW VOLUME ANALYSIS BUTTON - Compact margin */}
            <div className="mt-2">
              <Button
                variant="outline"
                size="sm" // Added small size
                className="w-full border-dashed border-2 text-blue-600 font-bold hover:bg-blue-50 transition-all text-xs h-9"
                asChild
              >
                <Link to="/fuel-management/volume" search={{ site: location?.stationName }}>
                  View Current Tanks Volume
                </Link>
              </Button>
            </div>
          </div>

          {/* RIGHT SIDE: ORDERS SCHEDULE */}
          <div className="flex-1 p-3 bg-white border-t xl:border-t-0 xl:border-l-2 font-sans">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 rounded-lg">
                  <Truck className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Delivery Schedule</h3>
                {!isLoading && (
                  <Badge variant="secondary" className="rounded-full bg-slate-100 text-[10px] text-slate-500 px-2 h-5 font-bold">
                    {orders.length} LOADS
                  </Badge>
                )}
              </div>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
            </div>

            {/* SCROLLABLE CONTAINER START */}
            <div className={`space-y-2 overflow-y-auto pr-1 transition-all duration-300 ${orders.length > 1 ? 'max-h-[240px]' : 'max-h-fit'
              } scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent hover:scrollbar-thumb-slate-300`}>
              {isLoading ? (
                [1, 2].map((i) => <div key={i} className="h-28 w-full bg-slate-50 animate-pulse rounded-2xl border border-slate-100" />)
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-300 border-2 border-dashed rounded-2xl bg-slate-50/30">
                  <p className="font-bold italic text-sm text-slate-400">No orders scheduled for this date</p>
                </div>
              ) : (
                orders.map((order: any) => {
                  const stationTz = location.timezone || 'America/Toronto';

                  // 1. Convert DB dates to simple YYYY-MM-DD strings relative to the Station
                  const estDate = formatInTimeZone(new Date(order.estimatedDeliveryDate), stationTz, 'yyyy-MM-dd');
                  const origDate = formatInTimeZone(new Date(order.originalDeliveryDate), stationTz, 'yyyy-MM-dd');

                  // 2. Format the active 'date' prop from your page
                  const activeDateStr = format(date, 'yyyy-MM-dd');

                  const isDelivered = order.currentStatus === 'Delivered';
                  const wasMovedFromHere = origDate === activeDateStr && estDate !== activeDateStr;
                  const arrivedHereFromHistory = estDate === activeDateStr && origDate !== activeDateStr;

                  // Use your formatSafeDate helper for display labels
                  const formatSafeDate = (dateInput: string | Date) => {
                    return formatInTimeZone(new Date(dateInput), stationTz, 'EEE, MMM do');
                  };

                  // --- UI Rendering follows your existing logic ---
                  if (wasMovedFromHere) {
                    return (
                      <div key={order._id} className="flex items-center justify-between p-3 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="p-1 bg-orange-100 rounded">
                            <ArrowRight className="h-3 w-3 text-orange-600" />
                          </div>
                          <span className="font-black text-slate-500 text-sm tracking-tight">{order.poNumber}</span>
                          <Badge className={`text-[10px] font-black uppercase px-1.5 py-0 shadow-none border opacity-60 ${getStatusColor(order.currentStatus)}`}>
                            {order.currentStatus}
                          </Badge>
                        </div>

                        <div className="text-[10px] font-black text-orange-600 uppercase flex items-center gap-1">
                          {/* MOVED TO <span className="underline">{format(new Date(order.estimatedDeliveryDate), 'EEE, MMM do')}</span> */}
                          MOVED TO <span className="underline">{formatSafeDate(order.estimatedDeliveryDate)}</span>
                        </div>
                      </div>
                    );
                  }

                  // --- 2. FULL CARD VIEW (For orders actually scheduled for today) ---
                  return (
                    <div key={order._id} className="group border-2 border-slate-100 rounded-2xl p-2.5 flex flex-col gap-2 hover:border-blue-400 hover:shadow-md transition-all duration-300 bg-white">
                      {/* Arrived Here Indicator */}
                      {arrivedHereFromHistory && (
                        <div className="flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase">
                          <History className="h-3 w-3" />
                          Originally for {formatSafeDate(order.originalDeliveryDate)}
                        </div>
                      )}

                      {/* LINE 1: IDENTIFIERS & STATUS ACTIONS */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-lg tracking-tight">{order.poNumber}</span>
                          <Badge className={`text-[12px] font-black uppercase px-2 py-0.5 shadow-none border ${getStatusColor(order.currentStatus)}`}>
                            {order.currentStatus}
                          </Badge>
                          <Button
                            variant="ghost"
                            disabled={isDelivered} // LOCKED IF DELIVERED
                            onClick={() => setUpdateStatusOrder(order)}
                            className="h-6 px-2 text-[11px] font-black uppercase text-blue-600"
                          >
                            Update Status
                          </Button>
                        </div>

                        {/* Metadata Breadcrumbs */}
                        {/* Metadata Breadcrumbs */}
                        <div className="hidden md:flex items-center gap-2">
                          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 bg-slate-50/50 px-2 py-0.5 rounded-full border border-slate-100">
                            <span className="text-blue-500 uppercase">{order.supplier?.supplierName || 'No Supplier'}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-blue-500 uppercase">{order.rack?.rackName || 'No Rack'}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-blue-500 uppercase">{order.rack?.rackLocation || 'No Rack'}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-blue-500 uppercase">{order.carrier?.carrierName || 'No Carrier'}</span>
                          </div>

                          {/* NEW VIEW PO BUTTON */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingPO(order)}
                            className="h-6 px-2 text-[10px] font-black uppercase text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            View PO
                          </Button>
                        </div>
                      </div>

                      {/* LINE 2: LOGISTICS & QUANTITIES */}
                      <div className="flex items-center justify-between gap-6 border-t border-slate-50 pt-2">
                        {/* LEFT: Delivery Time + Reschedule */}
                        <div className="flex items-center gap-3 min-w-fit">
                          <div className="bg-amber-100 p-1.5 rounded-lg">
                            <Clock className="h-3.5 w-3.5 text-amber-700" />
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-700 text-[15px] tracking-tight">
                                {order.estimatedDeliveryWindow?.start} — {order.estimatedDeliveryWindow?.end}
                              </span>
                              <Button
                                variant="ghost"
                                disabled={isDelivered} // LOCKED IF DELIVERED
                                onClick={() => setRescheduleOrder(order)}
                                className="h-5 px-1.5 text-[11px] font-black uppercase"
                              >
                                Reschedule
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* RIGHT: Fuel Qtys */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[500px]">
                            {order.items?.slice().sort((a: any, b: any) => {
                              const priority: Record<string, number> = { 'Regular': 1, 'Premium': 2, 'Diesel': 3, 'Dyed Diesel': 4 };
                              return (priority[a.grade] || 99) - (priority[b.grade] || 99);
                            }).map((item: any) => {
                              const theme = getGradeTheme(item.grade);
                              return (
                                <div key={item.grade} className="flex items-center gap-2 px-2 py-1 rounded-lg border" style={{ backgroundColor: `${theme.raw}10`, borderColor: `${theme.raw}25` }}>
                                  <span className={`text-[12px] font-black uppercase tracking-tight ${theme.label}`}>
                                    {item.grade.replace('Dyed Diesel', 'DYED').replace('Regular', 'REG').replace('Premium', 'PUL').replace('Diesel', 'ULSD')}
                                  </span>
                                  <span className="font-mono font-black text-slate-900 text-[12px]">
                                    {(item.ltrs || 0).toLocaleString()}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <Button
                            variant="outline"
                            disabled={isDelivered} // LOCKED IF DELIVERED
                            onClick={() => setEditQtyOrder(order)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {/* SCROLLABLE CONTAINER END */}
          </div>
        </CardContent>
      </Card >
      {/* RENDER THE DIALOGS IF STATE EXISTS */}
      {rescheduleOrder && (
        <RescheduleDialog
          order={rescheduleOrder}
          isOpen={!!rescheduleOrder}
          onOpenChange={(open) => !open && setRescheduleOrder(null)}
          locationId={location._id}
        />
      )}

      {updateStatusOrder && (
        <UpdateStatusDialog
          order={updateStatusOrder}
          open={!!updateStatusOrder}
          onOpenChange={(open: any) => !open && setUpdateStatusOrder(null)}
          locationId={location._id}
        />
      )}

      {editQtyOrder && (
        <EditQtyDialog
          order={editQtyOrder}
          open={!!editQtyOrder}
          onOpenChange={(open: any) => !open && setEditQtyOrder(null)}
          locationId={location._id}
        />
      )}
      <Dialog open={!!viewingPO} onOpenChange={(open) => !open && setViewingPO(null)}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              PO Record Preview - {viewingPO?.poNumber}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 border rounded-lg overflow-hidden bg-slate-100">
            {viewingPO && (
              <PDFViewer width="100%" height="100%" showToolbar={false}>
                <POPreviewDocument
                  data={{
                    deliveryDate: getISODateOnly(viewingPO.originalDeliveryDate),
                    poNumber: viewingPO.poNumber,
                    badgeNo: viewingPO.badgeNo || '',
                    startTime: viewingPO.originalDeliveryWindow?.start || '',
                    endTime: viewingPO.originalDeliveryWindow?.end || '',
                    items: viewingPO.items || []
                  }}
                  selectedStation={viewingPO.station}
                  carrierName={viewingPO.carrier?.carrierName}
                  rackName={viewingPO.rack?.rackName}
                  rackLocation={viewingPO.rack?.rackLocation}
                />
              </PDFViewer>
            )}
          </div>

          <DialogFooter className="flex justify-end items-center sm:justify-end gap-2">
            <Button variant="ghost" onClick={() => setViewingPO(null)}>
              Close
            </Button>

            {viewingPO && (
              <PDFDownloadLink
                document={
                  <POPreviewDocument
                    data={{
                      deliveryDate: getISODateOnly(viewingPO.originalDeliveryDate),
                      poNumber: viewingPO.poNumber,
                      badgeNo: viewingPO.badgeNo || '',
                      startTime: viewingPO.originalDeliveryWindow?.start || '',
                      endTime: viewingPO.originalDeliveryWindow?.end || '',
                      items: viewingPO.items || []
                    }}
                    selectedStation={viewingPO.station}
                    carrierName={viewingPO.carrier?.carrierName}
                    rackName={viewingPO.rack?.rackName}
                    rackLocation={viewingPO.rack?.rackLocation}
                  />
                }
                fileName={`Fuel Order Form NSP ${viewingPO?.station?.fuelCustomerName || 'Order'} ${formatPDFDate(getISODateOnly(viewingPO.originalDeliveryDate), false)}.pdf`}
              >
                {({ loading }) => (
                  <Button className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
                    <Download className="h-4 w-4 mr-2" />
                    {loading ? "Preparing..." : "Download PDF"}
                  </Button>
                )}
              </PDFDownloadLink>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RescheduleDialog({ order, isOpen, onOpenChange, locationId }: RescheduleDialogProps) {
  const [date, setDate] = useState<Date | undefined>(() => {
    // Use the existing order date but ensure it's treated as local for the picker
    return order.estimatedDeliveryDate ? new Date(order.estimatedDeliveryDate) : new Date();
  });
  const [window, setWindow] = useState(order.estimatedDeliveryWindow || { start: "08:00", end: "12:00" });

  const queryClient = useQueryClient();
  const authHeader = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };

  const mutation = useMutation({
    mutationFn: async (updateData: any) => {
      return axios.put(`/api/fuel-orders/${order._id}`, updateData, authHeader);
    },
    onSuccess: () => {
      // Refresh both orders and tanks (since est closing depends on order dates)
      queryClient.invalidateQueries({ queryKey: ['workspace-orders', locationId] });
      queryClient.invalidateQueries({ queryKey: ['station-tanks', locationId] });
      onOpenChange(false);
    }
  });

  const handleConfirm = () => {
    if (!date) return;

    // Use a library like 'date-fns' or just format it manually to YYYY-MM-DD
    // This ensures we send "2026-04-25" instead of an ISO string with a timezone
    const dateString = format(date, 'yyyy-MM-dd');

    // 4. Proceed with mutation if validation passes
    mutation.mutate({
      estimatedDeliveryDate: dateString, // Send the string!
      estimatedDeliveryWindow: window
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] font-sans">
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tight text-slate-800">
            Reschedule PO: {order.poNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Move to Date</label>
            <DatePicker
              date={date}
              setDate={setDate}
              disablePast={true}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Window Start</label>
              <Input
                type="time"
                className="font-bold"
                value={window.start}
                onChange={(e) => setWindow({ ...window, start: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Window End</label>
              <Input
                type="time"
                className="font-bold"
                value={window.end}
                onChange={(e) => setWindow({ ...window, end: e.target.value })}
              />
            </div>
          </div>
        </div>

        <Button
          className="w-full font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 h-12 shadow-lg shadow-blue-100"
          onClick={handleConfirm}
          disabled={mutation.isPending || !date}
        >
          {mutation.isPending ? "Updating Schedule..." : "Confirm Reschedule"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// interface StatusDialogProps {
//   order: any;
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
//   onUpdate: (newStatus: string) => void;
// }

export function UpdateStatusDialog({ order, open, onOpenChange, locationId }: any) {
  const queryClient = useQueryClient();
  // Track which status the user clicked but hasn't confirmed yet
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (newStatus: string) => {
      return axios.put(`/api/fuel-orders/${order._id}`, { currentStatus: newStatus }, authHeader);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-orders', locationId] });
      queryClient.invalidateQueries({ queryKey: ['station-tanks', locationId] });
      setPendingStatus(null);
      onOpenChange(false);
    }
  });

  if (!order) return null;

  const statuses = [
    { id: 'Created', label: 'Created', icon: PackagePlus, color: 'text-slate-500' },
    { id: 'In Transit', label: 'In Transit', icon: Truck, color: 'text-blue-500' },
    { id: 'Delivered', label: 'Delivered', icon: CheckCircle2, color: 'text-green-500' },
  ];

  const currentIndex = statuses.findIndex(s => s.id === order.currentStatus);

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) setPendingStatus(null); // Reset warning if they close dialog
      onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase italic">
            {pendingStatus ? "Confirm Change" : "Update Status"}
          </DialogTitle>
          <p className="text-sm text-slate-500 font-bold tracking-tight">
            PO: {order.poNumber}
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-4">
          {!pendingStatus ? (
            // STANDARD LIST VIEW
            statuses.map((status, index) => {
              const isCurrent = order.currentStatus === status.id;
              const isDisabled = index < currentIndex || index > currentIndex + 1;

              return (
                <Button
                  key={status.id}
                  variant={isCurrent ? "default" : "outline"}
                  disabled={isDisabled || isCurrent || mutation.isPending}
                  onClick={() => setPendingStatus(status.id)} // Set the pending state instead of mutating
                  className={`h-14 justify-start gap-4 border-2 ${isCurrent ? 'border-blue-600 bg-blue-50 text-blue-700' : ''
                    }`}
                >
                  <status.icon className={`h-5 w-5 ${status.color}`} />
                  <div className="flex flex-col items-start">
                    <span className="font-black uppercase text-xs tracking-widest">{status.label}</span>
                    {isCurrent && <span className="text-[10px] font-bold opacity-70">CURRENT STATUS</span>}
                  </div>
                </Button>
              );
            })
          ) : (
            // CONFIRMATION VIEW
            // Inside the Confirmation View section of your UpdateStatusDialog:

            <div className="flex flex-col gap-3 py-4">
              {pendingStatus && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">

                  {/* 1. CONDITIONAL WARNING BOX */}
                  {pendingStatus === 'Delivered' ? (
                    <div className="p-4 bg-amber-50 border-2 border-amber-100 rounded-2xl flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-amber-700 font-black text-xs uppercase">
                        <AlertTriangle className="h-4 w-4" />
                        Warning: Finalize Order
                      </div>
                      <p className="text-sm text-amber-900 font-medium leading-tight">
                        Marking this as <span className="font-black uppercase">Delivered</span> will lock the fuel quantities and update the station inventory. <strong>This action cannot be undone.</strong>
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-blue-700 font-black text-xs uppercase">
                        <Truck className="h-4 w-4" />
                        Status Update
                      </div>
                      <p className="text-sm text-blue-900 font-medium leading-tight">
                        Are you sure you want to move this order to <span className="font-black uppercase">In Transit</span>?
                      </p>
                    </div>
                  )}

                  {/* 2. ACTION BUTTONS */}
                  <div className="flex flex-col gap-2">
                    <Button
                      className={cn(
                        "w-full h-12 font-black uppercase transition-all",
                        pendingStatus === 'Delivered' ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"
                      )}
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate(pendingStatus)}
                    >
                      {mutation.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        `Confirm ${pendingStatus}`
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      className="w-full font-black uppercase text-slate-400 hover:text-slate-600"
                      disabled={mutation.isPending}
                      onClick={() => setPendingStatus(null)}
                    >
                      Go Back
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 1. Defined Sort Order & Abbreviations
export const gradeConfig: Record<string, { priority: number; short: string }> = {
  'Regular': { priority: 1, short: 'REG' },
  'Premium': { priority: 2, short: 'PUL' },
  'Diesel': { priority: 3, short: 'ULSD' },
  'Dyed Diesel': { priority: 4, short: 'DYED' }
};

export function EditQtyDialog({ order, open, onOpenChange, locationId }: any) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (order?.items) {
      // 2. Sort items based on the defined priority before setting state
      const sortedItems = [...order.items].sort((a, b) => {
        return (gradeConfig[a.grade]?.priority || 99) - (gradeConfig[b.grade]?.priority || 99);
      });
      setItems(sortedItems);
    }
  }, [order]);

  const mutation = useMutation({
    mutationFn: async (updatedItems: any[]) => {
      return axios.put(`/api/fuel-orders/${order._id}`, { items: updatedItems }, authHeader);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-orders', locationId] });
      queryClient.invalidateQueries({ queryKey: ['station-tanks', locationId] });
      onOpenChange(false);
    }
  });

  const handleQtyChange = (grade: string, value: string) => {
    setItems(prev => prev.map(item =>
      item.grade === grade ? { ...item, ltrs: parseInt(value) || 0 } : item
    ));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-black uppercase italic tracking-tight">Edit Fuel Quantities</DialogTitle>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Adjust Liters for PO: {order?.poNumber}</p>
        </DialogHeader>

        <div className="grid gap-5 py-6">
          {items.map((item) => {
            const theme = getGradeTheme(item.grade);
            const shortName = gradeConfig[item.grade]?.short || item.grade;

            return (
              <div key={item.grade} className="grid grid-cols-4 items-center gap-4">
                {/* 3. Styled Label using your existing Theme */}
                <div className="text-right">
                  <Badge
                    variant="outline"
                    className={cn("uppercase text-[10px] font-black px-2 py-1 shadow-none", theme.label)}
                    style={{ backgroundColor: `${theme.raw}10`, borderColor: `${theme.raw}40` }}
                  >
                    {shortName}
                  </Badge>
                </div>

                <div className="col-span-3 relative group">
                  <Input
                    type="number"
                    className={cn(
                      "font-mono font-black text-xl h-14 pr-14 transition-all border-2",
                      "focus-visible:ring-0 focus-visible:ring-offset-0"
                    )}
                    style={{
                      borderColor: `${theme.raw}20`,
                      // When user focuses, highlight with the grade color
                      borderLeft: `6px solid ${theme.raw}`
                    }}
                    value={item.ltrs}
                    onChange={(e) => handleQtyChange(item.grade, e.target.value)}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 group-hover:text-slate-400 transition-colors">
                    LTRS
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="pt-2">
          <Button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(items)}
            className="w-full h-14 font-black uppercase bg-slate-900 hover:bg-blue-600 transition-all text-sm tracking-widest"
          >
            {mutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Update Order Totals"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}