import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Save, Truck } from 'lucide-react'
import axios from 'axios'
import { useQueryClient } from '@tanstack/react-query'

export const Route = createFileRoute('/_navbarLayout/fuel-management/manage/carriers/new')({
  component: NewCarrierComponent,
})

function NewCarrierComponent() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState({
    carrierName: '',
    carrierId: '',
    associatedRacks: [],
    contact: '',
    contactName: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const res = await axios.post('/api/fuel-carriers', formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })

      // Invalidate the list query so the middle column refreshes
      queryClient.invalidateQueries({ queryKey: ['fuel-carriers'] })

      // Navigate to the newly created carrier
      navigate({
        to: '/fuel-management/manage/carriers/$id',
        params: { id: res.data._id }
      })
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to create carrier")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white">
          <Truck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Add New Carrier</h2>
          <p className="text-sm text-muted-foreground">Register a new logistics partner in the system.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 p-6 border rounded-xl bg-slate-50/50">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-slate-500 ml-1">Carrier Name</label>
            <Input
              required
              placeholder="e.g. Apps Transport"
              value={formData.carrierName}
              onChange={(e) => setFormData({ ...formData, carrierName: e.target.value })}
              className="bg-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-slate-500 ml-1">Carrier ID</label>
            <Input
              required
              placeholder="Unique Alpha-numeric ID (NPT)"
              value={formData.carrierId}
              onChange={(e) => setFormData({ ...formData, carrierId: e.target.value })}
              className="bg-white"
            />
          </div>

          
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-slate-500 ml-1">Primary Contact Name</label>
            <Input
              required
              placeholder="Enter contact name (Optional)"
              value={formData.contactName}
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
              className="bg-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-slate-500 ml-1">Primary Contact Information</label>
            <Input
              required
              placeholder="Enter contact information (Optional)"
              value={formData.contact}
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              className="bg-white"
            />
          </div>

        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting} className="px-8">
            {isSubmitting ? "Creating..." : "Create Carrier"}
            <Save className="ml-2 h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate({ to: '/fuel-management/manage/carriers' })}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}