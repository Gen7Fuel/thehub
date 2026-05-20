import { useState, useMemo } from 'react'
import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Plus, Search, Layers, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export const Route = createFileRoute('/_navbarLayout/cycle-count/manage/group')({
  component: GroupListLayout,
})

// Interface matching public.cycle_count_groups join structure
interface CycleCountGroup {
  id: number
  name: string
  filter_column: string
  created_at: string
  values_count?: number // Useful metadata showing how many filter values exist
}

function GroupListLayout() {
  const [searchTerm, setSearchTerm] = useState('')
  const activeProps = { className: 'border-l-4 border-primary bg-blue-50/50' }

  // Fetching the list of existing cycle count groups
  const { data: groups = [], isLoading } = useQuery<CycleCountGroup[]>({
    queryKey: ['cycle-count-groups'],
    queryFn: async () => {
      const res = await axios.get('/api/cycle-count/groups', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      return res.data
    }
  })

  // Filter groups by user typed name or filter column targets
  const filteredGroups = useMemo(() => {
    return groups.filter((group) =>
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.filter_column.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [groups, searchTerm])

  return (
    <div className="flex w-full h-full overflow-hidden bg-white">
      {/* Sidebar List Section */}
      <aside className="w-80 border-r flex flex-col shrink-0 h-full">
        <div className="p-4 border-b bg-white shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg tracking-tight">Count Groups</h3>
            <Link to="/cycle-count/manage/group/new">
              <Button size="sm" variant="outline" className="h-8 px-2 gap-1 border-blue-200">
                <Plus className="h-3.5 w-3.5" />
                <span>New</span>
              </Button>
            </Link>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search groups or columns..." 
              className="pl-9 h-9 bg-slate-50 border-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Scrollable Groups Stream */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredGroups.map((group) => (
                <Link
                  key={group.id}
                  to="/cycle-count/manage/group/$id"
                  params={{ id: String(group.id) }}
                  activeProps={activeProps}
                  className="group flex items-center gap-3 p-4 border-b hover:bg-slate-50 transition-all"
                >
                  <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-semibold text-sm truncate">{group.name}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                      Column: {group.filter_column}
                    </p>
                  </div>
                </Link>
              ))}

              {!isLoading && filteredGroups.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No groups found.
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Main Editing / Creation Section Panel */}
      <section className="flex-1 bg-white overflow-y-auto h-full">
        <Outlet />
      </section>
    </div>
  )
}