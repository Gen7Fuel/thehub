import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Save, Trash2, ChevronLeft } from 'lucide-react'
import axios from 'axios'

export const Route = createFileRoute('/_navbarLayout/fuel-management/manage/carriers/$id')({
  component: EditCarrierComponent,
})

function EditCarrierComponent() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({ carrierName: '', carrierId: '', associatedRacks: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCarrier = async () => {
      try {
        const res = await axios.get(`/api/fuel-carriers/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        setFormData(res.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchCarrier()
  }, [id])

  const handleUpdate = async () => {
    try {
      await axios.put(`/api/fuel-carriers/${id}`, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      alert("Carrier updated successfully!")
    } catch (err) {
      alert("Failed to update carrier")
    }
  }

  if (loading) return <div className="p-10 text-muted-foreground italic">Loading details...</div>

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-2xl font-bold">Edit Carrier</h2>
      </div>

      <div className="grid gap-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold uppercase text-slate-500">Carrier Name</label>
          <Input 
            value={formData.carrierName} 
            onChange={(e) => setFormData({...formData, carrierName: e.target.value})}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold uppercase text-slate-500">Carrier System ID</label>
          <Input 
            value={formData.carrierId} 
            onChange={(e) => setFormData({...formData, carrierId: e.target.value})}
          />
        </div>

        {/* Note: We will add the Rack selection multi-select here once the Racks CRUD is ready */}
        <div className="p-4 border rounded-md bg-slate-50 border-dashed">
          <p className="text-xs text-slate-400 italic">Associated Racks management will appear here.</p>
        </div>

        <div className="flex items-center gap-3 pt-4">
          <Button onClick={handleUpdate} className="gap-2">
            <Save className="h-4 w-4" /> Save Changes
          </Button>
          <Button variant="destructive" className="gap-2">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>
    </div>
  )
}