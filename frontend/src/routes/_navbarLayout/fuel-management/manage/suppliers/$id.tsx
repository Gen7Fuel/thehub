import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
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
  // const navigate = useNavigate()
  const queryClient = useQueryClient()


  const [formData, setFormData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // const AVAILABLE_GRADES = ["Regular", "Premium", "Diesel", "Dyed Diesel"];

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

  if (isLoading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
  if (!formData) return <div className="p-8 text-center italic">Supplier not found.</div>

  // Find the full rack object based on the current selection in formData
  const selectedRackData = racks.find((r: any) =>
    (r._id === (formData.associatedRack?._id || formData.associatedRack))
  );

  // Fallback to empty array if no rack is found yet
  const rackSupportedGrades = selectedRackData?.availableGrades || [];

  // Update addBadge to include the empty array
  const addBadge = () => {
    setFormData({
      ...formData,
      supplierBadges: [
        ...formData.supplierBadges,
        { badgeName: '', badgeNumber: '', accountingId: '', isDefault: false, availableGrades: [] }
      ]
    });
  };

  // Helper to toggle grades for a specific badge index
  const toggleBadgeGrade = (badgeIndex: number, grade: string) => {
    const updatedBadges = [...formData.supplierBadges];
    const currentGrades = updatedBadges[badgeIndex].availableGrades || [];

    if (currentGrades.includes(grade)) {
      updatedBadges[badgeIndex].availableGrades = currentGrades.filter((g: string) => g !== grade);
    } else {
      updatedBadges[badgeIndex].availableGrades = [...currentGrades, grade];
    }

    setFormData({ ...formData, supplierBadges: updatedBadges });
  };

  const removeBadge = (index: number) => {
    setFormData({
      ...formData,
      supplierBadges: formData.supplierBadges.filter((_: any, i: number) => i !== index)
    })
  }

  // const handleBadgeChange = (index: number, field: string, value: any) => {
  //   const updated = [...formData.supplierBadges]
  //   // If setting a new default, uncheck all others
  //   if (field === 'isDefault' && value === true) {
  //     updated.forEach(b => b.isDefault = false)
  //   }
  //   updated[index] = { ...updated[index], [field]: value }
  //   setFormData({ ...formData, supplierBadges: updated })
  // }
  const handleBadgeChange = (index: number, field: string, value: any) => {
    const updated = [...formData.supplierBadges]
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

  // const handleDelete = async () => {
  //   if (!window.confirm("Are you sure you want to delete this supplier? This action cannot be undone.")) {
  //     return;
  //   }

  //   try {
  //     setIsSaving(true); // Reusing the saving state to disable buttons
  //     await axios.delete(`/api/fuel-suppliers/${id}`, {
  //       headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  //     });

  //     queryClient.invalidateQueries({ queryKey: ['fuel-suppliers'] });
  //     alert("Supplier deleted successfully");

  //     // Redirect back to the main list or dashboard after deletion
  //     navigate({ to: '/fuel-management/manage/suppliers' });
  //   } catch (err: any) {
  //     alert(err.response?.data?.message || "Failed to delete supplier");
  //   } finally {
  //     setIsSaving(false);
  //   }
  // };

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
              Rack: {selectedRackData?.rackName || 'Not Linked'} - {selectedRackData?.rackLocation || 'No Linked Location'}
            </p>
          </div>
        </div>
        {/* <Button
          variant="destructive"
          size="sm"
          className="gap-2"
          onClick={handleDelete}
          disabled={isSaving}
        >
          <Trash2 className="h-4 w-4" />
          {isSaving ? "Deleting..." : "Delete Supplier"}
        </Button> */}
      </div>

      <form onSubmit={handleUpdate} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border rounded-xl bg-white shadow-sm">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-slate-500">Supplier Name</label>
            <Input
              value={formData.supplierName}
              onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-slate-500">Associated Fuel Rack</label>
            {/* <Select
              value={formData.associatedRack?._id || formData.associatedRack}
              onValueChange={(val) => setFormData({ ...formData, associatedRack: val })}
            > */}
            <Select
              value={typeof formData.associatedRack === 'object' ? formData.associatedRack?._id : formData.associatedRack}
              onValueChange={(newRackId) => {
                const newRack = racks.find((r: any) => r._id === newRackId);
                const newRackGrades = newRack?.availableGrades || [];

                // Ensure supplierBadges exists before mapping
                const currentBadges = formData?.supplierBadges || [];

                const cleanedBadges = currentBadges.map((badge: any) => ({
                  ...badge,
                  availableGrades: badge.availableGrades?.filter((g: string) => newRackGrades.includes(g)) || []
                }));

                setFormData({
                  ...formData,
                  associatedRack: newRackId,
                  supplierBadges: cleanedBadges
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Change Rack" />
              </SelectTrigger>
              <SelectContent>
                {racks.map((rack: any) => (
                  <SelectItem key={rack._id} value={rack._id}>{rack.rackName} - {rack.rackLocation}</SelectItem>
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

          <div className="grid gap-4">
            {formData.supplierBadges.map((badge: any, index: number) => (
              <div
                key={index}
                className={`flex flex-col gap-4 p-5 border rounded-xl transition-all shadow-sm ${badge.isDefault ? 'bg-blue-50/40 border-blue-200' : 'bg-white border-slate-200'
                  }`}
              >
                {/* ROW 1: PRIMARY INPUTS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Badge Name</label>
                    <Input
                      className="bg-white h-10 w-full"
                      value={badge.badgeName}
                      onChange={e => handleBadgeChange(index, 'badgeName', e.target.value)}
                      placeholder="e.g. Unit Card"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Badge Number</label>
                    <Input
                      className="bg-white h-10 w-full"
                      value={badge.badgeNumber}
                      onChange={e => handleBadgeChange(index, 'badgeNumber', e.target.value)}
                      placeholder="ID#"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Bookworks ID</label>
                    <Input
                      className="bg-white h-10 w-full border-amber-200 focus:border-amber-500"
                      value={badge.accountingId || ''}
                      onChange={e => handleBadgeChange(index, 'accountingId', e.target.value)}
                      placeholder="Bookworks ID for Mapping"
                    />
                  </div>
                </div>

                {/* ROW 2: GRADES & ACTIONS (Moved Default here) */}
                <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 ml-1 block mb-2">
                      Badge Capabilities (Limited by {selectedRackData?.rackName || 'Rack'})
                    </label>

                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      {rackSupportedGrades.length > 0 ? (
                        rackSupportedGrades.map((grade: string) => (
                          <label key={grade} className="flex items-center gap-2 cursor-pointer group">
                            <div
                              onClick={() => toggleBadgeGrade(index, grade)}
                              className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${badge.availableGrades?.includes(grade)
                                ? 'bg-blue-600 border-blue-600'
                                : 'border-slate-300 bg-white group-hover:border-blue-400'
                                }`}
                            >
                              {badge.availableGrades?.includes(grade) && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                              )}
                            </div>
                            <span className={`text-sm font-semibold ${badge.availableGrades?.includes(grade) ? 'text-slate-900' : 'text-slate-500'
                              }`}>
                              {grade}
                            </span>
                          </label>
                        ))
                      ) : (
                        <span className="text-xs italic text-amber-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> No grades configured for this rack.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <Button
                      type="button"
                      variant={badge.isDefault ? "default" : "outline"}
                      size="sm"
                      className={`h-9 px-4 gap-2 shadow-sm ${badge.isDefault ? 'bg-blue-600' : 'text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                      onClick={() => handleBadgeChange(index, 'isDefault', true)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs uppercase font-bold">
                        {badge.isDefault ? 'Primary Default' : 'Set as Default'}
                      </span>
                    </Button>

                    {formData.supplierBadges.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeBadge(index)}
                        className="h-9 w-9 text-slate-300 hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
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