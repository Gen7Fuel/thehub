import { useState, useEffect, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query' // 1. Import QueryClient
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save, Loader2, Plus, Trash2, MapPin, Hash, Car, Truck, Zap, BookText } from 'lucide-react'
import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"

export const Route = createFileRoute('/_navbarLayout/fuel-management/manage/locations/$id')({
  component: LocationFuelComponent,
})

function LocationFuelComponent() {
  const { id } = Route.useParams()
  const [locationData, setLocationData] = useState<any>(null)
  const [tanks, setTanks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient() // Initialize

  const { data: racks = [] } = useQuery({ queryKey: ['fuel-racks'], queryFn: async () => (await axios.get('/api/fuel-racks', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })).data })
  const { data: carriers = [] } = useQuery({ queryKey: ['fuel-carriers'], queryFn: async () => (await axios.get('/api/fuel-carriers', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })).data })

  const fetchData = async () => {
    setLoading(true) // Ensure loading state triggers on ID change
    try {
      const res = await axios.get(`/api/fuel-station-tanks/location/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      setLocationData(res.data.location)
      setTanks(res.data.tanks)
    } catch (err) {
      console.error(err)
      toast.error("Failed to load station data")
    } finally {
      setLoading(false)
    }
  }

  // 2. Fix for switching stations: Reset state when ID changes
  useEffect(() => {
    setLocationData(null) // Wipe previous station data immediately
    fetchData()
  }, [id])

  const handleUpdateLocation = async () => {
    setSaving(true)
    const payload = {
      fuelStationNumber: String(locationData.fuelStationNumber),
      address: locationData.address,
      defaultFuelRack: locationData.defaultFuelRack?._id || locationData.defaultFuelRack,
      defaultFuelCarrier: locationData.defaultFuelCarrier?._id || locationData.defaultFuelCarrier,
      fuelCustomerName: locationData.fuelCustomerName?._id || locationData.fuelCustomerName,
    }

    try {
      await axios.put(`/api/fuel-station-tanks/location/${id}`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })

      // 3. Fix for Sidebar: Invalidate the locations list query
      // Replace 'all-locations' with whatever queryKey you used in your Sidebar
      queryClient.invalidateQueries({ queryKey: ['all-locations'] })

      await fetchData()

      toast.success("Station Updated", {
        description: `Site ${payload.fuelStationNumber} configurations is now current.`
      })
    } catch (err) {
      toast.error("Update Failed")
    } finally {
      setSaving(false)
    }
  }

  const addTank = async () => {
    // Find the highest current tank number, default to 0 if no tanks exist
    const maxTankNo = tanks.length > 0
      ? Math.max(...tanks.map(t => t.tankNo || 0))
      : 0;

    try {
      await axios.post('/api/fuel-station-tanks/tanks', {
        stationId: id,
        tankNo: maxTankNo + 1, // Always one higher than the current max
        grade: 'Regular',
        tankCapacity: 25000,
        maxVolumeCapacity: 23750, // 95% default
        minVolumeCapacity: 5000
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      fetchData()
    } catch (err) { alert("Error adding tank") }
  }

  const sortedTanks = useMemo(() => {
    return [...tanks].sort((a, b) => (a.tankNo || 0) - (b.tankNo || 0));
  }, [tanks]);

  if (loading || !locationData) return <div className="p-10 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2" /> Initializing Station Data...</div>

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">{locationData.stationName}</h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{locationData.csoCode} — {locationData.legalName}</p>
        </div>
      </div>

      {/* 1. Meta Editor */}
      <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        {/* Row 1: Primary Identifiers */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
              <Hash className="h-3 w-3" /> Station ID
            </label>
            <Input
              className="bg-white font-mono h-10 border-slate-200 rounded-xl"
              value={locationData.fuelStationNumber || ''}
              onChange={(e) => setLocationData({ ...locationData, fuelStationNumber: e.target.value })}
            />
          </div>

          <div className="md:col-span-4 space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
              <BookText className="h-3 w-3" /> Customer Name
            </label>
            <Input
              className="bg-white h-10 border-slate-200 rounded-xl"
              placeholder="Enter Customer Name"
              value={locationData.fuelCustomerName || ''}
              onChange={(e) => setLocationData({ ...locationData, fuelCustomerName: e.target.value })}
            />
          </div>

          <div className="md:col-span-6 space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Site Address
            </label>
            <Input
              className="bg-white h-10 border-slate-200 rounded-xl"
              value={locationData.address || ''}
              onChange={(e) => setLocationData({ ...locationData, address: e.target.value })}
            />
          </div>
        </div>

        {/* Row 2: Logistics & Action */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end pt-2 border-t border-slate-100">
          <div className="md:col-span-4 space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Default Rack</label>
            <Select
              value={locationData.defaultFuelRack?._id || locationData.defaultFuelRack || ""}
              onValueChange={(val) => setLocationData({ ...locationData, defaultFuelRack: val })}
            >
              <SelectTrigger className="bg-white h-10 border-slate-200 rounded-xl">
                <SelectValue placeholder="Select Rack" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {racks.map((r: any) => (
                  <SelectItem key={r._id} value={r._id}>{r.rackName} — {r.rackLocation}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-4 space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Default Carrier</label>
            <Select
              value={locationData.defaultFuelCarrier?._id || locationData.defaultFuelCarrier || ""}
              onValueChange={(val) => setLocationData({ ...locationData, defaultFuelCarrier: val })}
            >
              <SelectTrigger className="bg-white h-10 border-slate-200 rounded-xl">
                <SelectValue placeholder="Select Carrier" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {carriers.map((c: any) => (
                  <SelectItem key={c._id} value={c._id}>{c.carrierName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-4">
            <Button
              onClick={handleUpdateLocation}
              disabled={saving}
              className="w-full h-10 bg-slate-900 hover:bg-blue-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-slate-200 gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Station Configuration
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Tanks Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <h3 className="text-sm font-black uppercase text-slate-400 tracking-tighter">Underground Storage Tanks (UST)</h3>
          <Button variant="outline" size="sm" onClick={addTank} className="border-blue-200 text-blue-600 hover:bg-blue-50 font-bold"><Plus className="h-4 w-4 mr-1" /> New Tank</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedTanks.map((tank: any) => (
            <TankCard key={tank._id} tank={tank} allTanks={tanks} onUpdate={fetchData} />
          ))}
        </div>
      </div>
    </div>
  )
}

function TankCard({ tank, allTanks, onUpdate }: { tank: any, allTanks: any[], onUpdate: () => void }) {
  const [editData, setEditData] = useState(tank)
  const [tempTankNo, setTempTankNo] = useState(tank.tankNo)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleUpdateId = async () => {
    const newId = Number(tempTankNo);
    const currentId = Number(tank.tankNo);

    // 1. Validation: Block Duplicates with an Alert
    const isDuplicate = allTanks.some(t =>
      Number(t.tankNo) === newId && t._id !== tank._id
    );

    if (isDuplicate) {
      // This will pause the browser and force the user to acknowledge
      window.alert(`CANNOT UPDATE: Tank #${newId} is already assigned to another tank at this station.`);
      return; // Stop the function here
    }

    // 2. Optional: Confirmation before hitting the DB
    if (!window.confirm(`Confirm changing Tank #${currentId} to #${newId}?`)) {
      return;
    }

    try {
      setIsSaving(true);
      await axios.put(`/api/fuel-station-tanks/tanks/${tank._id}`,
        { ...editData, tankNo: newId },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      setIsDialogOpen(false);
      onUpdate(); // This triggers the re-fetch and the Grid Sort in the parent

    } catch (err) {
      window.alert("Failed to update Tank ID. Please check your connection.");
    } finally {
      setIsSaving(false);
    }
  };

  // 1. Enhanced Grade Themes (Colors & Icons)
  const getGradeTheme = (grade: string) => {
    switch (grade) {
      case "Regular":
        return { color: "bg-green-500", label: "text-green-700", icon: Car, raw: "#22c55e" }
      case "Premium":
        return { color: "bg-red-500", label: "text-red-700", icon: Zap, raw: "#ef4444" }
      case "Diesel":
        return { color: "bg-amber-400", label: "text-amber-700", icon: Truck, raw: "#fbbf24" }
      case "Dyed Diesel":
        return { color: "bg-red-800", label: "text-red-950", icon: Truck, raw: "#991b1b" }
      default:
        return { color: "bg-slate-600", label: "text-slate-700", icon: Car, raw: "#475569" }
    }
  }

  const theme = getGradeTheme(editData.grade)
  const GradeIcon = theme.icon

  // 2. Volume-based line positioning logic
  // Max/Min are now pure percentage of total capacity
  const maxLinePos = (editData.maxVolumeCapacity / editData.tankCapacity) * 100
  const minLinePos = (editData.minVolumeCapacity / editData.tankCapacity) * 100

  // The Visual Fluid Height now locks to the "Max" line.
  const visualFluidHeight = maxLinePos

  const [isSaving, setIsSaving] = useState(false)

  const saveTank = async () => {
    setIsSaving(true)
    try {
      await axios.put(`/api/fuel-station-tanks/tanks/${tank._id}`, editData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })

      // Refresh the parent data
      onUpdate()

      // Success Feedback
      toast.success(`Tank #${tank.tankNo} Updated`, {
        description: `${editData.grade} specs are now synchronized.`,
        duration: 3000,
      })
    } catch (err) {
      console.error(err)
      toast.error("Update Failed", {
        description: "Could not save tank changes. Check your connection."
      })
    } finally {
      setIsSaving(false)
    }
  }
  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to remove Tank #${tank.tankNo}?`)) return
    try {
      await axios.delete(`/api/fuel-station-tanks/tanks/${tank._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      onUpdate()
    } catch (err) { alert("Failed to delete tank.") }
  }

  const gradeOptions = [
    { grade: "Regular", theme: getGradeTheme("Regular") },
    { grade: "Premium", theme: getGradeTheme("Premium") },
    { grade: "Diesel", theme: getGradeTheme("Diesel") },
    { grade: "Dyed Diesel", theme: getGradeTheme("Dyed Diesel") },
  ]

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 transition-all hover:border-blue-200 hover:shadow-xl relative overflow-hidden group">

      {/* 3. New Header: Delete next to Selector */}
      <div className="flex items-center gap-2 justify-between mb-8 pb-3 border-b border-slate-50">
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            className="h-9 w-9 flex items-center justify-center text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          <Select value={editData.grade} onValueChange={(val) => setEditData({ ...editData, grade: val })}>
            <SelectTrigger className={`border-none ${theme.color} h-9 rounded-xl font-bold ${theme.label} px-3 text-xs w-[180px] focus:ring-0 uppercase tracking-tight`}>
              <div className="flex items-center gap-2">
                <GradeIcon className="h-3.5 w-3.5 opacity-80" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent className="p-1.5 rounded-xl">
              {gradeOptions.map(opt => {
                const OptIcon = opt.theme.icon
                return (
                  <SelectItem
                    key={opt.grade}
                    value={opt.grade}
                    className={`rounded-lg p-3 my-0.5 relative transition-all`}
                    style={{ background: `linear-gradient(90deg, #fff 10%, ${opt.theme.raw}20 100%)` }}
                  >
                    <div className={`flex items-center gap-3 font-bold text-xs uppercase ${opt.theme.label}`}>
                      <OptIcon className="h-4 w-4 shrink-0" />
                      <span>{opt.grade}</span>
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
        {/* <span className="h-10 w-10 shrink-0 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl italic tracking-tighter shadow-lg shadow-slate-200">#{tank.tankNo}</span> */}
        {/* EDITABLE TANK NUMBER BADGE */}
        {/* 3. Tank ID Badge with Dialog Trigger */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <button className="h-10 px-3 shrink-0 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl italic tracking-tighter shadow-lg shadow-slate-200 hover:scale-105 transition-transform">
              #{tank.tankNo}
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[325px] rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black italic tracking-tighter">Update Tank Index</DialogTitle>
            </DialogHeader>
            <div className="py-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">New Tank Number</label>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black italic text-slate-300">#</span>
                  <Input
                    type="number"
                    value={tempTankNo}
                    onChange={(e) => setTempTankNo(Number(e.target.value))}
                    className="text-2xl font-black italic h-14 bg-slate-50 border-none focus-visible:ring-blue-500 rounded-2xl"
                  />
                </div>
              </div>
              <Button
                onClick={handleUpdateId}
                className="w-full h-12 bg-slate-900 hover:bg-blue-600 text-white font-bold rounded-2xl transition-all"
              >
                Confirm Re-index
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 4. Realistic Tank Graphic */}
      <div className="relative h-48 w-full flex items-center justify-center px-4 mb-6">
        <div className="w-full h-32 bg-slate-100 rounded-[50px] border-4 border-slate-200 relative overflow-hidden shadow-inner group-hover:border-slate-300 transition-colors duration-300">

          {/* The Fuel: Height is reactive to Max 95% Volume */}
          <div
            className={`absolute bottom-0 w-full transition-all duration-700 ease-out`}
            style={{ height: `${visualFluidHeight}%`, background: `linear-gradient(180deg, ${theme.raw} 0%, ${theme.raw}cc 100%)` }}
          >
            {/* 5. Realistic Texture: Gloss/Reflection Overlay */}
            <div className="absolute inset-0 bg-white opacity-20 filter blur-[2px] rounded-[50px] scale-x-90 translate-y-2" />
            <div className="absolute top-0 w-full h-px bg-white/40" />
          </div>

          {/* 6. Clean Safety Lines (No Text) */}
          {/* Max Volume Line - Safety Blue */}
          <div
            className="absolute w-full h-px bg-sky-400 z-20 transition-all duration-700 ease-out"
            style={{ bottom: `${maxLinePos}%` }}
          />

          {/* Min Volume Line - Critical Red */}
          <div
            className="absolute w-full h-0.5 bg-red-600 z-20 transition-all duration-700 ease-out"
            style={{ bottom: `${minLinePos}%` }}
          />

          <div className="absolute inset-0 flex flex-col items-center justify-center z-30 pointer-events-none">
            <span className="text-[10px] font-black uppercase text-white tracking-widest drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">Total Capacity</span>
            <span className="text-3xl font-black text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">{editData.tankCapacity.toLocaleString()}L</span>
          </div>
        </div>
      </div>

      {/* Configuration Inputs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1 p-3 bg-slate-50/70 rounded-xl border border-slate-100">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tank Size</label>
          <Input className="h-9 font-bold bg-white" type="number" value={editData.tankCapacity} onChange={(e) => setEditData({ ...editData, tankCapacity: Number(e.target.value) })} />
        </div>

        <div className="space-y-1 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
          <label className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">Safe Fill Max</label>
          <Input className="h-9 font-bold bg-white text-blue-700" type="number" value={editData.maxVolumeCapacity} onChange={(e) => setEditData({ ...editData, maxVolumeCapacity: Number(e.target.value) })} />
        </div>
        <div className="space-y-1 p-3 bg-red-50/50 rounded-xl border border-red-100/50">
          <label className="text-[9px] font-black text-red-500 uppercase tracking-tighter">Refill Amount</label>
          <Input className="h-9 font-bold bg-white text-red-700" type="number" value={editData.minVolumeCapacity} onChange={(e) => setEditData({ ...editData, minVolumeCapacity: Number(e.target.value) })} />
        </div>
      </div>

      <Button
        variant="ghost"
        className="w-full mt-6 h-10 text-xs font-black uppercase tracking-widest text-slate-600 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-xl transition-all"
        onClick={saveTank}
        disabled={isSaving}
      >
        {isSaving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
        ) : (
          <Save className="h-3.5 w-3.5 mr-2" />
        )}
        {isSaving ? "Saving..." : "Sync Tank Specs"}
      </Button>
    </div >
  )
}