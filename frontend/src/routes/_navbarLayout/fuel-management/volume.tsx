import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { Loader2, RefreshCw, Cylinder, History, LayoutDashboard, Edit3 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getGradeTheme } from './manage/locations/$id'
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type VolumeSearch = {
  site?: string
}

export const Route = createFileRoute('/_navbarLayout/fuel-management/volume')({
  // Ensure this returns VolumeSearch exactly
  validateSearch: (search: Record<string, unknown>): VolumeSearch => ({
    site: search.site as string || "",
  }),
  component: VolumeDashboard,
})

function VolumeDashboard() {
  const { site } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  // States
  const [viewMode, setViewMode] = useState<'live' | 'historical'>('live');
  const [allTanks, setAllTanks] = useState<any[]>([])
  const [historicalData, setHistoricalData] = useState<any[]>([])
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const fetchAndSync = async (isManual = false) => {
    if (isManual) setSyncing(true); else setLoading(true);
    try {
      const res = await axios.get('/api/fuel-station-tanks/sync-all-volumes', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      setAllTanks(res.data)
    } catch (err) {
      toast.error("Sync failed");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  // Fetch Historical Reconciliation Data
  const fetchHistorical = async (stationId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/fuel-station-tanks/reconciliation/${stationId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      setHistoricalData(res.data);

      // Automatically set the grade to the first one available in the new data
      if (res.data.length > 0 && res.data[0].grades.length > 0) {
        setSelectedGrade(res.data[0].grades[0].grade);
      }
    } catch (err) {
      toast.error("Historical fetch failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAndSync() }, [])

  const siteOptions = useMemo(() => {
    const sites = allTanks.map(t => t.stationName);
    return Array.from(new Set(sites));
  }, [allTanks]);

  const handleSiteChange = (newSite: string) => {
    navigate({ search: (prev: any) => ({ ...prev, site: newSite }) })
  }

  // 1. Get all tanks for this site and sort them by Tank Number
  // const activeTanks = useMemo(() => {
  //   return allTanks
  //     .filter(t => t.stationName === site)
  //     .sort((a, b) => a.tankNo - b.tankNo);
  // }, [allTanks, site]);

  const groupedTanks = useMemo(() => {
    const active = allTanks.filter(t => t.stationName === site).sort((a, b) => a.tankNo - b.tankNo);
    const groups: Record<string, any[]> = {};
    active.forEach(tank => {
      if (!groups[tank.grade]) groups[tank.grade] = [];
      groups[tank.grade].push(tank);
    });
    return groups;
  }, [allTanks, site]);

  // Filter reconciliation data for the chart based on selected grade
  const chartData = useMemo(() => {
    // REMOVED: No more frontend filtering. 
    // Trust that the backend reconciliation route is only returning closed days.

    return historicalData.map(day => {
      const gradeData = day.grades.find((g: any) => g.grade === selectedGrade);
      return {
        // Pass the date directly as it comes from the server
        date: day.date,
        salesVolume: gradeData?.salesVolume || 0,
        physicalDraw: gradeData?.physicalDraw || 0,
      };
    });
  }, [historicalData, selectedGrade]);

  // UI helpers...
  // Change this line in your VolumeDashboard
  // Find the tank for the selected site
  const selectedTank = allTanks.find(t => t.stationName === site);

  // If stationId was populated, it is an object. We need the ._id from inside it.
  const currentStationId = selectedTank?.stationId?._id || selectedTank?.stationId;

  useEffect(() => {
    // If we are in historical mode and the site changes, refresh the data
    if (viewMode === 'historical' && currentStationId) {
      fetchHistorical(currentStationId);
    }
  }, [site, viewMode, currentStationId]);
  // Adding currentStationId to dependencies ensures that once allTanks 
  // loads and we resolve the ID, the fetch triggers immediately.

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>

  return (
    <div className="p-8 w-full max-w-[1700px] mx-auto space-y-10">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
            <Cylinder className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-800 uppercase">
            {viewMode === 'live' ? 'Current Tank Volumes' : 'Inventory Audit'}
          </h1>

          <div className="h-10 w-px bg-slate-100 hidden md:block" />

          {/* Toggle View Button */}
          <Button
            variant="ghost"
            onClick={() => {
              if (viewMode === 'live') fetchHistorical(currentStationId);
              setViewMode(viewMode === 'live' ? 'historical' : 'live');
            }}
            className="rounded-2xl font-black uppercase text-[10px] tracking-wide gap-2"
          >
            {viewMode === 'live' ? <History className="h-4 w-4" /> : <LayoutDashboard className="h-4 w-4" />}
            {viewMode === 'live' ? 'View History' : 'Back to Live'}
          </Button>
        </div>
        <div className="flex gap-4">
          <Select value={site} onValueChange={handleSiteChange}>
            <SelectTrigger className="w-[300px] h-11 rounded-2xl border-slate-200 font-bold bg-slate-50 shadow-none">
              <SelectValue placeholder="Select a station..." />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              {siteOptions.map(opt => (
                <SelectItem key={opt} value={opt} className="rounded-xl font-bold py-3">{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => fetchAndSync(true)} disabled={syncing} className="bg-slate-900 rounded-2xl h-10 font-black">
            {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />} Fetch Latest
          </Button>
        </div>
      </div >

      {/* SINGLE UNIFIED ROW FOR ALL TANKS */}
      {/* CONTENT SWITCHER */}
      {viewMode === 'live' ? (
        <div className="flex gap-6 w-full pb-4 items-stretch">
          {/* items-stretch ensures all grade boxes are the same height */}
          {Object.entries(groupedTanks).map(([grade, tanks]) => (
            <GradeWrapper key={grade} grade={grade} tanks={tanks} onUpdate={fetchAndSync} />
          ))}
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Grade Selector for History */}
          <div className="flex gap-2">
            {['Regular', 'Premium', 'Diesel', 'Dyed Diesel'].map(g => (
              <Button
                key={g}
                onClick={() => setSelectedGrade(g)}
                className={`rounded-xl px-6 font-black uppercase text-[10px] tracking-wide ${selectedGrade === g ? 'bg-blue-600' : 'bg-slate-100 text-slate-400'}`}
              >
                {g}
              </Button>
            ))}
          </div>

          <SalesVsTankVarianceChart auditData={chartData} />

          {/* You could add a simple table here as well */}
        </div>
      )}
    </div>
  )
}

function GradeWrapper({ grade, tanks, onUpdate }: { grade: string; tanks: any[]; onUpdate: () => void }) {
  const theme = getGradeTheme(grade);

  // 1. Calculate sum ONLY for tanks that have valid recent readings
  // We exclude anything that explicitly says "No latest reading available"
  const validTanks = tanks.filter(
    (t) => t.lastUpdatedVolumeReadingDateTime &&
      t.lastUpdatedVolumeReadingDateTime !== "No latest reading available"
  );

  const totalVolume = validTanks.reduce((acc, t) => acc + (t.currentVolume || 0), 0);

  // 2. Determine if we should even show a total
  const showTotal = validTanks.length > 0;

  return (
    <div
      className={`flex flex-col gap-3 p-4 rounded-[45px] border-2 border-dashed ${theme.raw}25 bg-white/40 backdrop-blur-sm transition-all duration-300`}
      style={{ flex: `${tanks.length} 0 auto`, minWidth: `${tanks.length * 200}px` }}
    >
      <div className="flex justify-between items-center px-4 py-1">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${theme.color} animate-pulse`} />
          <h3 className={`text-[12px] font-black uppercase tracking-[0.2em] ${theme.label}`}>
            {grade}
          </h3>
        </div>

        {showTotal && (
          <div className="flex flex-col items-end">
            <span className="text-sm font-black text-slate-900 leading-none">
              {totalVolume.toLocaleString()} <span className="text-[10px]">L</span>
            </span>
          </div>
        )}
      </div>

      <div className={`grid grid-cols-${tanks.length} gap-3 w-full`}>
        {tanks.map((tank) => (
          <div key={tank._id} className="w-full">
            <VolumeTankCard tank={tank} onUpdate={onUpdate} />
          </div>
        ))}
      </div>
    </div>
  );
}

function VolumeTankCard({ tank, onUpdate }: { tank: any; onUpdate: () => void }) {
  const theme = getGradeTheme(tank.grade);
  const [manualVolume, setManualVolume] = useState("");
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualTime, setManualTime] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // New state for the button loader

  const readingTime = tank.lastUpdatedVolumeReadingDateTime || "";
  const isStale = readingTime === "No latest reading available" || readingTime === "";
  const isYesterday = readingTime.includes('Yesterday');
  const isManual = readingTime.includes('(Manual)');

  const fillPercentage = (tank.currentVolume / tank.tankCapacity) * 100;
  const maxLine = (tank.maxVolumeCapacity / tank.tankCapacity) * 100;
  const minLine = (tank.minVolumeCapacity / tank.tankCapacity) * 100;

  const isOverflowRisk = !isStale && tank.currentVolume >= tank.maxVolumeCapacity;
  const isCriticalLow = !isStale && tank.currentVolume <= tank.minVolumeCapacity;

  // Handle Submission
  const handleManualSubmit = async () => {
    if (!manualVolume || !manualTime || !manualDate) {
      toast.error("Please fill in all manual reading details");
      return;
    }
    setIsSubmitting(true);
    try {
      await axios.patch(`/api/fuel-station-tanks/manual-update/${tank._id}`,
        { volume: manualVolume, manualTime, manualDate },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      toast.success("Manual reading recorded");
      setIsOpen(false);
      onUpdate();
    } catch (err) {
      toast.error("Failed to update volume");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`bg-white rounded-[35px] p-4 flex flex-col h-full w-full transition-all duration-300 border-2 ${isCriticalLow ? 'border-red-500 shadow-lg shadow-red-100' :
      isOverflowRisk ? 'border-yellow-500 shadow-lg shadow-yellow-100' :
        'border-slate-100 hover:border-slate-300'
      } ${isStale && !isManual ? 'opacity-60' : ''}`}>

      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[8px] font-black uppercase tracking-wide text-slate-400">Tank</p>
            {isCriticalLow && <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />}
            {isOverflowRisk && <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />}
          </div>
          <span className="text-lg font-black italic text-slate-900">#0{tank.tankNo}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* MANUAL DIALOG BUTTON */}
          {(isStale || isYesterday || isManual) && (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={`h-8 w-8 rounded-xl border-slate-200 transition-all ${isManual ? 'text-green-600 bg-green-50 border-green-100 hover:bg-green-100' : 'text-blue-600 hover:bg-blue-50'
                    }`}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-[40px] border-none shadow-2xl p-8 max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black italic text-slate-900">
                    Physical Reading
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* STATION INFO HEADER WITH LOCAL TIME CLOCK */}
                  <div className="bg-slate-50 p-5 rounded-[30px] border border-slate-100 relative overflow-hidden">
                    <div className={`absolute top-0 right-0 h-full w-1.5 ${theme.color}`} />

                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Station / Tank</p>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-black text-slate-800">{tank.stationName}</span>
                            <span className="text-slate-300">/</span>
                            <span className="text-lg font-black text-blue-600">#0{tank.tankNo}</span>
                          </div>
                        </div>

                        <div className={`${theme.color} px-4 py-1.5 rounded-full shadow-sm`}>
                          <span className="text-[11px] font-black uppercase text-white tracking-wide">
                            {tank.grade}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Input Fields */}
                  <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase text-slate-500 ml-1 tracking-wide">
                      Current Physical Volume (Liters)
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="0,000"
                        className="h-16 rounded-[20px] border-2 border-slate-100 focus:border-blue-500 text-2xl font-black px-6 transition-all"
                        value={manualVolume}
                        onChange={(e) => setManualVolume(e.target.value)}
                      />
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-black italic text-xl">L</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label className="text-[11px] font-black uppercase text-slate-500 ml-1 tracking-wide">Reading Date</Label>
                      <Input
                        type="date"
                        className="h-14 rounded-[20px] border-2 border-slate-100 font-bold px-4 text-slate-700 focus:border-blue-500"
                        value={manualDate}
                        onChange={(e) => setManualDate(e.target.value)}
                      />
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[11px] font-black uppercase text-slate-500 ml-1 tracking-wide">Reading Time</Label>
                      <Input
                        type="time"
                        className="h-14 rounded-[20px] border-2 border-slate-100 font-bold px-4 text-slate-700 focus:border-blue-500"
                        value={manualTime}
                        onChange={(e) => setManualTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-[20px]">
                    <p className="text-[10px] font-bold text-blue-700 leading-relaxed text-center">
                      Please match the Date and Time precisely with the station's physical dip report.
                    </p>
                  </div>

                  <Button
                    onClick={handleManualSubmit}
                    disabled={!manualVolume || !manualTime || isSubmitting}
                    className="w-full h-16 rounded-[20px] bg-slate-900 text-white font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition-all shadow-lg active:scale-[0.98]"
                  >
                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save Physical Reading"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <div className={`${theme.color} p-1.5 rounded-xl text-white ${isStale && !isManual ? 'grayscale' : ''}`}>
            <theme.icon className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Cylinder */}
      <div className={`relative h-56 w-full bg-slate-50 rounded-[30px] border-4 border-white shadow-inner overflow-hidden mb-4 transition-all duration-500 ${isStale && !isManual ? 'blur-md grayscale' : ''}`}>
        <div
          className="absolute bottom-0 w-full transition-all duration-1000 ease-in-out"
          style={{
            height: `${fillPercentage}%`,
            background: `linear-gradient(180deg, ${theme.raw} 0%, ${theme.raw}cc 100%)`
          }}
        >
          <div className="absolute top-0 w-full h-1.5 bg-white/20 blur-[1px]" />
        </div>

        <div className="absolute w-full border-t border-sky-400/50 border-dashed z-10" style={{ bottom: `${maxLine}%` }} />
        <div className="absolute w-full border-t-2 border-red-500/40 z-10" style={{ bottom: `${minLine}%` }} />

        {(!isStale || isManual) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`px-3 py-1.5 rounded-2xl border backdrop-blur-md ${isCriticalLow ? 'bg-red-500 text-white border-red-400' :
              isOverflowRisk ? 'bg-yellow-500 text-slate-900 border-yellow-400' :
                'bg-white/90 text-slate-900 border-white'
              }`}>
              <span className="text-sm font-black flex flex-col items-center leading-none">
                {tank.currentVolume.toLocaleString()}
                <span className={`text-[9px] uppercase tracking-tight mt-0.5 ${isCriticalLow ? 'text-white/70' : 'text-slate-400'}`}>
                  Liters
                </span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Stats Section */}
      <div className="space-y-3 mt-auto">
        <div className={`bg-slate-50 p-2.5 rounded-2xl border border-slate-100/50 transition-all ${isStale && !isManual ? 'blur-[2px] opacity-40' : ''}`}>
          <div className="flex justify-between items-center px-1 mb-1.5">
            <span className="text-[7px] font-black text-slate-400 uppercase">Total Capacity</span>
            <span className="text-[10px] font-black text-slate-700">{tank.tankCapacity.toLocaleString()}L</span>
          </div>
          <div className="relative w-full h-4 bg-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
            <div
              className={`absolute left-0 h-full transition-all duration-1000 ${isCriticalLow ? 'bg-red-500' : isOverflowRisk ? 'bg-yellow-500' : 'bg-blue-600'}`}
              style={{ width: `${fillPercentage}%` }}
            />
            <span className="relative z-10 text-[9px] font-black text-white mix-blend-difference">
              {Math.round(fillPercentage)}% Filled
            </span>
          </div>
        </div>

        {/* Safety Legend */}
        <div className="grid grid-cols-2 gap-2 px-1">
          <div className="flex flex-col border-l-2 border-sky-400/50 pl-2">
            <span className="text-[7px] font-black text-slate-400 uppercase">Max Limit</span>
            <span className="text-[10px] font-bold text-slate-600">{tank.maxVolumeCapacity.toLocaleString()}L</span>
          </div>
          <div className="flex flex-col border-l-2 border-red-500/50 pl-2">
            <span className="text-[7px] font-black text-slate-400 uppercase">Min Limit</span>
            <span className="text-[10px] font-bold text-slate-600">{tank.minVolumeCapacity.toLocaleString()}L</span>
          </div>
        </div>

        {/* Sync Status */}
        <div className="pt-2 border-t border-slate-50 text-center">
          <p className="text-[7px] font-black text-slate-300 uppercase mb-0.5">Last Reading Time</p>
          <p className={`text-[12px] font-black tracking-tight ${isManual ? 'text-blue-600' :
            isStale ? 'text-slate-400 italic' :
              isYesterday ? 'text-orange-500' :
                isCriticalLow ? 'text-red-500 animate-pulse' : 'text-slate-600'
            }`}>
            {tank.lastUpdatedVolumeReadingDateTime || 'No Data'}
          </p>
        </div>
      </div>
    </div>
  );
}

function SalesVsTankVarianceChart({ auditData }: { auditData: any[] }) {
  return (
    <div className="bg-white p-8 rounded-[45px] border border-slate-100 shadow-sm space-y-6">
      <div className="flex justify-between items-end px-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wide text-slate-400">Inventory Reconciliation</h2>
          <p className="text-2xl font-black italic text-slate-900">Sales vs. Physical Draw</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-[10px] font-black uppercase text-slate-500">POS Sales</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-900" />
            <span className="text-[10px] font-black uppercase text-slate-500">Tank Draw</span>
          </div>
        </div>
      </div>

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={auditData}>
            <XAxis
              dataKey="date"
              tickFormatter={(d) => {
                // Use 'UTC' to ensure the date doesn't jump forward/backward
                const dateObj = new Date(d);
                const day = dateObj.getUTCDate();
                const month = dateObj.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
                return `${day} ${month}`;
              }}
              tick={{ fontSize: 10, fontWeight: 900 }}
              axisLine={false}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                borderRadius: '25px',
                border: 'none',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                padding: '15px 20px'
              }}
              // FIX: Force UTC here to prevent the EST/UTC offset shift
              labelFormatter={(value) => {
                const dateObj = new Date(value);
                return dateObj.toLocaleDateString('en-US', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  timeZone: 'UTC' // <--- This is the magic line
                });
              }}
              formatter={(value: number) => [`${value.toLocaleString()} L`]}
            />
            <Legend verticalAlign="top" align="right" height={36} />

            {/* Reported Sales from POS */}
            <Bar dataKey="salesVolume" name="POS Sales (L)" fill="#3b82f6" radius={[10, 10, 0, 0]} barSize={40} />

            {/* Physical movement calculated from Opening/Closing */}
            <Line
              type="monotone"
              dataKey="physicalDraw"
              name="Physical Draw (L)"
              stroke="#0f172a"
              strokeWidth={4}
              dot={{ r: 4, fill: '#0f172a' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}