import { useState, useMemo } from 'react'
import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { Search, Fuel, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export const Route = createFileRoute('/_navbarLayout/fuel-management/manage/locations')({
  component: LocationListLayout,
})

function LocationListLayout() {
  const [searchTerm, setSearchTerm] = useState('')
  const activeProps = { className: 'border-l-4 border-blue-600 bg-blue-50/50' }

  // 1. Ensure the key is 'locations-list' to match the detail page's invalidation call
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['locations-list'],
    queryFn: async () => {
      const res = await axios.get('/api/fuel-station-tanks/stations', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      return res.data
    },
    // Adding this ensures the list stays fresh when you navigate back and forth
    staleTime: 0
  })

  // 2. Updated Filter Logic for String IDs
  const filteredLocations = useMemo(() => {
    const search = searchTerm.toLowerCase().trim()
    return locations.filter((loc: any) => {
      return (
        loc.stationName?.toLowerCase().includes(search) ||
        loc.csoCode?.toLowerCase().includes(search) ||
        loc.legalName?.toLowerCase().includes(search) ||
        // Since it's a string "06", this will now match "06" correctly
        String(loc.fuelStationNumber || "").toLowerCase().includes(search)
      )
    })
  }, [locations, searchTerm])

  return (
    <div className="flex w-full h-full overflow-hidden bg-white">
      <aside className="w-80 border-r flex flex-col shrink-0 h-full">
        <div className="p-4 border-b bg-white shrink-0 space-y-3">
          <h3 className="font-bold text-lg tracking-tight">Stations</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search station, CSO, legal..."
              className="pl-9 h-9 bg-slate-50 border-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-muted-foreground" /></div>
          ) : (
            <div className="flex flex-col">
              {filteredLocations.map((loc: any) => (
                <Link
                  key={loc._id}
                  to="/fuel-management/manage/locations/$id"
                  params={{ id: loc._id }}
                  activeProps={activeProps}
                  // This is important: clicking a link should trigger the ID change in the detail view
                  className="group flex items-center gap-3 p-4 border-b hover:bg-slate-50 transition-all"
                >
                  <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white shrink-0">
                    <Fuel className="h-5 w-5" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-bold text-sm truncate">
                      {loc.stationName} <span className="text-blue-500 ml-1">({loc.csoCode})</span>
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase truncate">
                      {loc.legalName} <span className="ml-1 opacity-60">#{loc.fuelStationNumber}</span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </aside>

      <section className="flex-1 bg-white overflow-y-auto h-full">
        <Outlet />
      </section>
    </div>
  )
}