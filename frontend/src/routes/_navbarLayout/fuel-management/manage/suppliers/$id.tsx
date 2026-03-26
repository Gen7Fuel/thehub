import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save, UserCheck, Plus, Trash2, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import axios from 'axios'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export const Route = createFileRoute('/_navbarLayout/fuel-management/manage/suppliers/$id')({
  component: EditSupplierComponent,
})

function EditSupplierComponent() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

 // Fetch Racks for the dropdown with Authorization
  const { data: racks = [] } = useQuery({ 
    queryKey: ['fuel-racks'], 
    queryFn: async () => {
      const res = await axios.get('/api/fuel-racks', {
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        }
      });
      return res.data;
    }
  });

  // Fetch Current Supplier Data
  useEffect(() => {
    const fetchSupplier = async () => {
      setIsLoading(true)
      try {
        const res = await axios.get(`/api/fuel-suppliers/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        setFormData(res.data)
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchSupplier()
  }, [id])

  const addBadge = () => {
    setFormData({
      ...formData,
      supplierBadges: [...formData.supplierBadges, { badgeName: '', badgeNumber: '', isDefault: false }]
    })
  }

  const removeBadge = (index: number) => {
    setFormData({
      ...formData,
      supplierBadges: formData.supplierBadges.filter((_: any, i: number) => i !== index)
    })
  }

  const handleBadgeChange = (index: number, field: string, value: any) => {
    const updated = [...formData.supplierBadges]
    // If setting a new default, uncheck all others
    if (field === 'isDefault' && value === true) {
      updated.forEach(b => b.isDefault = false)
    }
    updated[index] = { ...updated[index], [field]: value }
    setFormData({ ...formData, supplierBadges: updated })
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await axios.put(`/api/fuel-suppliers/${id}`, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      queryClient.invalidateQueries({ queryKey: ['fuel-suppliers'] })
      alert("Supplier updated successfully")
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update supplier")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
  if (!formData) return <div className="p-8 text-center italic">Supplier not found.</div>

  return (
    <div className="p-8 max-w-4xl animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-8 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{formData.supplierName}</h2>
            <p className="text-sm text-muted-foreground font-semibold uppercase">
              Terminal: {formData.associatedRack?.rackName || 'Not Linked'}
            </p>
          </div>
        </div>
        <Button variant="destructive" size="sm" className="gap-2">
          <Trash2 className="h-4 w-4" /> Delete Supplier
        </Button>
      </div>

      <form onSubmit={handleUpdate} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border rounded-xl bg-white shadow-sm">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-slate-500">Supplier Name</label>
            <Input 
              value={formData.supplierName} 
              onChange={e => setFormData({...formData, supplierName: e.target.value})} 
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-slate-500">Associated Fuel Rack</label>
            <Select 
              value={formData.associatedRack?._id || formData.associatedRack} 
              onValueChange={(val) => setFormData({...formData, associatedRack: val})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Change Rack" />
              </SelectTrigger>
              <SelectContent>
                {racks.map((rack: any) => (
                  <SelectItem key={rack._id} value={rack._id}>{rack.rackName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
               <h3 className="font-bold text-sm uppercase text-slate-400 tracking-widest">Active Badges</h3>
               {!formData.supplierBadges.some((b: any) => b.isDefault) && (
                 <span className="flex items-center gap-1 text-[10px] text-amber-600 font-bold animate-pulse">
                   <AlertCircle className="h-3 w-3" /> No Default Set
                 </span>
               )}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addBadge} className="gap-2 border-dashed">
              <Plus className="h-3.5 w-3.5" /> Add New Badge
            </Button>
          </div>

          <div className="grid gap-3">
            {formData.supplierBadges.map((badge: any, index: number) => (
              <div key={index} className={`flex items-end gap-3 p-4 border rounded-xl transition-all ${badge.isDefault ? 'bg-blue-50/30 border-blue-200' : 'bg-white'}`}>
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Badge Name</label>
                  <Input 
                    className="bg-white h-9"
                    value={badge.badgeName} 
                    onChange={e => handleBadgeChange(index, 'badgeName', e.target.value)} 
                    placeholder="e.g. Unit Card"
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Badge Number</label>
                  <Input 
                    className="bg-white h-9"
                    value={badge.badgeNumber} 
                    onChange={e => handleBadgeChange(index, 'badgeNumber', e.target.value)} 
                    placeholder="ID#"
                  />
                </div>
                
                <div className="flex items-center gap-2 mb-0.5">
                  <Button 
                    type="button" 
                    variant={badge.isDefault ? "default" : "outline"} 
                    size="sm"
                    className={`h-9 px-3 gap-2 ${badge.isDefault ? '' : 'text-slate-400 border-slate-200'}`}
                    onClick={() => handleBadgeChange(index, 'isDefault', true)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xs uppercase font-bold">{badge.isDefault ? 'Default' : 'Set Default'}</span>
                  </Button>
                  
                  {formData.supplierBadges.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeBadge(index)} className="h-9 w-9 text-slate-300 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={isSaving} className="px-10 gap-2 shadow-lg shadow-blue-100">
          <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Update Supplier"}
        </Button>
      </form>
    </div>
  )
}