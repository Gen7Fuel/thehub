import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Save, Trash2, Warehouse, ArrowLeft, Loader2 } from 'lucide-react'
import axios from 'axios'
import { useQueryClient } from '@tanstack/react-query'

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

  // Fetch Rack Data
  useEffect(() => {
    const fetchRack = async () => {
      setIsLoading(true)
      try {
        const res = await axios.get(`/api/fuel-racks/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        setFormData(res.data)
      } catch (err) {
        console.error("Error fetching rack:", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchRack()
  }, [id])

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
      await axios.put(`/api/fuel-racks/${id}`, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      queryClient.invalidateQueries({ queryKey: ['fuel-racks'] })
      alert("Rack updated successfully")
    } catch (err) {
      alert("Failed to update rack")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  if (!formData) return <div className="p-8 text-center text-muted-foreground">Rack not found.</div>

  return (
    <div className="p-8 max-w-4xl animate-in fade-in duration-300">
      {/* Header Area */}
      <div className="flex items-center justify-between mb-8 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
            <Warehouse className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{formData.rackName}</h2>
            <p className="text-sm text-muted-foreground uppercase font-semibold">{formData.rackLocation}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="destructive" size="sm" className="gap-2">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Side: General Info */}
        <div className="space-y-6">
          <div className="space-y-4 p-6 border rounded-xl bg-white shadow-sm">
            <h3 className="font-bold text-sm uppercase text-slate-400 tracking-widest">General Details</h3>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600">Rack Name</label>
              <Input 
                value={formData.rackName} 
                onChange={(e) => setFormData({...formData, rackName: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600">Location / Terminal</label>
              <Input 
                value={formData.rackLocation} 
                onChange={(e) => setFormData({...formData, rackLocation: e.target.value})}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleUpdate} disabled={isSaving} className="px-8 gap-2">
              <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {/* Right Side: Grades & Associations */}
        <div className="space-y-6">
          <div className="p-6 border rounded-xl bg-slate-50/50 space-y-4">
            <h3 className="font-bold text-sm uppercase text-slate-400 tracking-widest">Supported Grades</h3>
            <div className="grid grid-cols-1 gap-2">
              {AVAILABLE_GRADES.map(grade => (
                <div 
                  key={grade} 
                  className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                    formData.availableGrades?.includes(grade) ? 'bg-white border-blue-200 ring-1 ring-blue-50' : 'bg-transparent border-transparent'
                  }`}
                >
                  <Checkbox 
                    id={`edit-${grade}`} 
                    checked={formData.availableGrades?.includes(grade)}
                    onCheckedChange={() => toggleGrade(grade)}
                  />
                  <label htmlFor={`edit-${grade}`} className="text-sm font-semibold cursor-pointer select-none">
                    {grade}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 border rounded-xl bg-white space-y-3">
             <h3 className="font-bold text-sm uppercase text-slate-400 tracking-widest">Relationships</h3>
             <div className="text-xs text-muted-foreground p-3 border border-dashed rounded italic">
               Carriers and Suppliers will be linked here once those modules are complete.
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}