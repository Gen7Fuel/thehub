import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useMemo, useEffect } from 'react';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { format, addDays, startOfDay, isAfter, isBefore } from 'date-fns';
import {
  ChevronLeft, ChevronRight, Filter, ArrowRight,
  MapPin, ClipboardList, Eye, Clock, TrendingDown, Droplets
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { getGradeTheme } from "./manage/locations/$id"
import { getStatusColor } from './workspace';
import { formatInTimeZone } from 'date-fns-tz';

export const Route = createFileRoute(
  '/_navbarLayout/fuel-management/order-pipeline',
)({
  component: OrderPipelineComponent,
})


const authHeader = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };

export function OrderPipelineComponent() {
  // --- 1. INITIAL STATE (Ontario selected by default) ---
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>(['Ontario']);
  const [provinceSearch, setProvinceSearch] = useState("");

  // --- 2. DATA FETCHING ---
  const { data: locations = [] } = useQuery({
    queryKey: ['all-locations-pipeline'],
    queryFn: async () => {
      const res = await axios.get('/api/fuel-station-tanks/all-locations', authHeader);
      return res.data;
    }
  });

  // --- 3. MEMOIZED DATA ---
  const provinces = useMemo(() => {
    const unique = Array.from(new Set(locations.map((loc: any) => loc.province))).filter(Boolean);
    return unique.sort();
  }, [locations]);

  const filteredProvinces = provinces.filter((p: any) =>
    p.toLowerCase().includes(provinceSearch.toLowerCase())
  );

  const activeSites = useMemo(() => {
    if (selectedProvinces.length === 0) return [];
    return locations.filter((loc: any) => selectedProvinces.includes(loc.province));
  }, [selectedProvinces, locations]);

  // --- 4. HANDLERS ---
  const shiftDate = (amount: number) => {
    const localToday = startOfDay(new Date());
    // Allowing 2 days in past and 4 days in future for stakeholders
    const maxFuture = addDays(localToday, 4);
    const maxPast = addDays(localToday, -2);

    const newDate = addDays(selectedDate, amount);

    if (isAfter(newDate, maxFuture) || isBefore(newDate, maxPast)) return;
    setSelectedDate(newDate);
  };

  const toggleProvince = (prov: string) => {
    setSelectedProvinces(prev =>
      prev.includes(prov) ? prev.filter(p => p !== prov) : [...prev, prov]
    );
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 pb-10">
      {/* HEADER SECTION */}
      <div className="w-full bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="w-full px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="bg-slate-900 p-2 rounded-xl shadow-lg shadow-slate-200">
                <ClipboardList className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black uppercase tracking-tight text-slate-800">Fuel Order Pipeline</h1>
              </div>
            </div>

            {/* BOLDER LEGEND */}
            <div className="flex items-center gap-6 ml-6 border-l-2 pl-6 border-slate-100">
              {/* Order Statuses */}
              <div className="flex items-center gap-4">
                {[
                  { label: 'Created', color: 'bg-yellow-500' },
                  { label: 'In Transit', color: 'bg-blue-600' },
                  { label: 'Delivered', color: 'bg-green-600' }
                ].map(status => (
                  <div key={status.label} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${status.color} ring-4 ring-white shadow-sm`} />
                    <span className="text-[11px] font-black uppercase text-slate-700">{status.label}</span>
                  </div>
                ))}
              </div>

              {/* Inventory Risks */}
              <div className="flex items-center gap-4 border-l-2 pl-6 border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm border-2 border-red-500 bg-red-100 animate-pulse" />
                  <span className="text-[11px] font-black uppercase text-slate-700">Refill</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm border-2 border-orange-500 bg-orange-100" />
                  <span className="text-[11px] font-black uppercase text-slate-700">Overflow</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm border-2 border-amber-500 bg-amber-100" />
                  <span className="text-[11px] font-black uppercase text-slate-700">Above Max</span>
                </div>
              </div>

              {/* Inventory Metrics Legend */}
              <div className="flex items-center gap-4 border-l-2 pl-6 border-slate-100">
                {/* Sales Metric */}
                <div className="flex items-center gap-2 group">
                  <div className="p-1 bg-slate-100 rounded shadow-sm">
                    <TrendingDown className="h-3 w-3 text-slate-500" />
                  </div>
                  <div className="flex flex-col leading-none">
                    <span className="text-[10px] font-black uppercase text-slate-700">Sales</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Est. Sales</span>
                  </div>
                </div>

                {/* Closing Volume Metric */}
                <div className="flex items-center gap-2 group">
                  <div className="p-1 bg-blue-50 rounded shadow-sm">
                    <Droplets className="h-3 w-3 text-blue-600" />
                  </div>
                  <div className="flex flex-col leading-none">
                    <span className="text-[10px] font-black uppercase text-slate-700">Closing</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Est. Closing</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DATE SLIDER */}
          <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl border-2 border-slate-200">
            <Button variant="ghost" size="icon" onClick={() => shiftDate(-1)} className="rounded-xl">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="px-4 text-center min-w-[140px]">
              <p className="text-[10px] font-black text-indigo-600 uppercase">
                {format(selectedDate, 'eeee')}
              </p>
              <p className="text-sm font-bold text-slate-800">{format(selectedDate, 'MMM dd, yyyy')}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => shiftDate(1)} className="rounded-xl">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* PROVINCE FILTER */}
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 text-white hover:bg-slate-800 font-bold gap-2 rounded-xl">
                <Filter className="h-4 w-4" />
                Filter by Province ({selectedProvinces.length})
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="uppercase font-black">Select Provinces</DialogTitle>
              </DialogHeader>
              <Input
                placeholder="Search province..."
                value={provinceSearch}
                onChange={(e) => setProvinceSearch(e.target.value)}
                className="my-2"
              />
              <div className="space-y-2 max-h-60 overflow-y-auto pt-2">
                {filteredProvinces.map((prov: any) => (
                  <div key={prov} className="flex items-center gap-3 p-3 border rounded-xl hover:bg-slate-50 cursor-pointer" onClick={() => toggleProvince(prov)}>
                    <Checkbox checked={selectedProvinces.includes(prov)} />
                    <span className="font-bold text-slate-700">{prov}</span>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* PIPELINE GRID */}
      <div className="p-6">
        {activeSites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-300">
            <MapPin className="h-16 w-16 mb-2 opacity-20" />
            <p className="font-bold italic">Select a province to view site pipelines</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {activeSites.map((site: any) => (
              <PipelineBlock key={site._id} site={site} date={selectedDate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineBlock({ site, date }: { site: any; date: Date }) {
  const [stationTime, setStationTime] = useState('');
  const gradeMap: Record<string, string> = {
    'Regular': 'REG',
    'Premium': 'PUL',
    'Diesel': 'ULSD',
    'Dyed Diesel': 'DYED'
  };

  const sortOrder = ['Regular', 'Premium', 'Diesel', 'Dyed Diesel'];

  // 1. FORMAT AS STRING (Avoids .toISOString() shifting dates for UTC stakeholders)
  const selectedDateStr = format(date, 'yyyy-MM-dd');

  const { data: tankData } = useQuery({
    queryKey: ['pipeline-tanks', site._id, selectedDateStr],
    queryFn: async () => {
      // Send the string, exactly like we do in StationStrip
      const res = await axios.get(`/api/fuel-station-tanks/station/${site._id}?date=${selectedDateStr}`, authHeader);
      return res.data;
    }
  });

  // 2. SERVER-DRIVEN DATE LOGIC
  const stationTodayStr = tankData?.stationToday; // Pull from the backend response
  // 1. ENSURE DATE STRINGS ARE DEFINED
  const activeDateStr = format(date, 'yyyy-MM-dd');

  const isToday = activeDateStr === stationTodayStr;
  const isPast = stationTodayStr ? activeDateStr < stationTodayStr : false;
  // const isFuture = stationTodayStr ? activeDateStr > stationTodayStr : false;

  const gradeSummary = useMemo(() => {
    const summary: Record<string, any> = {};

    (tankData?.tanks || []).forEach((t: any) => {
      const gradeKey = t.grade;
      if (!summary[gradeKey]) {
        summary[gradeKey] = {
          grade: gradeKey,
          sales: 0,
          closing: 0,
          min: 0,
          max: 0,
          total: 0
        };
      }

      // Use the enriched backend fields (openingL/closingL) which now have your fallback logic
      summary[gradeKey].sales += (t.estSalesL || 0);
      summary[gradeKey].closing += (t.closingL || 0);
      summary[gradeKey].min += (t.minVolumeCapacity || 0);
      summary[gradeKey].max += (t.maxVolumeCapacity || 0);
      summary[gradeKey].total += (t.tankCapacity || 0);
    });

    return summary;
  }, [tankData]);

  const { data: orders = [] } = useQuery({
    queryKey: ['pipeline-orders', site._id, selectedDateStr],
    queryFn: async () => {
      // Use the string dateParam to match the Workspace behavior
      const res = await axios.get(`/api/fuel-orders/workspace-orders?stationId=${site._id}&date=${selectedDateStr}`, authHeader);
      return res.data;
    }
  });

  // Helper to get the YYYY-MM-DD string without timezone shifting
  const getUTCString = (dateInput: string | Date) => {
    const d = new Date(dateInput);
    // This extracts the year, month, and day directly from the UTC values
    return d.toISOString().split('T')[0];
  };

  useEffect(() => {
    const tz = site?.timezone || 'America/Toronto';

    const updateClock = () => {
      const now = new Date();
      // 'MMM do' adds the ordinal (st, nd, rd, th) for the date
      const formatted = formatInTimeZone(now, tz, 'MMM do, h:mm:ss a');
      setStationTime(formatted);
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);

    return () => clearInterval(timer);
  }, [site?.timezone]);

  return (
    <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-h-[500px]">
      <div>
        {/* HEADER */}
        <div className="flex justify-between items-start mb-5 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 bg-slate-900 rounded-2xl flex-shrink-0 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-slate-200">
              {site.fuelStationNumber}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-800 uppercase leading-tight truncate">
                {site.stationName}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                {site.province}
              </p>
            </div>
          </div>

          {/* COMPACT CLOCK: No label, date & time on one line */}
          <div className="flex flex-col items-end flex-shrink-0 pt-0.5">
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg">
              {/* Small pulse dot */}
              <div className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-600"></span>
              </div>

              {/* Date & Time: Using a very tight font-mono */}
              <span className="text-[10px] font-mono font-black text-slate-700 tracking-tighter uppercase whitespace-nowrap">
                {stationTime || '--/-- --:--'}
              </span>
            </div>
          </div>
        </div>

        {/* GRADE INVENTORY - SORTED 2x2 GRID WITH RISK BORDERS */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {sortOrder
            .filter(gradeName => gradeSummary[gradeName])
            .map(gradeName => {
              const data = gradeSummary[gradeName] || { sales: 0, closing: 0, min: 0, max: 0, total: 0 };
              const theme = getGradeTheme(gradeName);

              const isLow = !isPast && data.closing <= data.min;
              const isOverflow = !isPast && data.closing > data.total;
              const isWarning = !isPast && data.closing > data.max && !isOverflow;

              // Logic: Keep original theme color, but override border and add shadow for alerts
              let ringClass = "border-slate-100";
              let shadowStyle = {};

              if (isLow) {
                ringClass = "border-red-600 ring-2 ring-red-100 animate-pulse";
                shadowStyle = { boxShadow: '0 0 15px rgba(220, 38, 38, 0.3)' };
              } else if (isOverflow) {
                ringClass = "border-orange-500 ring-2 ring-orange-100";
                shadowStyle = { boxShadow: '0 0 15px rgba(249, 115, 22, 0.3)' };
              } else if (isWarning) {
                ringClass = "border-amber-400";
              }

              return (
                <div
                  key={gradeName}
                  style={shadowStyle}
                  className={`
                  ${theme.light} ${ringClass}
                  border-2 p-3 rounded-2xl flex flex-col gap-2 min-h-[85px] transition-all duration-300 relative overflow-hidden
                `}
                >
                  {/* SMALL INDICATOR STRIP AT BOTTOM */}
                  {(isLow || isOverflow) && (
                    <div className={`absolute bottom-0 left-0 right-0 h-1 ${isLow ? 'bg-red-600' : 'bg-orange-500'}`} />
                  )}

                  <div className="flex justify-between items-center">
                    <span className={`text-[10px] font-black ${theme.label}`}>{gradeMap[gradeName] || gradeName}</span>
                    <theme.icon className={`h-3 w-3 ${theme.label} opacity-60`} />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <TrendingDown className="h-2.5 w-2.5 text-slate-400" />
                      <span className="text-[11px] font-mono font-black text-slate-700">
                        {data.sales.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-black/5 pt-1">
                      <Droplets className="h-2.5 w-2.5 text-blue-400" />
                      <span className={`text-[11px] font-mono font-black ${theme.label}`}>
                        {data.closing.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* LOGISTICS SECTION */}
        <div className="mb-2">
          <div className="flex justify-between items-center px-1 mb-2">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wide">
                {isPast ? 'Past Records' : isToday ? 'Today\'s Pipeline' : 'Future Projection'}
              </p>
              {/* Optional: Add a small pulsating dot for Today */}
              {isToday && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />}
            </div>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {orders.length} Records
            </span>
          </div>

          <div className="h-[180px] overflow-y-auto custom-scrollbar pr-1 pb-0 space-y-2">
            {orders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[10px] text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4 text-center">
                No activity for this date
              </div>
            ) : (
              orders.map((order: any) => {
                const estDate = getUTCString(order.estimatedDeliveryDate);
                const origDate = getUTCString(order.originalDeliveryDate);

                // These depend on activeDateStr being defined correctly above
                const wasMovedFromHere = origDate === activeDateStr && estDate !== activeDateStr;
                const arrivedHereFromHistory = estDate === activeDateStr && origDate !== activeDateStr;

                const formatSafeDate = (dateStr: string) => {
                  return format(new Date(dateStr.split('T')[0] + 'T12:00:00'), 'EEE, MMM do');
                };

                // --- 1. COLLAPSED VIEW (MOVED ORDERS) ---
                if (wasMovedFromHere) {
                  return (
                    <div key={order._id} className="flex flex-col gap-1 p-2 bg-orange-50/30 border border-dashed border-orange-200 rounded-xl opacity-80">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ArrowRight className="h-3 w-3 text-orange-600" />
                          <span className="text-[10px] font-black text-slate-500">{order.poNumber}</span>
                        </div>
                        <span className="text-[8px] font-black text-orange-600 uppercase">Rescheduled</span>
                      </div>
                      <div className="text-[9px] font-bold text-slate-500">
                        Moved to <span className="text-orange-700 underline">{formatSafeDate(order.estimatedDeliveryDate)}</span>
                      </div>
                    </div>
                  );
                }

                // --- 2. FULL VIEW (ACTIVE ON THIS DATE) ---
                const statusStyles = getStatusColor(order.currentStatus || 'no status');
                return (
                  <div key={order._id} className={`${statusStyles} border flex flex-col gap-1 p-2.5 rounded-xl transition-all shadow-sm`}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black uppercase">{order.poNumber}</span>
                        {arrivedHereFromHistory && (
                          <span className="text-[8px] px-1 bg-white/50 rounded text-slate-600 font-bold uppercase">
                            From {formatSafeDate(order.originalDeliveryDate)}
                          </span>
                        )}
                      </div>
                      <OrderDetailsDialog
                        order={order}
                        trigger={
                          <button className="p-1 hover:bg-white/50 rounded-md transition-colors">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <div className="flex items-center gap-1 opacity-80">
                        <Clock className="h-3 w-3" />
                        <span className="text-[9px] font-bold">
                          {order.estimatedDeliveryWindow?.start} - {order.estimatedDeliveryWindow?.end}
                        </span>
                      </div>
                      <span className="text-[10px] font-black bg-white/40 px-1.5 py-0.5 rounded">
                        {order.items?.reduce((a: number, b: any) => a + b.ltrs, 0).toLocaleString()} L
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="mt-2 pt-0 border-t border-slate-50">
        <Button variant="outline" className="w-full h-10 text-[10px] font-black uppercase rounded-xl border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white transition-all">
          <Link to="/fuel-management/volume" search={{ site: site?.stationName }}>
            View Current Volumes
          </Link>
        </Button>
      </div>
    </div>
  );
}


const OrderDetailsDialog = ({ order, trigger }: { order: any, trigger?: React.ReactNode }) => (
  <Dialog>
    <DialogTrigger asChild>
      {trigger || (
        <Button variant="outline" size="sm" className="h-5 px-2 text-[9px] font-black uppercase">
          View Details
        </Button>
      )}
    </DialogTrigger>
    <DialogContent className="max-w-md p-0 overflow-hidden border-2 border-slate-200 rounded-2xl">
      <div className="bg-blue-700 p-5 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight">Order: {order.poNumber}</h3>
            <p className="text-[10px] opacity-80 font-bold uppercase tracking-wide">
              Scheduled: {format(new Date(order.estimatedDeliveryDate), 'MMM dd, yyyy')}
            </p>
          </div>
          <div className="text-right bg-white/20 px-3 py-1 rounded-lg backdrop-blur-sm">
            <p className="text-[8px] font-black uppercase opacity-70">Delivery Window</p>
            <p className="text-sm font-black">
              {order.estimatedDeliveryWindow?.start} - {order.estimatedDeliveryWindow?.end}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-2 gap-6 bg-white">
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

        <div className="col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
          <label className="text-[9px] font-black text-slate-400 uppercase block mb-2 tracking-wider">
            Order Breakdown
          </label>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            {order.items
              ?.filter((item: any) => (item.ltrs || 0) > 0) // Only show items with quantities
              .sort((a: any, b: any) => {
                const GRADE_ORDER = ["Regular", "Premium", "Diesel", "Dyed Diesel"];
                const indexA = GRADE_ORDER.indexOf(a.grade);
                const indexB = GRADE_ORDER.indexOf(b.grade);
                return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
              })
              .map((item: any) => (
                <div key={item._id} className="flex justify-between border-b border-slate-200 py-1">
                  <span className="text-[10px] font-bold text-slate-600 uppercase">
                    {item.grade}
                  </span>
                  <span className="text-[10px] font-mono font-black text-blue-700">
                    {item.ltrs?.toLocaleString()} L
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);