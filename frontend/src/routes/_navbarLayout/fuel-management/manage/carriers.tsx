import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Plus, Search, Truck, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useMemo, useState } from 'react'

export const Route = createFileRoute('/_navbarLayout/fuel-management/manage/carriers')({
  component: CarrierListLayout,
})

function CarrierListLayout() {
  const [searchTerm, setSearchTerm] = useState('') // New search state

  // Assuming you're using React Query for data fetching
  const { data: carriers = [], isLoading } = useQuery({
    queryKey: ['fuel-carriers'],
    queryFn: async () => {
      const res = await axios.get('/api/fuel-carriers', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      return res.data
    }
  })

  // Filter the list based on search term
  const filteredCarriers = useMemo(() => {
    return carriers.filter((carrier: any) =>
      carrier.carrierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      carrier.carrierId.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [carriers, searchTerm])

  const activeProps = { className: 'border-l-4 border-primary bg-blue-50/50' }

  return (
    <div className="flex w-full h-full overflow-hidden bg-white">
      {/* COLUMN 2: The List Container */}
      <aside className="w-80 border-r flex flex-col shrink-0 h-full">

        {/* 1. PINNED HEADER with Add Button */}
        <div className="p-4 border-b bg-white shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg tracking-tight">Carriers</h3>
            <Link to="/fuel-management/manage/carriers/new">
              <Button size="sm" variant="outline" className="h-8 px-2 gap-1 border-blue-200 hover:bg-blue-50 hover:text-blue-600">
                <Plus className="h-3.5 w-3.5" />
                <span>New</span>
              </Button>
            </Link>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search carriers..."
              className="pl-9 h-9 bg-slate-50 border-none focus-visible:ring-1"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} // Bind change event
            />
          </div>
        </div>

        {/* 2. SCROLLABLE LIST AREA */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              <p className="text-xs text-muted-foreground mt-2 font-medium uppercase tracking-widest">Loading</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Empty state if search finds nothing */}
              {filteredCarriers.length === 0 && searchTerm && (
                <div className="p-8 text-center">
                  <p className="text-sm text-muted-foreground italic">No carriers found matching "{searchTerm}"</p>
                </div>
              )}

              {filteredCarriers.map((carrier: any) => (
                <Link
                  key={carrier._id}
                  to="/fuel-management/manage/carriers/$id"
                  params={{ id: carrier._id }}
                  activeProps={activeProps}
                  className="group flex items-center gap-3 p-4 border-b hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:shadow-sm transition-all">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-semibold text-sm truncate">{carrier.carrierName}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      ID: {carrier.carrierId}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* COLUMN 3: Content Area */}
      <section className="flex-1 bg-white overflow-y-auto h-full">
        <Outlet />
      </section>
    </div>
  )
}