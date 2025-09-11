import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Save, ChevronLeft, ChevronRight } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { toUTC } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'

export const Route = createFileRoute('/_navbarLayout/cycle-count/entry/$id')({
  component: RouteComponent,
})

interface CycleItem {
  _id: string
  upc: string
  name: string
  category: string
  grade: string
  foh: number
  boh: number
}

interface CycleDay {
  date: string
  completed: boolean
}

interface Cycle {
  _id: string
  site: string
  startDate: string
  completed?: boolean
  days: CycleDay[]
  items: CycleItem[]
}

function groupItemsByCategory(items: CycleItem[]) {
  const grouped: Record<string, CycleItem[]> = {}
  items.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = []
    grouped[item.category].push(item)
  })
  return grouped
}

function RouteComponent() {
  const { id } = useParams({ from: '/_navbarLayout/cycle-count/entry/$id' })
  const [cycle, setCycle] = useState<Cycle | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editedItems, setEditedItems] = useState<CycleItem[]>([])
  const [page, setPage] = useState(0)

  // Fetch cycle and items
  const fetchCycle = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/cycle-counts/cycles/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setCycle(data)
        setEditedItems(data.items.map((item: CycleItem) => ({
          ...item,
          foh: item.foh === 0 ? '' : item.foh,
          boh: item.boh === 0 ? '' : item.boh,
        })))
      } else {
        toast.error('Failed to load cycle')
      }
    } catch (error) {
      toast.error('Failed to load cycle')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCycle()
    // eslint-disable-next-line
  }, [id])

  useEffect(() => {
    if (!cycle) return;

    // Convert startDate and today to UTC midnight
    const start = toUTC(new Date(cycle.startDate));
    start.setUTCHours(0, 0, 0, 0);

    const today = toUTC(new Date());
    today.setUTCHours(0, 0, 0, 0);

    // Helper to skip weekends
    function getCyclePageForDate(startUTC: Date, targetUTC: Date) {
      let page = 0;
      let current = new Date(startUTC);

      if (targetUTC <= current) return 0;

      while (current < targetUTC) {
        current.setUTCDate(current.getUTCDate() + 1);
        if (current.getUTCDay() !== 0 && current.getUTCDay() !== 6) {
          page++;
        }
      }
      return page;
    }

    if (today > start) {
      const newPage = getCyclePageForDate(start, today);
      if (newPage < totalPages) setPage(newPage);
    }
    // eslint-disable-next-line
  }, [cycle]);

  // Pagination logic
  const itemsPerPage = 30
  const totalPages = editedItems.length ? Math.ceil(editedItems.length / itemsPerPage) : 1
  const currentItems = editedItems.slice(page * itemsPerPage, (page + 1) * itemsPerPage)
  const groupedItems = groupItemsByCategory(currentItems)

  // Calculate current date for the page
  function getPageDate() {
    if (!cycle) return '';
    const start = new Date(cycle.startDate);
    let daysAdded = 0;
    let currentDate = new Date(start);

    while (daysAdded < page) {
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      if (currentDate.getUTCDay() !== 0 && currentDate.getUTCDay() !== 6) {
        daysAdded++;
      }
    }
    // Format as YYYY-MM-DD in UTC
    return currentDate.toISOString().slice(0, 10);
  }

  const handleInputChange = (itemId: string, field: 'foh' | 'boh', value: string) => {
    setEditedItems(items =>
      items.map(item =>
        item._id === itemId
          ? { ...item, [field]: value === '' ? '' : Math.max(0, Number(value.replace(/[^0-9]/g, ''))) }
          : item
      )
    )
  }

  const handleSave = async () => {
    if (!cycle) return
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const itemsToSave = editedItems.map(item => ({
        ...item,
        foh: String(item.foh) === '' ? 0 : Number(item.foh),
        boh: String(item.boh) === '' ? 0 : Number(item.boh),
      }));
      const response = await fetch(`/api/cycle-counts/cycles/${id}/items`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ items: itemsToSave })
      })
      if (response.ok) {
        toast.success('Counts saved successfully!')
        fetchCycle()
      } else {
        toast.error('Failed to save counts')
      }
    } catch (error) {
      toast.error('Failed to save counts')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="pt-16 container mx-auto p-6">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-muted-foreground">Loading cycle...</p>
        </div>
      </div>
    )
  }

  if (!cycle) {
    return (
      <div className="pt-16 container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="mt-4 text-lg font-semibold">Cycle not found</h3>
            <Button asChild className="mt-4">
              <Link to="/cycle-count/list">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to List
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="pt-16 container mx-auto p-6 max-w-5xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" asChild>
            <Link to="/cycle-count/list">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{cycle.site}</h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              Start: {new Date(cycle.startDate).toLocaleDateString('en-CA', { timeZone: 'UTC' })}
            </p>
          </div>
        </div>
        <Badge variant={cycle.completed ? 'default' : 'secondary'}>
          {cycle.completed ? 'Completed' : 'Active'}
        </Badge>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <span className="font-semibold">Day {page + 1} ({getPageDate()})</span>
          <span className="ml-4 text-muted-foreground">
            Showing items {page * itemsPerPage + 1} - {Math.min((page + 1) * itemsPerPage, editedItems.length)} of {editedItems.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={!!cycle.days?.[page]?.completed}
            onCheckedChange={async (checked) => {
              const token = localStorage.getItem("token");
              try {
                const res = await fetch(
                  `/api/cycle-counts/cycles/${cycle._id}/day/${page}/complete`,
                  {
                    method: "PUT",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ completed: checked }),
                  }
                );
                if (res.ok) {
                  // Optionally update local state for instant UI feedback
                  setCycle((prev) =>
                    prev
                      ? {
                          ...prev,
                          days: prev.days.map((d, i) =>
                            i === page ? { ...d, completed: checked } : d
                          ),
                        }
                      : prev
                  );
                }
              } catch (err) {
                // handle error (toast, etc.)
              }
            }}
            disabled={cycle.completed}
            id="day-complete-switch"
            className="data-[state=checked]:bg-green-500 relative"
          />
          <label htmlFor="day-complete-switch" className="ml-2">
            Mark this day as completed
          </label>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous Day
          </Button>
          <Button
            variant="outline"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
          >
            Next Day
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <Button
            className="ml-auto"
            onClick={handleSave}
            disabled={saving || cycle.completed}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Counts'}
          </Button>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedItems).length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No items found for this page.</div>
          ) : (
            Object.entries(groupedItems).map(([category, items]) => (
              <div key={category} className="mb-8">
                <h3 className="text-lg font-semibold mb-2">{category}</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full border">
                    <thead>
                      <tr>
                        <th className="p-2 border">Item Name</th>
                        <th className="p-2 border">UPC</th>
                        {/* <th className="p-2 border">Grade</th> */}
                        <th className="p-2 border">BOH</th>
                        <th className="p-2 border">FOH</th>
                        <th className="p-2 border">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item._id || item.upc}>
                          <td className="p-2 border">{item.name}</td>
                          <td className="p-2 border">{item.upc}</td>
                          {/* <td className="p-2 border">{item.grade}</td> */}
                          <td className="p-2 border">
                            <input
                              type="number"
                              min={0}
                              className="w-20 border rounded px-2 py-1"
                              value={item.boh}
                              onChange={e => handleInputChange(item._id, 'boh', e.target.value)}
                              onFocus={e => {
                                // Saving the current value in localStorage before clearing
                                localStorage.setItem(`boh-${item._id}`, e.target.value);
                                e.target.value = ''; // clearing the box
                              }}
                              onBlur={e => {
                                if (e.target.value === '') {
                                  // If nothing entered, restoring the old value from localStorage
                                  const oldValue = localStorage.getItem(`boh-${item._id}`);
                                  if (oldValue !== null) {
                                    handleInputChange(item._id, 'boh', oldValue);
                                  }
                                } else {
                                  // If the value changes to something new, persist it
                                  handleInputChange(item._id, 'boh', e.target.value);
                                }
                              }}
                              disabled={cycle.completed}
                            />
                          </td>
                          <td className="p-2 border">
                            <input
                              type="number"
                              min={0}
                              className="w-20 border rounded px-2 py-1"
                              value={item.foh}
                              onChange={e => handleInputChange(item._id, 'foh', e.target.value)}
                              onFocus={e => {
                                // Saving the current value in localStorage before clearing
                                localStorage.setItem(`foh-${item._id}`, e.target.value);
                                e.target.value = ''; // clearing the box
                              }}
                              onBlur={e => {
                                if (e.target.value === '') {
                                  // If nothing entered, restoring the old value from localStorage
                                  const oldValue = localStorage.getItem(`foh-${item._id}`);
                                  if (oldValue !== null) {
                                    handleInputChange(item._id, 'foh', oldValue);
                                  }
                                } else {
                                  // If the value changes to something new, persist it
                                  handleInputChange(item._id, 'foh', e.target.value);
                                }
                              }}
                              disabled={cycle.completed}
                            />
                          </td>
                          <td className="p-2 border font-semibold">
                            {(Number(item.foh) || 0) + (Number(item.boh) || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
          <Button
            className="mt-6"
            onClick={handleSave}
            disabled={saving || cycle.completed}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Counts'}
          </Button>
        </CardContent>
      </Card>
      <Toaster richColors position="top-center" />
    </div>
  )
}