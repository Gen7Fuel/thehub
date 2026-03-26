import { useState, useEffect, useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Save, Trash2, Loader2, Plus, Search, X, Warehouse } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import axios from 'axios'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export const Route = createFileRoute('/_navbarLayout/fuel-management/manage/carriers/$id')({
  component: EditCarrierComponent,
})

function EditCarrierComponent() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState<any>({ carrierName: '', carrierId: '', associatedRacks: [] })
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [rackSearch, setRackSearch] = useState('')

  // 1. Fetch ALL available racks for the multi-select
  const { data: allRacks = [] } = useQuery({
    queryKey: ['fuel-racks'],
    queryFn: async () => {
      const res = await axios.get('/api/fuel-racks', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      return res.data
    }
  })

  useEffect(() => {
    const fetchCarrier = async () => {
      try {
        const res = await axios.get(`/api/fuel-carriers/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        setFormData(res.data)
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    fetchCarrier()
  }, [id])

  // Filter racks based on the search in the dialog
  const filteredRacks = useMemo(() => {
    return allRacks.filter((r: any) =>
      r.rackName.toLowerCase().includes(rackSearch.toLowerCase())
    )
  }, [allRacks, rackSearch])

  const toggleRack = (rackId: string) => {
    const current = formData.associatedRacks.map((r: any) => typeof r === 'string' ? r : r._id)
    const updated = current.includes(rackId)
      ? current.filter((id: string) => id !== rackId)
      : [...current, rackId]
    setFormData({ ...formData, associatedRacks: updated })
  }

  const handleUpdate = async () => {
    setIsSaving(true)
    try {
      // Map associatedRacks to IDs only for the update request
      const payload = {
        ...formData,
        associatedRacks: formData.associatedRacks.map((r: any) => typeof r === 'string' ? r : r._id)
      }
      await axios.put(`/api/fuel-carriers/${id}`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      await queryClient.invalidateQueries({ queryKey: ['fuel-carriers'] })
      alert("Carrier updated successfully!")
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update carrier")
    } finally { setIsSaving(false) }
  }

  const handleDelete = async () => {
    if (!window.confirm("Are you sure? This cannot be undone.")) return
    try {
      await axios.delete(`/api/fuel-carriers/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      await queryClient.invalidateQueries({ queryKey: ['fuel-carriers'] })
      navigate({ to: '/fuel-management/manage/carriers' })
    } catch (err) { alert("Delete failed") }
  }

  if (loading) return <div className="p-10 flex items-center justify-center italic text-muted-foreground"><Loader2 className="animate-spin mr-2" /> Loading...</div>

  return (
    <div className="p-8 max-w-3xl animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-8 border-b pb-6">
        <h2 className="text-2xl font-bold tracking-tight">Edit Carrier</h2>
        <Button variant="ghost" onClick={handleDelete} className="text-red-500 hover:bg-red-50 hover:text-red-600 gap-2">
          <Trash2 className="h-4 w-4" /> Delete Carrier
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Basic Info */}
        <div className="space-y-6">
          <div className="space-y-4 p-6 border rounded-xl bg-white shadow-sm">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest">General Info</h3>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 ml-1">Carrier Name</label>
              <Input value={formData.carrierName} onChange={(e) => setFormData({ ...formData, carrierName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 ml-1">System ID</label>
              <Input value={formData.carrierId} onChange={(e) => setFormData({ ...formData, carrierId: e.target.value })} />
            </div>
          </div>

          <Button onClick={handleUpdate} disabled={isSaving} className="w-full gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>

        {/* Right: Associated Racks */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest">Associated Racks</h3>

            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs border-blue-200 text-blue-600">
                  <Plus className="h-3 w-3" /> Manage
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Assign Racks to Carrier</DialogTitle>
                </DialogHeader>
                <div className="relative my-4">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search racks by name..."
                    className="pl-9"
                    value={rackSearch}
                    onChange={(e) => setRackSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {filteredRacks.map((rack: any) => {
                    const isSelected = formData.associatedRacks.some((r: any) => (typeof r === 'string' ? r : r._id) === rack._id)
                    return (
                      <div
                        key={rack._id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer hover:bg-slate-50 ${isSelected ? 'border-blue-200 bg-blue-50/30' : 'border-transparent'}`}
                        onClick={() => toggleRack(rack._id)}
                      >
                        <div className="flex items-center gap-3">
                          <Warehouse className={`h-4 w-4 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                          <div>
                            <p className="text-sm font-semibold">{rack.rackName}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{rack.rackLocation}</p>
                          </div>
                        </div>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleRack(rack._id)} />
                      </div>
                    )
                  })}
                </div>
                <DialogFooter>
                  <p className="text-[10px] text-muted-foreground text-center w-full italic">
                    {formData.associatedRacks.length} rack(s) currently selected
                  </p>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-2">
            {formData.associatedRacks.length === 0 ? (
              <div className="p-8 border border-dashed rounded-xl text-center">
                <p className="text-xs text-muted-foreground">No racks assigned. This carrier won't be able to fulfill orders.</p>
              </div>
            ) : (
              formData.associatedRacks.map((rackRef: any) => {
                // 1. Extract the ID (handles both populated objects and raw strings)
                const rackId = typeof rackRef === 'string' ? rackRef : rackRef._id;

                // 2. Find the full rack details from the 'allRacks' data we already have
                const fullRackDetails = allRacks.find((r: any) => r._id === rackId);

                return (
                  <div key={rackId} className="flex items-center justify-between p-3 bg-white border rounded-lg group shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center text-slate-500">
                        <Warehouse className="h-4 w-4" />
                      </div>
                      {/* 3. Display the name from fullRackDetails, fallback to 'Unknown Rack' if not found */}
                      <span className="text-sm font-medium">
                        {fullRackDetails ? fullRackDetails.rackName : 'Unknown Rack'}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                      onClick={() => toggleRack(rackId)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}