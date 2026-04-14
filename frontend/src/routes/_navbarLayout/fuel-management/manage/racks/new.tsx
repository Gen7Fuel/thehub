import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Save, Warehouse } from 'lucide-react'
import axios from 'axios'
import { useQueryClient } from '@tanstack/react-query'

export const Route = createFileRoute('/_navbarLayout/fuel-management/manage/racks/new')({
  component: NewRackComponent,
})

const AVAILABLE_GRADES = ["Regular", "Premium", "Diesel", "Dyed Diesel"]

function NewRackComponent() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    rackName: '',
    rackLocation: '',
    availableGrades: [] as string[]
  })

  const toggleGrade = (grade: string) => {
    setFormData(prev => ({
      ...prev,
      availableGrades: prev.availableGrades.includes(grade)
        ? prev.availableGrades.filter(g => g !== grade)
        : [...prev.availableGrades, grade]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await axios.post('/api/fuel-racks', formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      queryClient.invalidateQueries({ queryKey: ['fuel-racks'] })
      navigate({ to: '/fuel-management/manage/racks/$id', params: { id: res.data._id } })
    } catch (err) {
      alert("Failed to create rack")
    }
  }

  return (
    <div className="p-8 max-w-2xl animate-in fade-in slide-in-from-right-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-full bg-orange-600 flex items-center justify-center text-white">
          <Warehouse className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-bold">Add New Fuel Rack</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 p-6 border rounded-xl bg-slate-50/50">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-slate-500">Rack Name</label>
            <Input required placeholder="e.g. Suncor London" value={formData.rackName} onChange={e => setFormData({...formData, rackName: e.target.value})} className="bg-white" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-slate-500">City / Location</label>
            <Input required placeholder="e.g. London, ON" value={formData.rackLocation} onChange={e => setFormData({...formData, rackLocation: e.target.value})} className="bg-white" />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold uppercase text-slate-500">Available Fuel Grades</label>
            <div className="grid grid-cols-2 gap-4">
              {AVAILABLE_GRADES.map(grade => (
                <div key={grade} className="flex items-center space-x-2 bg-white p-3 rounded-md border shadow-sm">
                  <Checkbox 
                    id={grade} 
                    checked={formData.availableGrades.includes(grade)}
                    onCheckedChange={() => toggleGrade(grade)}
                  />
                  <label htmlFor={grade} className="text-sm font-medium leading-none cursor-pointer">{grade}</label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Button type="submit" className="w-full sm:w-auto px-8 gap-2">
          Create Rack <Save className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}