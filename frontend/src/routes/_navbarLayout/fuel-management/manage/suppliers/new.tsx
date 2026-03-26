import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save, UserCheck, Plus, Trash2, CheckCircle2 } from 'lucide-react'
import axios from 'axios'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export const Route = createFileRoute('/_navbarLayout/fuel-management/manage/suppliers/new')({
  component: NewSupplierComponent,
})

function NewSupplierComponent() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Need Racks for the dropdown
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

  const [formData, setFormData] = useState({
    supplierName: '',
    associatedRack: '',
    supplierBadges: [{ badgeName: '', badgeNumber: '', isDefault: true }]
  })

  const addBadge = () => {
    setFormData({
      ...formData,
      supplierBadges: [...formData.supplierBadges, { badgeName: '', badgeNumber: '', isDefault: false }]
    })
  }

  const removeBadge = (index: number) => {
    setFormData({
      ...formData,
      supplierBadges: formData.supplierBadges.filter((_, i) => i !== index)
    })
  }

  const handleBadgeChange = (index: number, field: string, value: any) => {
    const updated = [...formData.supplierBadges]
    if (field === 'isDefault' && value === true) {
      updated.forEach(b => b.isDefault = false)
    }
    updated[index] = { ...updated[index], [field]: value }
    setFormData({ ...formData, supplierBadges: updated })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await axios.post('/api/fuel-suppliers', formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })

      // Refresh the list in Column 2
      queryClient.invalidateQueries({ queryKey: ['fuel-suppliers'] })

      // Redirect to the newly created supplier
      navigate({
        to: '/fuel-management/manage/suppliers/$id',
        params: { id: res.data._id }
      })
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to create supplier")
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white">
          <UserCheck className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Add New Supplier</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-2 gap-4 p-6 border rounded-xl bg-slate-50/50">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-slate-500">Supplier Name</label>
            <Input required value={formData.supplierName} onChange={e => setFormData({ ...formData, supplierName: e.target.value })} className="bg-white" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-slate-500">Pick-up Rack</label>
            <Select onValueChange={(val) => setFormData({ ...formData, associatedRack: val })}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select a Rack" />
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
            <h3 className="font-bold text-sm uppercase text-slate-400 tracking-widest">Supplier Badges</h3>
            <Button type="button" variant="outline" size="sm" onClick={addBadge} className="gap-2">
              <Plus className="h-3.5 w-3.5" /> Add Badge
            </Button>
          </div>

          {formData.supplierBadges.map((badge, index) => (
            <div key={index} className="flex items-end gap-3 p-4 border rounded-lg bg-white shadow-sm relative group">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Badge Name</label>
                <Input value={badge.badgeName} onChange={e => handleBadgeChange(index, 'badgeName', e.target.value)} placeholder="e.g. Suncor Card" />
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Badge Number</label>
                <Input value={badge.badgeNumber} onChange={e => handleBadgeChange(index, 'badgeNumber', e.target.value)} placeholder="000123" />
              </div>
              <Button
                type="button"
                variant={badge.isDefault ? "default" : "ghost"}
                size="icon"
                onClick={() => handleBadgeChange(index, 'isDefault', true)}
                className="shrink-0 h-10 w-10"
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
              {formData.supplierBadges.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => removeBadge(index)} className="text-red-500 h-10 w-10">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <Button type="submit" className="px-8 gap-2">Create Supplier <Save className="h-4 w-4" /></Button>
      </form>
    </div>
  )
}