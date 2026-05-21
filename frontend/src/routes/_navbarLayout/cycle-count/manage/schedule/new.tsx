import { useState, useMemo, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Calendar, Eye, Loader2, Save, X, AlertTriangle, Layers, MapPin } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useSite } from '@/context/SiteContext'

export const Route = createFileRoute('/_navbarLayout/cycle-count/manage/schedule/new')({
  component: CreateScheduleView,
})

interface GroupWithRules {
  id: number
  name: string
  filter_column: string
  allowedValues: string[]
}

function CreateScheduleView() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { selectedSite } = useSite() // Sync location dynamic context safely

  // Form State Values
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false)

  // Auto calculated day mapping expression
  const calculatedDayString = useMemo(() => {
    if (!selectedDate) return ''
    // Append time component safely to prevent native local date timezone offsets parsing issues
    const parts = selectedDate.split('-')
    const parsedDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
    return parsedDate.toLocaleDateString('en-US', { weekday: 'long' })
  }, [selectedDate])

  // Query A: Perform soft date clash confirmation hook 
  const { data: dateCheck, isLoading: checkingDate } = useQuery({
    queryKey: ['date-clash-check', selectedSite, selectedDate],
    queryFn: async () => {
      if (!selectedSite || !selectedDate) return { alreadyExists: false }
      const res = await axios.get('/api/cycle-count/schedules/check-date', {
        params: { site: selectedSite, date: selectedDate },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      return res.data as { alreadyExists: boolean }
    },
    enabled: !!selectedSite && !!selectedDate
  })

  // Query B: Fetch configuration patterns and structural rule targets
  const { data: rulesData, isLoading: loadingRules } = useQuery<{ groups: GroupWithRules[] }>({
    queryKey: ['active-rule-definitions'],
    queryFn: async () => {
      const res = await axios.get('/api/cycle-count/groups/active-rules', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      return res.data
    }
  })

  const rulesList = rulesData?.groups || []

  // Resolve current actively specified dynamic condition object model tracking configurations
  const activeSelectedGroupModel = useMemo(() => {
    return rulesList.find(g => String(g.id) === selectedGroupId)
  }, [selectedGroupId, rulesList])

  // Query C: Simulated inventory asset validation loop engine
  const { data: previewData, isLoading: loadingPreview, refetch: executeLiveFetch } = useQuery({
    queryKey: ['item-bk-preview', selectedSite, activeSelectedGroupModel?.filter_column, activeSelectedGroupModel?.allowedValues],
    queryFn: async () => {
      if (!selectedSite || !activeSelectedGroupModel) return { items: [], totalCount: 0 }
      const res = await axios.get('/api/cycle-count/groups/preview-items', {
        params: {
          site: selectedSite,
          column: activeSelectedGroupModel.filter_column,
          values: activeSelectedGroupModel.allowedValues.join(',')
        },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      return res.data as { items: any[]; totalCount: number }
    },
    enabled: false
  })

  const previewItems = previewData?.items || []
  const totalCount = previewData?.totalCount || 0

  // Fire live sync actions hook wrapper execution
  const handleTogglePreviewPanel = () => {
    if (!isPreviewExpanded) {
      executeLiveFetch()
    }
    setIsPreviewExpanded(!isPreviewExpanded)
  }

  // Clear preview block instantly if active configuration patterns alternate
  useEffect(() => {
    setIsPreviewExpanded(false)
  }, [selectedGroupId, selectedDate, selectedSite])

  // Mutation Pipeline: Post configuration payload blocks safely inside transaction sandbox
  const createScheduleMutation = useMutation({
    mutationFn: async () => {
      if (!activeSelectedGroupModel) return
      const payload = {
        site: selectedSite,
        date: selectedDate,
        day: calculatedDayString,
        groupId: activeSelectedGroupModel.id,
        filterColumn: activeSelectedGroupModel.filter_column,
        filterValues: activeSelectedGroupModel.allowedValues
      }
      const res = await axios.post('/api/cycle-count/schedules/create', payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cycle-count-instances'] })
      if (data?.instanceId) {
        navigate({ to: '/cycle-count/manage/schedule/$id', params: { id: String(data.instanceId) } })
      } else {
        navigate({ to: '/cycle-count/manage/schedule' })
      }
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || "Pipeline execution failure saving structural records.")
    }
  })

  const isFormDateInvalid = dateCheck?.alreadyExists || !selectedDate

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Sticky Top Information Bar Context */}
      <div className="flex items-center justify-between border bg-gradient-to-r from-blue-50/50 to-indigo-50/30 p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-widest text-blue-600 uppercase block">Site</span>
            <h2 className="text-base font-bold text-slate-800">{selectedSite || "No Station Picked"}</h2>
          </div>
        </div>
        <Badge variant="outline" className="bg-white px-3 py-1 font-semibold border-slate-200">
          Drafting Configuration Node
        </Badge>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl font-bold tracking-tight">Create Inventory Schedule</CardTitle>
          <CardDescription>
            Provision a live operational tracking checklist context down to specific item categories.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Row A: Target Date Setup */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Target Count Date</label>
              <div className="relative">
                <Input
                  type="date"
                  className={`h-10 focus-visible:ring-1 ${dateCheck?.alreadyExists ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Day of Week</label>
              <Input
                type="text"
                readOnly
                placeholder="Awaiting valid calendar entry..."
                className="h-10 bg-slate-50 font-medium text-slate-600 border-slate-200"
                value={calculatedDayString}
              />
            </div>
          </div>

          {/* Explicit Clash Warning Alert Block Box */}
          {dateCheck?.alreadyExists && (
            <Alert variant="destructive" className="bg-rose-50 border-rose-200 text-rose-900 rounded-xl">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <AlertTitle className="font-bold text-sm text-rose-800">Duplicate Schedule Collision</AlertTitle>
              <AlertDescription className="text-xs text-rose-700 font-medium mt-0.5">
                The location context <strong>{selectedSite}</strong> already maps to a locked cycle record configuration on {selectedDate}. Please select an alternate operational date or update the existing snapshot records instead.
              </AlertDescription>
            </Alert>
          )}

          {/* Row B: Assign Count Filter Group Template */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Target Group Specification</label>
            {loadingRules ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 border rounded-md bg-slate-50">
                <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading live matching template components...
              </div>
            ) : (
              <select
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                disabled={isFormDateInvalid}
              >
                <option value="">-- Choose matching master filter context group --</option>
                {rulesList.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Dynamic Condition Block Visibility Extension */}
          {activeSelectedGroupModel && (
            <div className="p-4 border rounded-xl bg-slate-50/50 space-y-3 animation-fade-in">
              <div className="flex items-center gap-2 text-slate-700">
                <Layers className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Target Evaluation Rule: <span className="font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{activeSelectedGroupModel.filter_column}</span>
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {activeSelectedGroupModel.allowedValues.map((val, idx) => (
                  <Badge key={idx} variant="secondary" className="bg-white border text-slate-600 font-medium font-mono text-[11px] px-2 py-0.5 shadow-none">
                    {val}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Interactive Workflow Panel Footer Row */}
          <div className="flex items-center justify-between border-t pt-4 mt-6">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-1.5 h-9"
              onClick={handleTogglePreviewPanel}
              disabled={isFormDateInvalid || !selectedGroupId || loadingPreview}
            >
              {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              {isPreviewExpanded ? "Collapse Snapshot View" : "Preview Setup Match"}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-9"
                onClick={() => navigate({ to: '/cycle-count/manage/schedule' })}
                disabled={createScheduleMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="gap-1.5 h-9"
                onClick={() => createScheduleMutation.mutate()}
                disabled={isFormDateInvalid || !selectedGroupId || createScheduleMutation.isPending}
              >
                {createScheduleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lock In Schedule
              </Button>
            </div>
          </div>

          {/* Live Evaluated Item Stream Block */}
          {isPreviewExpanded && (
            <div className="border rounded-xl overflow-hidden bg-slate-50/30 animation-slide-up mt-4">
              <div className="px-4 py-3 border-b bg-slate-100/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-700 block">
                    Simulated Evaluation context for {selectedSite}
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    This selection targets <span className="font-bold text-slate-900">{totalCount.toLocaleString()}</span> live SKU instances in the active database.
                  </p>
                </div>

                <span className="text-xs bg-white border px-2.5 py-0.5 rounded-full font-medium text-slate-600 shrink-0">
                  {totalCount > 200 ? "Showing top 200 records cap" : `Showing all ${previewItems.length} matching rows`}
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto">
                {previewItems.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">No records currently map to your parameters inside this location snapshot dataset.</div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-white sticky top-0 border-b text-muted-foreground uppercase font-bold tracking-wider z-10">
                      <tr>
                        <th className="p-2.5 pl-4">UPC / SKU</th>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5">Category Match</th>
                        <th className="p-2.5 pr-4 text-right">On Hand</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-white">
                      {previewItems.map((item: any) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2.5 pl-4 font-mono font-medium text-slate-700">{item.upc_barcode}</td>
                          <td className="p-2.5 truncate max-w-[240px]" title={item.description}>{item.description}</td>
                          <td className="p-2.5 text-muted-foreground truncate max-w-[150px]">{item.categoryName}</td>
                          <td className="p-2.5 pr-4 text-right font-mono text-slate-600">{Number(item.on_hand_qty || 0).toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  )
}