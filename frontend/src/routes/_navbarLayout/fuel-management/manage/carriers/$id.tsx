import { useState, useEffect, useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Save, Trash2, Loader2, Plus, Search, X, Warehouse } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
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

  const [formData, setFormData] = useState<any>({ carrierName: '', carrierId: '', associatedRacks: [], email: '', contact: '' })
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [rackSearch, setRackSearch] = useState('')
  const [newToEmail, setNewToEmail] = useState('');
  const [newCcEmail, setNewCcEmail] = useState('');

  // Helper to add emails to arrays
  const addEmail = (field: 'toEmails' | 'ccEmails', value: string) => {
    if (!value || !value.includes('@')) return;
    const current = formData[field] || [];
    if (current.includes(value)) return;
    setFormData({ ...formData, [field]: [...current, value] });
    field === 'toEmails' ? setNewToEmail('') : setNewCcEmail('');
  };

  const removeEmail = (field: 'toEmails' | 'ccEmails', emailToRemove: string) => {
    setFormData({
      ...formData,
      [field]: formData[field].filter((email: string) => email !== emailToRemove)
    });
  };

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
      setLoading(true); // Trigger loading state
      // 1. Reset state immediately so old data doesn't "ghost" 
      setFormData({ carrierName: '', carrierId: '', associatedRacks: [], email: '', contact: '' });

      try {
        const res = await axios.get(`/api/fuel-carriers/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });

        setFormData(res.data);
      } catch (err) {
        console.error(err);
        alert("Error loading carrier");
      } finally {
        setLoading(false);
      }
    };

    fetchCarrier();
  }, [id]); // Dependencies: only run when ID changes

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
    <div className="p-8 max-w-5xl animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-8 border-b pb-6">
        <h2 className="text-2xl font-bold tracking-tight">Edit Carrier</h2>
        <Button variant="ghost" onClick={handleDelete} className="text-red-500 hover:bg-red-50 hover:text-red-600 gap-2">
          <Trash2 className="h-4 w-4" /> Delete Carrier
        </Button>
      </div>

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">

        {/* Left Column: General Info & Manage Racks Trigger */}
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
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 ml-1">Primary Contact</label>
              <Input value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value })} />
            </div>
          </div>

          <div className="p-6 border rounded-xl bg-slate-50 border-dashed flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-700">Manage Racks</h3>
              <p className="text-xs text-muted-foreground">Assign terminals to this carrier.</p>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2 bg-white">
                  <Plus className="h-4 w-4" /> Assign Racks
                </Button>
              </DialogTrigger>
              {/* ... DialogContent stays the same as your previous code ... */}
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Assign Racks</DialogTitle></DialogHeader>
                <div className="relative my-4">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search..." className="pl-9" value={rackSearch} onChange={(e) => setRackSearch(e.target.value)} />
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {filteredRacks.map((rack: any) => {
                    const isSelected = formData.associatedRacks.some((r: any) => (typeof r === 'string' ? r : r._id) === rack._id)
                    return (
                      <div key={rack._id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-slate-50" onClick={() => toggleRack(rack._id)}>
                        <div className="flex items-center gap-3">
                          <Warehouse className="h-4 w-4" />
                          <span className="text-sm font-semibold">{rack.rackName}</span>
                          <p className="text-[10px] uppercase text-muted-foreground">{rack.rackLocation}</p>
                        </div>
                        <Checkbox checked={isSelected} />
                      </div>
                    )
                  })}
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Button onClick={handleUpdate} disabled={isSaving} className="w-full gap-2 py-6 text-lg shadow-lg shadow-blue-100">
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            Save Carrier Profile
          </Button>
        </div>

        {/* Right Column: Email Distribution */}
        <div className="space-y-4 p-6 border rounded-xl bg-white shadow-sm h-full">
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest">Email Distribution</h3>

          {/* To Emails */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600">To Recipients (Carriers)</label>
            <div className="flex gap-2">
              <Input
                placeholder="Add email..."
                value={newToEmail}
                onChange={(e) => setNewToEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail('toEmails', newToEmail))}
              />
              <Button size="sm" type="button" onClick={() => addEmail('toEmails', newToEmail)}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-slate-50 rounded-lg border border-inset">
              {(formData.toEmails || []).map((email: string) => (
                <span key={email} className="flex items-center gap-1 bg-blue-600 text-white px-2 py-1 rounded-md text-[11px] font-medium">
                  {email} <X className="h-3 w-3 cursor-pointer hover:text-red-200" onClick={() => removeEmail('toEmails', email)} />
                </span>
              ))}
            </div>
          </div>

          {/* CC Emails */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600">CC Recipients (Internal)</label>
            <div className="flex gap-2">
              <Input
                placeholder="Add email..."
                value={newCcEmail}
                onChange={(e) => setNewCcEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail('ccEmails', newCcEmail))}
              />
              <Button size="sm" type="button" onClick={() => addEmail('ccEmails', newCcEmail)}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-slate-50 rounded-lg border border-inset">
              {(formData.ccEmails || []).map((email: string) => (
                <span key={email} className="flex items-center gap-1 bg-slate-500 text-white px-2 py-1 rounded-md text-[11px] font-medium">
                  {email} <X className="h-3 w-3 cursor-pointer hover:text-red-200" onClick={() => removeEmail('ccEmails', email)} />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Horizontal Racks Display */}
      <div className="pt-6 border-t">
        <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest mb-4">Current Assignments</h3>
        <div className="flex flex-wrap gap-4">
          {formData.associatedRacks.length === 0 ? (
            <div className="w-full p-6 bg-slate-50 border border-dashed rounded-xl text-center text-muted-foreground text-sm">
              No racks assigned. Use the 'Manage Racks' button above to start.
            </div>
          ) : (
            formData.associatedRacks.map((rackRef: any) => {
              const rackId = typeof rackRef === 'string' ? rackRef : rackRef._id;
              const fullRack = allRacks.find((r: any) => r._id === rackId);
              return (
                <div key={rackId} className="flex items-center gap-3 p-3 bg-white border rounded-xl shadow-sm min-w-[200px] relative group hover:border-blue-300 transition-colors">
                  <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <Warehouse className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold truncate max-w-[140px]">{fullRack?.rackName || 'Unknown'}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">{fullRack?.rackLocation}</p>
                  </div>
                  <button
                    onClick={() => toggleRack(rackId)}
                    className="absolute -top-2 -right-2 bg-white border shadow-sm rounded-full p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}