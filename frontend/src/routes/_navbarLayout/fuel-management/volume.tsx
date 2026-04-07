import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2, ArrowUpCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from "@/components/ui/button";

// 1. Define Search Params
type VolumeSearch = {
  stationId?: string
}

export const Route = createFileRoute('/_navbarLayout/fuel-management/volume')({
  validateSearch: (search: Record<string, unknown>): VolumeSearch => {
    return { stationId: search.stationId as string }
  },
  component: VolumeDashboard,
})

function VolumeDashboard() {
  const { stationId } = Route.useSearch()
  const navigate = useNavigate()
  
  const [allTanks, setAllTanks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  // 2. Fetch Data Function
  const fetchAndSync = async (isManual = false) => {
    if (isManual) setSyncing(true); else setLoading(true);
    try {
      const res = await axios.get('/api/fuel-station-tanks/sync-all-volumes', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      setAllTanks(res.data)
      if (isManual) toast.success("Network-wide volumes updated");
    } catch (err) {
      toast.error("Sync failed");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  useEffect(() => { fetchAndSync() }, [])

  // 3. Filter tanks based on the URL search param
  const activeTanks = useMemo(() => {
    return allTanks.filter(t => t.stationId === stationId)
  }, [allTanks, stationId])

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter text-slate-900">LIVE VOLUMES</h1>
          <p className="text-slate-500 font-medium">Real-time inventory monitoring & risk assessment.</p>
        </div>
        
        <Button 
          onClick={() => fetchAndSync(true)} 
          disabled={syncing}
          className="bg-slate-900 text-white rounded-2xl px-6 h-12 font-bold hover:bg-blue-600 transition-all gap-2"
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh Network Data
        </Button>
      </div>

      {activeTanks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeTanks.map(tank => (
            <VolumeTankCard key={tank._id} tank={tank} />
          ))}
        </div>
      ) : (
        <div className="h-64 border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center text-slate-400 font-bold">
          Select a station to view tank levels
        </div>
      )}
    </div>
  )
}

function VolumeTankCard({ tank }: { tank: any }) {
  const currentVol = tank.currentVolume || 0;
  const capacity = tank.tankCapacity;
  const maxSafe = tank.maxVolumeCapacity;
  const minRequired = tank.minVolumeCapacity;

  // Percentage for visuals
  const fillPercentage = (currentVol / capacity) * 100;
  const maxLinePos = (maxSafe / capacity) * 100;
  const minLinePos = (minRequired / capacity) * 100;

  // Logic for Alerts
  const isOverfilled = currentVol > maxSafe;
  const needsRefill = currentVol < minRequired;
  const criticalLow = currentVol < (capacity * 0.15); // 15% absolute floor

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm relative overflow-hidden">
      {/* Header Info */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tank #{tank.tankNo}</span>
          <h3 className="text-xl font-black text-slate-800 uppercase">{tank.grade}</h3>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Last Reading</span>
          <p className="text-sm font-bold text-slate-700">{tank.lastUpdatedVolumeReadingDateTime || '--:--'}</p>
        </div>
      </div>

      {/* Visual Tank Component */}
      <div className="relative h-40 w-full bg-slate-50 rounded-[40px] border-4 border-white shadow-inner mb-6 overflow-hidden">
        {/* The Fluid */}
        <div 
          className={`absolute bottom-0 w-full transition-all duration-1000 ease-in-out ${
            criticalLow ? 'bg-red-500' : needsRefill ? 'bg-amber-500' : 'bg-blue-500'
          }`}
          style={{ height: `${fillPercentage}%` }}
        >
          <div className="absolute top-0 w-full h-1 bg-white/20" />
        </div>

        {/* Safety Limit Lines */}
        <div className="absolute w-full border-t border-sky-400/50 z-10" style={{ bottom: `${maxLinePos}%` }}>
           <span className="text-[8px] font-black text-sky-500 uppercase ml-2 bg-white/80 px-1 rounded">Safe Max</span>
        </div>
        <div className="absolute w-full border-t-2 border-red-500/50 z-10" style={{ bottom: `${minLinePos}%` }}>
           <span className="text-[8px] font-black text-red-500 uppercase ml-2 bg-white/80 px-1 rounded">Refill Point</span>
        </div>

        {/* Center Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
          <span className="text-2xl font-black text-slate-900 drop-shadow-sm">{currentVol.toLocaleString()}L</span>
          <span className="text-[10px] font-bold text-slate-500 uppercase">of {capacity.toLocaleString()}L</span>
        </div>
      </div>

      {/* Dynamic Warning Messages */}
      <div className="space-y-2">
        {isOverfilled && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-2xl border border-red-100 animate-pulse">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-black uppercase">Overflow Risk! Above Safe Limit</span>
          </div>
        )}
        {needsRefill && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-2xl border border-amber-100">
            <ArrowUpCircle className="h-4 w-4" />
            <span className="text-xs font-black uppercase">Low Inventory: Reorder Suggested</span>
          </div>
        )}
        {!needsRefill && !isOverfilled && (
          <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-2xl border border-green-100">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-black uppercase">Status: Optimal Level</span>
          </div>
        )}
      </div>
    </div>
  )
}