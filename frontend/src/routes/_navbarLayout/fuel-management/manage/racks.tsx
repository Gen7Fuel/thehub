import { useState, useMemo } from 'react'
import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Plus, Search, Warehouse, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export const Route = createFileRoute('/_navbarLayout/fuel-management/manage/racks')({
  component: RackListLayout,
})

function RackListLayout() {
  const [searchTerm, setSearchTerm] = useState('')
  const activeProps = { className: 'border-l-4 border-primary bg-blue-50/50' }

  const { data: racks = [], isLoading } = useQuery({
    queryKey: ['fuel-racks'],
    queryFn: async () => {
      const res = await axios.get('/api/fuel-racks', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      return res.data
    }
  })

  const filteredRacks = useMemo(() => {
    return racks.filter((rack: any) =>
      rack.rackName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rack.rackLocation.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [racks, searchTerm])

  return (
    <div className="flex w-full h-full overflow-hidden bg-white">
      <aside className="w-80 border-r flex flex-col shrink-0 h-full">
        <div className="p-4 border-b bg-white shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg tracking-tight">Fuel Racks</h3>
            <Link to="/fuel-management/manage/racks/new">
              <Button size="sm" variant="outline" className="h-8 px-2 gap-1 border-blue-200">
                <Plus className="h-3.5 w-3.5" />
                <span>New</span>
              </Button>
            </Link>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search racks..." 
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
              {filteredRacks.map((rack: any) => (
                <Link
                  key={rack._id}
                  to="/fuel-management/manage/racks/$id"
                  params={{ id: rack._id }}
                  activeProps={activeProps}
                  className="group flex items-center gap-3 p-4 border-b hover:bg-slate-50 transition-all"
                >
                  <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white">
                    <Warehouse className="h-5 w-5" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-semibold text-sm truncate">{rack.rackName}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{rack.rackLocation}</p>
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