import { useState, useMemo, useEffect } from 'react'
import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Plus, Search, Calendar, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from "@/context/AuthContext";
import { useSite } from '@/context/SiteContext';
import { LocationPicker } from '@/components/custom/locationPicker'

export const Route = createFileRoute('/_navbarLayout/cycle-count/manage/schedule')({
  component: ScheduleListLayout,
})

interface CycleCountInstance {
  id: number
  date: string
  day: string
  is_scheduled: boolean
  site_mongo_id: string
  scheduled_by: string | null
  group_id: number | null
}

function ScheduleListLayout() {
  const { user } = useAuth()
  const { selectedSite } = useSite()
  const [site, setSite] = useState(selectedSite || user?.location || "")
  const [searchTerm, setSearchTerm] = useState('')

  // Keep state updated if user switches site globally elsewhere
  useEffect(() => {
    if (selectedSite) {
      setSite(selectedSite)
    }
  }, [selectedSite])

  const activeProps = { className: 'border-l-4 border-primary bg-slate-50' }

  // Fetching the list of instances for the selected site picker
  const { data: instanceData, isLoading } = useQuery<{ instances: CycleCountInstance[] }>({
    queryKey: ['cycle-count-instances', site],
    queryFn: async () => {
      if (!site) return { instances: [] }
      const res = await axios.get('/api/cycle-count/instances', {
        params: { site },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      return res.data
    },
    enabled: !!site
  })

  const instances = instanceData?.instances || []

  // Filter instances by date or day typed string
  const filteredInstances = useMemo(() => {
    return instances.filter((instance) =>
      instance.date.toLowerCase().includes(searchTerm.toLowerCase()) ||
      instance.day.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [instances, searchTerm])

  return (
    <div className="flex w-full h-full overflow-hidden bg-white">
      {/* Sidebar List Section */}
      <aside className="w-80 border-r flex flex-col shrink-0 h-full bg-slate-50/30">
        <div className="p-4 border-b bg-white shrink-0 space-y-4">
          
          {/* Site Selection & Integration */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Station</label>
            <div className="mt-1 w-full">
              <LocationPicker setStationName={setSite} value="stationName" defaultValue={site} />
            </div>
          </div>

          {/* Header Action Row */}
          <div className="flex items-center justify-between pt-1">
            <h3 className="font-bold text-base tracking-tight">Schedules</h3>
            <Link to="/cycle-count/manage/schedule/new">
              <Button size="sm" variant="outline" className="h-8 px-2 gap-1 border-blue-200 hover:bg-blue-50 text-blue-600">
                <Plus className="h-3.5 w-3.5" />
                <span>Create</span>
              </Button>
            </Link>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by date or day..." 
              className="pl-9 h-9 bg-slate-50 border-slate-200 focus-visible:ring-1"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Scrollable Instances List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredInstances.map((instance) => {
                // Determine styling classes dynamically based on schedule state
                const badgeColorClass = instance.is_scheduled 
                  ? 'bg-amber-50 text-amber-600 border-amber-200 group-hover:bg-amber-100' 
                  : 'bg-blue-50 text-blue-600 border-blue-200 group-hover:bg-blue-100'

                const textMutedClass = instance.is_scheduled
                  ? 'text-amber-500/90'
                  : 'text-blue-500/90'

                return (
                  <Link
                    key={instance.id}
                    to="/cycle-count/manage/schedule/$id"
                    params={{ id: String(instance.id) }}
                    activeProps={activeProps}
                    className="group flex items-center gap-3.5 p-4 border-b bg-white hover:bg-slate-50/70 transition-all"
                  >
                    {/* Visual Status Indicator Container */}
                    <div className={`h-11 w-11 rounded-xl border flex flex-col items-center justify-center transition-colors ${badgeColorClass}`}>
                      <Calendar className="h-4 w-4 shrink-0" />
                    </div>

                    <div className="overflow-hidden flex-1">
                      <p className="font-bold text-sm tracking-tight text-slate-800">
                        {instance.date}
                      </p>
                      <p className={`text-xs font-semibold uppercase tracking-wide mt-0.5 ${textMutedClass}`}>
                        {instance.day} • {instance.is_scheduled ? 'Scheduled' : 'System'}
                      </p>
                    </div>
                  </Link>
                )
              })}

              {!isLoading && filteredInstances.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground bg-white m-4 rounded-xl border border-dashed">
                  No active instances found for this site.
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Main Detail Workspace Panel / Child Views ($id.tsx and new.tsx) */}
      <section className="flex-1 bg-slate-50/50 overflow-y-auto h-full">
        <Outlet />
      </section>
    </div>
  )
}