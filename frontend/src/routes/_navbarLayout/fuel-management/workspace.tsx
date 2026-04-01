import { useState, useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // Recommended for fetching
import axios from 'axios';
import {
  Search, X, ChevronLeft, ChevronRight, Building2,
  Settings2, Filter
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { format, addDays, isAfter, startOfDay } from "date-fns";
import { WorkspaceDatePicker } from '@/components/custom/datePicker';
import { Loader2, RefreshCw, Truck, Clock, Edit3 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { getGradeTheme } from "./manage/locations/$id"

export const Route = createFileRoute('/_navbarLayout/fuel-management/workspace')({
  component: WorkspaceComponent,
});

function WorkspaceComponent() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [stationSearch, setStationSearch] = useState("");
  const [selectedStationIds, setSelectedStationIds] = useState<string[]>([]);
  const authHeader = {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  };

  // 1. Fetch Real Locations from your Backend
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['all-locations'],
    queryFn: async () => {
      const res = await axios.get('/api/fuel-station-tanks/all-locations', authHeader);
      return res.data;
    }
  });

  // Filter locations for the Dialog Search
  const filteredLocations = useMemo(() => {
    return locations.filter((loc: any) =>
      loc.stationName.toLowerCase().includes(stationSearch.toLowerCase())
    );
  }, [locations, stationSearch]);

  const shiftDate = (amount: number) => {
    const today = startOfDay(new Date());
    const maxFuture = addDays(today, 4);
    const newDate = addDays(selectedDate, amount);

    // Allow infinite past, but restrict future to +3 days
    if (isAfter(newDate, maxFuture)) return;
    setSelectedDate(newDate);
  };

  const toggleStation = (id: string) => {
    setSelectedStationIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
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
                      <div className="w-2 h-2 rounded-full bg-yellow-400 border border-yellow-600 animate-pulse" />
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
                      {filteredLocations.map((loc: any) => (
                        <div
                          key={loc._id}
                          className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedStationIds.includes(loc._id)
                            ? "border-blue-500 bg-blue-50/50 shadow-md"
                            : "border-slate-100 hover:border-slate-300"
                            }`}
                          onClick={() => toggleStation(loc._id)}
                        >
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{loc.stationName}</span>
                            <span className="text-[10px] text-slate-500 font-mono uppercase">
                              {loc.fuelStationNumber} • {loc.tankCount} Tanks
                            </span>
                          </div>
                          <Checkbox checked={selectedStationIds.includes(loc._id)} className="h-5 w-5 border-2 rounded-md" />
                        </div>
                      ))}
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
      < div className="w-full px-0 py-0 space-y-0" >
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
      </div >
    </div >
  );
}

function StationStrip({ location, date }: { location: any, date: Date }) {
  const authHeader = {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  };

  // 1. Update your useQuery to handle the new object structure
  const { data: tankResponse, isLoading: isTanksLoading } = useQuery({
    queryKey: ['station-tanks', location?._id, format(date, 'yyyy-MM-dd')],
    queryFn: async () => {
      const res = await axios.get(
        `/api/fuel-station-tanks/station/${location._id}?date=${date.toISOString()}`,
        authHeader
      );
      return res.data;
    },
    enabled: !!location?._id,
  });

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
    queryKey: ['workspace-orders', location?._id, format(date, 'yyyy-MM-dd')],
    queryFn: async () => {
      const res = await axios.get(
        `/api/fuel-orders/workspace-orders?stationId=${location._id}&date=${date.toISOString()}`,
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
    if (isPhysicalOverflow) return 'bg-yellow-50/90 hover:bg-yellow-100/90'; // Brighter for overflow
    if (isAboveMaxLimit) return 'bg-amber-50/80 hover:bg-amber-100/80';

    return 'hover:bg-slate-50/50';
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'bg-green-100 text-green-700 border-green-200';
      case 'in-transit': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selected = new Date(date);
  selected.setHours(0, 0, 0, 0);

  const isPast = selected.getTime() < today.getTime();
  const isToday = selected.getTime() === today.getTime();
  const isFuture = selected.getTime() > today.getTime();

  return (
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
                      {isFuture ? 'Est Opening' : 'Opening'}
                    </th>
                    {/* Label changes: "Sales" for past, "Est Sales" for now/future */}
                    <th className="py-1.5 px-3 text-[9px] font-black text-slate-500 uppercase text-right">
                      {isPast ? 'Sales' : 'Est Sales'}
                    </th>
                    {/* Hide Current column if not Today */}
                    {isToday && (
                      <th className="py-1.5 px-3 text-[9px] font-black text-slate-500 uppercase text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="flex items-center gap-1">
                            <span>Current</span>
                            {/* Check for the string and split by either 'T' or a space ' ' */}
                            {lastTxAt && typeof lastTxAt === 'string' && (
                              <span className="text-[8px] font-bold text-blue-500 lowercase">
                                ({lastTxAt.includes('T')
                                  ? lastTxAt.split('T')[1]?.substring(0, 5)
                                  : lastTxAt.split(' ')[1]?.substring(0, 5)
                                })
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
                      {isPast ? 'Closing' : 'Est Closing'}
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
                              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse border border-yellow-600" title="Physical Overflow Warning" />
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

          <div className="space-y-2">
            {isLoading ? (
              [1, 2].map((i) => <div key={i} className="h-28 w-full bg-slate-50 animate-pulse rounded-2xl border border-slate-100" />)
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-300 border-2 border-dashed rounded-2xl bg-slate-50/30">
                <p className="font-bold italic text-sm text-slate-400">No orders scheduled for this date</p>
              </div>
            ) : (
              orders.map((order: any) => (
                <div key={order._id} className="group border-2 border-slate-100 rounded-2xl p-2.5 flex flex-col gap-2 hover:border-blue-400 hover:shadow-md transition-all duration-300 bg-white">

                  {/* LINE 1: IDENTIFIERS & STATUS ACTIONS */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-lg tracking-tight">{order.poNumber}</span>
                      <Badge className={`text-[12px] font-black uppercase px-2 py-0.5 shadow-none border ${getStatusColor(order.currentStatus)}`}>
                        {order.currentStatus}
                      </Badge>
                      {/* Status Action moved here */}
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] font-black uppercase tracking-tight text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100">
                        Update Status
                      </Button>
                    </div>

                    {/* Metadata Breadcrumbs */}
                    <div className="flex items-center gap-2 text-[12px] font-bold text-slate-400 bg-slate-50/50 px-2.5 py-1 rounded-full border border-slate-100">
                      <span className="text-blue-500 uppercase">{order.rack?.rackName || 'No Rack'}</span>
                      <span className="text-slate-300">•</span>
                      <span className="uppercase">{order.supplier?.supplierName || 'No Supplier'}</span>
                      <span className="text-slate-300">•</span>
                      <span className="uppercase">{order.carrier?.carrierName || 'No Carrier'}</span>
                      <span className="text-slate-300">•</span>
                      <span className="font-mono bg-white px-1.5 rounded border border-slate-200 text-slate-600">
                        {order.badgeNo || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* LINE 2: LOGISTICS & QUANTITIES (All Actions Integrated) */}
                  <div className="flex items-center justify-between gap-6 border-t border-slate-50 pt-2">

                    {/* LEFT: Delivery Time + Reschedule Action */}
                    <div className="flex items-center gap-3 min-w-fit">
                      <div className="bg-amber-100 p-1.5 rounded-lg">
                        <Clock className="h-3.5 w-3.5 text-amber-700" />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-700 text-[15px] tracking-tight">
                            {order.estimatedDeliveryWindow?.start} — {order.estimatedDeliveryWindow?.end}
                          </span>
                          <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[11px] font-black uppercase tracking-tight text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                            Reschedule
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: Fuel Qtys + Update Qty Action */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[500px]">
                        {order.items
                          ?.slice() // Create a shallow copy to avoid mutating the original array
                          .sort((a: any, b: any) => {
                            const priority: Record<string, number> = {
                              'Regular': 1,
                              'Premium': 2,
                              'Diesel': 3,
                              'Dyed Diesel': 4
                            };
                            return (priority[a.grade] || 99) - (priority[b.grade] || 99);
                          })
                          .map((item: any) => {
                            const theme = getGradeTheme(item.grade);
                            return (
                              <div
                                key={item.grade}
                                className="flex items-center gap-2 px-2 py-1 rounded-lg border"
                                style={{
                                  backgroundColor: `${theme.raw}10`,
                                  borderColor: `${theme.raw}25`
                                }}
                              >
                                <span className={`text-[13px] font-black uppercase tracking-tight ${theme.label}`}>
                                  {item.grade
                                    .replace('Dyed Diesel', 'DYED')
                                    .replace('Regular', 'REG')
                                    .replace('Premium', 'PUL')
                                    .replace('Diesel', 'ULSD')}
                                </span>
                                <span className="font-mono font-black text-slate-900 text-[13px]">
                                  {(item.ltrs || 0).toLocaleString()}
                                </span>
                              </div>
                            );
                          })}
                      </div>

                      {/* Update Qty Action moved here as a small subtle button */}
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 bg-white">
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card >
  );
}

const OrderDetailsDialog = ({ order }: { order: any }) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button variant="outline" size="sm" className="h-5 px-2 text-[9px] font-black uppercase">
        View Details
      </Button>
    </DialogTrigger>
    <DialogContent className="max-w-md p-0 overflow-hidden border-2 border-slate-200 rounded-2xl">
      <div className="bg-blue-700 p-4 text-white">
        <h3 className="text-lg font-black uppercase tracking-tight">Order Logistics: {order.poNumber}</h3>
        <p className="text-[10px] opacity-80 font-bold">Created on {new Date(order.createdAt).toLocaleDateString()}</p>
      </div>

      <div className="p-6 grid grid-cols-2 gap-6 bg-white">
        {/* Source Info */}
        <div className="space-y-3">
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide">Supplier</label>
            <p className="text-xs font-black text-slate-800 uppercase">{order.supplier?.supplierName || 'N/A'}</p>
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide">Terminal / Rack</label>
            <p className="text-xs font-black text-slate-800 uppercase">{order.rack?.rackName || 'N/A'}</p>
          </div>
        </div>

        {/* Carrier Info */}
        <div className="space-y-3 border-l pl-6">
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide">Carrier</label>
            <p className="text-xs font-black text-slate-800 uppercase">{order.carrier?.carrierName || 'TBD'}</p>
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide">Badge Number</label>
            <p className="text-xs font-mono font-black text-slate-800">{order.badgeNo || 'None'}</p>
          </div>
        </div>

        {/* Full Volume List (Compact) */}
        <div className="col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
          <label className="text-[9px] font-black text-slate-400 uppercase block mb-2">Order Breakdown</label>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            {order.items?.map((item: any) => (
              <div key={item._id} className="flex justify-between border-b border-slate-200 py-1">
                <span className="text-[10px] font-bold text-slate-600 uppercase">{item.grade}</span>
                <span className="text-[10px] font-mono font-black text-blue-700">{item.ltrs?.toLocaleString()} L</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);