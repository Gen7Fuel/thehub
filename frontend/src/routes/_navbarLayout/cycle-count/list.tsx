import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, Eye, Plus } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { LocationPicker } from '@/components/custom/locationPicker'

export const Route = createFileRoute('/_navbarLayout/cycle-count/list')({
  component: RouteComponent,
})

interface Cycle {
  _id: string
  site: string
  startDate: string
  completed?: boolean
}

function RouteComponent() {
  const navigate = useNavigate()
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSite, setSelectedSite] = useState<string>(localStorage.getItem('location') || '')

  // Fetch cycles from backend, filtered by site if selected
  const fetchCycles = async (site?: string) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const params = site ? `?site=${encodeURIComponent(site)}` : ''
      const response = await fetch(`/api/cycle-counts/cycles${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setCycles(data.cycles || [])
      } else {
        setCycles([])
        toast.error('Failed to load cycle count entries')
      }
    } catch (error) {
      setCycles([])
      toast.error('Failed to load cycle count entries')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCycles(selectedSite)
  }, [selectedSite])

  // const formatDate = (dateString: string) => {
  //   const date = new Date(dateString)
  //   return date.toLocaleDateString('en-GB', {
  //     day: '2-digit',
  //     month: '2-digit',
  //     year: 'numeric'
  //   })
  // }

  return (
    <div className="pt-16 container mx-auto p-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cycle Count Entries</h1>
          <p className="text-muted-foreground mt-2">
            View and manage cycle count schedules by site
          </p>
        </div>
        <div className="flex gap-4 items-center">
          <LocationPicker
            setStationName={setSelectedSite}
            value="stationName"
          />
          <Button asChild>
            <a href="/cycle-count">
              <Plus className="h-4 w-4 mr-2" />
              Upload New
            </a>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-muted-foreground">Loading entries...</p>
        </div>
      ) : cycles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No cycle count entries found</h3>
            <p className="text-muted-foreground mt-2">
              {selectedSite
                ? `No entries found for ${selectedSite}. Try selecting a different site.`
                : 'Upload an Excel file to create cycle count entries.'
              }
            </p>
            <Button asChild className="mt-4">
              <a href="/cycle-count">
                <Plus className="h-4 w-4 mr-2" />
                Upload Excel File
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cycles.map(cycle => (
            <Card key={cycle._id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {cycle.site}
                  </CardTitle>
                  <Badge variant={cycle.completed ? 'default' : 'secondary'}>
                    {cycle.completed ? 'Completed' : 'Active'}
                  </Badge>
                </div>
                <CardDescription>
                  Start: {new Date(cycle.startDate).toLocaleDateString('en-CA', { timeZone: 'UTC' })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => navigate({ to: `/cycle-count/entry/${cycle._id}` })}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Toaster richColors position="top-center" />
    </div>
  )
}