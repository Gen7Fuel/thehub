import { useState, useEffect, useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Save, Trash2, Warehouse, Loader2, Search, Plus, X, Truck, CreditCard, ShieldCheck } from 'lucide-react'
import axios from 'axios'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export const Route = createFileRoute('/_navbarLayout/fuel-management/manage/racks/$id')({
  component: EditRackComponent,
})

const AVAILABLE_GRADES = ["Regular", "Premium", "Diesel", "Dyed Diesel"]

function EditRackComponent() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [carrierSearch, setCarrierSearch] = useState('')

  // 1. Fetch Suppliers and Carriers for associations
  const { data: allSuppliers = [] } = useQuery({
    queryKey: ['fuel-suppliers'],
    queryFn: async () => (await axios.get('/api/fuel-suppliers', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })).data
  })

  const { data: allCarriers = [] } = useQuery({
    queryKey: ['fuel-carriers'],
    queryFn: async () => (await axios.get('/api/fuel-carriers', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })).data
  })

  useEffect(() => {
    const fetchRack = async () => {
      try {
        const res = await axios.get(`/api/fuel-racks/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        setFormData(res.data)
      } catch (err) { console.error(err) } finally { setIsLoading(false) }
    }
    fetchRack()
  }, [id])

  // Helper to find default badge of the selected supplier
  const selectedSupplierData = useMemo(() => {
    const supplierId = formData?.defaultSupplier?._id || formData?.defaultSupplier
    const found = allSuppliers.find((s: any) => s._id === supplierId)
    return {
      full: found,
      defaultBadge: found?.supplierBadges?.find((b: any) => b.isDefault)
    }
  }, [formData?.defaultSupplier, allSuppliers])

  // 1. Filter suppliers to only show those belonging to THIS rack
  const rackSpecificSuppliers = useMemo(() => {
    return allSuppliers.filter((s: any) => {
      // Handle both populated objects and raw ID strings from the backend
      const supplierRackId = typeof s.associatedRack === 'string'
        ? s.associatedRack
        : s.associatedRack?._id;

      return supplierRackId === id;
    });
  }, [allSuppliers, id]);

  const filteredCarriers = useMemo(() => {
    return allCarriers.filter((c: any) => c.carrierName.toLowerCase().includes(carrierSearch.toLowerCase()))
  }, [allCarriers, carrierSearch])

  const toggleCarrier = (carrierId: string) => {
    const current = formData.associatedCarriers.map((c: any) => typeof c === 'string' ? c : c._id)
    const updated = current.includes(carrierId)
      ? current.filter((id: string) => id !== carrierId)
      : [...current, carrierId]
    setFormData({ ...formData, associatedCarriers: updated })
  }

  const toggleGrade = (grade: string) => {
    const currentGrades = formData.availableGrades || []
    const updatedGrades = currentGrades.includes(grade)
      ? currentGrades.filter((g: string) => g !== grade)
      : [...currentGrades, grade]
    setFormData({ ...formData, availableGrades: updatedGrades })
  }

  const handleUpdate = async () => {
    setIsSaving(true)
    try {
      const payload = {
        ...formData,
        defaultSupplier: formData.defaultSupplier?._id || formData.defaultSupplier,
        associatedCarriers: formData.associatedCarriers.map((c: any) => typeof c === 'string' ? c : c._id)
      }
      await axios.put(`/api/fuel-racks/${id}`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      queryClient.invalidateQueries({ queryKey: ['fuel-racks'] })
      alert("Rack updated successfully")
    } catch (err) { alert("Update failed") } finally { setIsSaving(false) }
  }

  const handleDelete = async () => {
    if (!window.confirm("Delete this rack?")) return
    try {
      await axios.delete(`/api/fuel-racks/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      queryClient.invalidateQueries({ queryKey: ['fuel-racks'] })
      navigate({ to: '/fuel-management/manage/racks' })
    } catch (err) { alert("Delete failed") }
  }

  if (isLoading || !formData) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>

  return (
    <div className="p-8 max-w-5xl animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-8 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600"><Warehouse className="h-6 w-6" /></div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{formData.rackName}</h2>
            <p className="text-sm text-muted-foreground uppercase font-semibold">{formData.rackLocation}</p>
          </div>
        </div>
        <Button variant="ghost" onClick={handleDelete} className="text-red-500 hover:bg-red-50 hover:text-red-600 gap-2">
          <Trash2 className="h-4 w-4" /> Delete Rack
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Basic Info & Grades */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 border rounded-xl bg-white shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest">General Info</h3>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600">Rack Name</label>
              <Input value={formData.rackName} onChange={(e) => setFormData({ ...formData, rackName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600">Location</label>
              <Input value={formData.rackLocation} onChange={(e) => setFormData({ ...formData, rackLocation: e.target.value })} />
            </div>
          </div>

          <div className="p-6 border rounded-xl bg-slate-50/50 space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest">Supported Grades</h3>
            <div className="space-y-2">
              {AVAILABLE_GRADES.map(grade => (
                <div key={grade} className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${formData.availableGrades?.includes(grade) ? 'bg-white border-blue-200' : 'border-transparent'}`}>
                  <Checkbox checked={formData.availableGrades?.includes(grade)} onCheckedChange={() => toggleGrade(grade)} />
                  <span className="text-sm font-semibold">{grade}</span>
                </div>
              ))}
            </div>
          </div>
          <Button onClick={handleUpdate} disabled={isSaving} className="w-full gap-2">
            <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save All Changes"}
          </Button>
        </div>

        {/* Middle Column: Supplier Link & All Badges */}
        <div className="space-y-6">
          <div className="p-6 border rounded-xl bg-white shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest">Default Supplier</h3>
              {rackSpecificSuppliers.length === 0 && (
                <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded">
                  No Suppliers found for this Rack
                </span>
              )}
            </div>

            <Select
              value={formData.defaultSupplier?._id || formData.defaultSupplier || ""}
              onValueChange={(val) => setFormData({ ...formData, defaultSupplier: val })}
            >
              <SelectTrigger className="bg-slate-50 border-none">
                <SelectValue placeholder={rackSpecificSuppliers.length > 0 ? "Choose Supplier" : "No available suppliers"} />
              </SelectTrigger>
              <SelectContent>
                {rackSpecificSuppliers.map((s: any) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.supplierName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedSupplierData.full && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <CreditCard className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-tight">Available Rack Badges</span>
                </div>

                <div className="grid gap-2">
                  {selectedSupplierData.full.supplierBadges?.length > 0 ? (
                    selectedSupplierData.full.supplierBadges.map((badge: any, idx: number) => (
                      <div
                        key={idx}
                        className={`relative p-3 rounded-lg border transition-all ${badge.isDefault
                          ? 'bg-blue-50/50 border-blue-200 ring-1 ring-blue-100'
                          : 'bg-white border-slate-100'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-slate-700">{badge.badgeName}</p>
                            <p className="text-xs font-mono text-slate-500">#{badge.badgeNumber}</p>
                          </div>

                          {badge.isDefault && (
                            <div className="flex items-center gap-1 bg-blue-600 text-white px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">
                              <ShieldCheck className="h-3 w-3" />
                              Primary
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 border border-dashed rounded-lg text-center">
                      <p className="text-xs italic text-slate-400">No badges registered for this supplier.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Carriers Multi-select */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest">Authorized Carriers</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"><Plus className="h-3 w-3" /> Manage</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Authorize Carriers</DialogTitle></DialogHeader>
                <div className="relative my-4">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search carriers..." className="pl-9" value={carrierSearch} onChange={(e) => setCarrierSearch(e.target.value)} />
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {filteredCarriers.map((carrier: any) => {
                    const isSelected = formData.associatedCarriers.some((c: any) => (typeof c === 'string' ? c : c._id) === carrier._id)
                    return (
                      <div key={carrier._id} className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50" onClick={() => toggleCarrier(carrier._id)}>
                        <span className="text-sm font-medium">{carrier.carrierName}</span>
                        <Checkbox checked={isSelected} />
                      </div>
                    )
                  })}
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-2">
            {formData.associatedCarriers.map((carrierRef: any) => {
              const cId = typeof carrierRef === 'string' ? carrierRef : carrierRef._id
              const full = allCarriers.find((c: any) => c._id === cId)
              return (
                <div key={cId} className="flex items-center justify-between p-3 bg-white border rounded-lg group">
                  <div className="flex items-center gap-3">
                    <Truck className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-medium">{full?.carrierName || 'Loading...'}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => toggleCarrier(cId)}><X className="h-4 w-4" /></Button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}