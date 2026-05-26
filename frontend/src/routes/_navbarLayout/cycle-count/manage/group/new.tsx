import { useState, useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Eye, Save, X, Info } from 'lucide-react'
import { LocationPicker } from '@/components/custom/locationPicker'

export const Route = createFileRoute('/_navbarLayout/cycle-count/manage/group/new')({
  component: NewGroupComponent,
})

interface UniqueValueItem {
  id: string;
  displayName: string;
}

interface UniqueValuesResponse {
  values: UniqueValueItem[];
  isCategory: boolean;
}

function NewGroupComponent() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Core Configuration States
  const [groupName, setGroupName] = useState('')
  const [selectedColumn, setSelectedColumn] = useState('')
  const [selectedValues, setSelectedValues] = useState<string[]>([]) // Always holds raw db IDs/strings

  // Location States
  const [previewSite, setPreviewSite] = useState('')
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false)

  const [submitError, setSubmitError] = useState<string | null>(null)

  // Query 1: Fetch list of filterable columns
  const { data: rawColumns, isLoading: loadingCols } = useQuery({
    queryKey: ['filterable-columns'],
    queryFn: async () => {
      const res = await axios.get('/api/cycle-count/groups/filterable-columns', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      return res.data.columns as string[]
    }
  })

  // Frontend hard Filter & Ordering Definition
  const allowedColumns = useMemo(() => {
    if (!rawColumns) return []
    const targets = ['vendor_name', 'category_id', 'department', 'price_group', 'promo_group', 'grade']
    return rawColumns.filter(col => targets.includes(col))
  }, [rawColumns])

  // Query 2: Fetch unique attribute values safely
  const { data: uniqueData, isLoading: loadingValues } = useQuery<UniqueValuesResponse>({
    queryKey: ['unique-values', selectedColumn],
    queryFn: async () => {
      if (!selectedColumn) return { values: [], isCategory: false }
      const res = await axios.get(`/api/cycle-count/groups/unique-values?column=${selectedColumn}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      return res.data as UniqueValuesResponse
    },
    enabled: !!selectedColumn
  })

  const uniqueValues = uniqueData?.values || []

  // Create a quick lookup map to resolve ID to Display Name in Badges cleanly
  const valueDisplayNameMap = useMemo(() => {
    return uniqueValues.reduce((acc, item) => {
      acc[item.id] = item.displayName
      return acc;
    }, {} as Record<string, string>)
  }, [uniqueValues])

  // Query 3: Item Preview Engine
  // Update Query 3 to handle the new object layout structure
  const { data: previewData, isLoading: loadingPreview, refetch: triggerPreviewFetch } = useQuery({
    queryKey: ['item-bk-preview', previewSite, selectedColumn, selectedValues],
    queryFn: async () => {
      if (!previewSite || !selectedColumn) return { items: [], totalCount: 0 }

      const res = await axios.get('/api/cycle-count/groups/preview-items', {
        params: {
          site: previewSite,
          column: selectedColumn,
          values: selectedValues.join(',')
        },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      return res.data as { items: any[]; totalCount: number }
    },
    enabled: false
  })

  const previewItems = previewData?.items || []
  const totalCount = previewData?.totalCount || 0

  const createGroupMutation = useMutation({
    mutationFn: async () => {
      setSubmitError(null) // Reset error state on new attempt
      return axios.post('/api/cycle-count/groups', {
        name: groupName,
        filter_column: selectedColumn,
        values: selectedValues
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle-count-groups'] })
      navigate({ to: '/cycle-count/manage/group' })
    },
    onError: (error: any) => {
      // Extract server message if it exists, fallback to standard error text
      const serverMessage = error.response?.data?.message || "Failed to create group template. Please try again."
      setSubmitError(serverMessage)
    }
  })

  const toggleValueOption = (valueId: string) => {
    setSelectedValues(prev =>
      prev.includes(valueId) ? prev.filter(v => v !== valueId) : [...prev, valueId]
    )
  }

  const handlePreviewRequest = () => {
    if (!previewSite) return
    setIsPreviewExpanded(true)
    setTimeout(() => { triggerPreviewFetch() }, 50)
  }

  return (
    <div className="p-6 max-w-4xl space-y-6 mx-auto">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Create Cycle Count Group</h2>
        <p className="text-sm text-muted-foreground">Isolate custom dynamic groups of inventory items to streamline cycles.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-6 border rounded-xl">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name" className="font-medium text-sm">Group Name</Label>
            <Input
              id="group-name"
              placeholder="e.g., High Margin Carbonated Beverages"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="bg-white"
            />
          </div>
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-800 animate-in fade-in-50 duration-200">
              <div className="p-1 bg-red-100 rounded-md text-red-600 mt-0.5">
                <X className="h-4 w-4 cursor-pointer" onClick={() => setSubmitError(null)} />
              </div>
              <div className="space-y-1">
                <h5 className="text-sm font-semibold tracking-tight">Configuration Error</h5>
                <p className="text-xs text-red-700/90 leading-relaxed">{submitError}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="font-medium text-sm">Filter Target Column</Label>
            <Select
              value={selectedColumn}
              onValueChange={(val) => {
                setSelectedColumn(val)
                setSelectedValues([])
                setIsPreviewExpanded(false)
              }}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder={loadingCols ? "Loading columns..." : "Select dynamic item field"} />
              </SelectTrigger>
              <SelectContent>
                {allowedColumns.map(col => (
                  <SelectItem key={col} value={col}>
                    {col === 'category_id' ? 'CATEGORY' : col.replace('_', ' ').toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2 flex flex-col h-full">
          <Label className="font-medium text-sm">Selected Filtering Rules</Label>
          <div className="flex-1 bg-white border rounded-md p-3 min-h-[110px] overflow-y-auto max-h-[160px] flex flex-wrap gap-1.5 align-top content-start">
            {selectedValues.length === 0 ? (
              <span className="text-xs text-muted-foreground self-center mx-auto flex items-center gap-1">
                <Info className="h-3.5 w-3.5" /> Select multi-values below to build scope
              </span>
            ) : (
              selectedValues.map(valId => (
                <Badge key={valId} variant="secondary" className="gap-1 text-xs h-6 pl-2 pr-1 bg-slate-100">
                  {valueDisplayNameMap[valId] || valId}
                  <X className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-black" onClick={() => toggleValueOption(valId)} />
                </Badge>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedColumn && (
        <div className="border rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center border-b pb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Available targets ({uniqueValues.length})
            </span>
            {selectedValues.length > 0 && (
              <Button variant="ghost" onClick={() => setSelectedValues([])} className="text-xs text-red-500 hover:bg-red-50 h-6 px-2">Clear Selections</Button>
            )}
          </div>

          {loadingValues ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 className="h-4 w-4 animate-spin" /> Fetching distinct values from database repository records...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-48 overflow-y-auto p-1 custom-scrollbar">
              {uniqueValues.map(item => {
                const isChecked = selectedValues.includes(item.id);
                return (
                  <label key={item.id} className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer text-xs select-none transition-all ${isChecked ? 'bg-blue-50/50 border-blue-400 font-medium' : 'hover:bg-slate-50 bg-white'}`}>
                    <Checkbox checked={isChecked} onCheckedChange={() => toggleValueOption(item.id)} />
                    <span className="truncate" title={item.displayName}>{item.displayName}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Execution Layer with integrated LocationPicker */}
      <div className="border-t pt-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="w-64 space-y-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Active Site</label>
            <LocationPicker setStationName={setPreviewSite} value="stationName" defaultValue={previewSite} />
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" className="gap-1.5 h-9" onClick={handlePreviewRequest} disabled={!previewSite || !selectedColumn}>
              <Eye className="h-4 w-4" /> Preview Setup Match
            </Button>
            <Button variant="ghost" onClick={() => navigate({ to: '/cycle-count/manage/group' })} disabled={createGroupMutation.isPending}>Cancel</Button>
            <Button size="sm" className="gap-1.5 h-9" onClick={() => createGroupMutation.mutate()} disabled={!groupName || !selectedColumn || selectedValues.length === 0 || createGroupMutation.isPending}>
              {createGroupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Group Template
            </Button>
          </div>
        </div>

        {/* Live Evaluated Item Stream Block */}
        {/* Live Evaluated Item Stream Block */}
        {isPreviewExpanded && (
          <div className="border rounded-xl overflow-hidden bg-slate-50/30">
            <div className="px-4 py-3 border-b bg-slate-100/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-700 block">
                  Simulated Server-Side Evaluation for {previewSite}
                </span>
                <p className="text-[11px] text-muted-foreground">
                  This template rule currently maps to <span className="font-semibold text-slate-900">{totalCount.toLocaleString()}</span> total item records in this location's live database inventory.
                </p>
              </div>

              <div className="flex items-center">
                <span className="text-xs bg-white border border-slate-200 shadow-sm px-2.5 py-1 rounded-full font-medium text-slate-600">
                  {totalCount > 200 ? (
                    <span>Showing top <strong className="text-blue-600">200</strong> records</span>
                  ) : (
                    <span>Showing all <strong className="text-emerald-600">{previewItems.length}</strong> records</span>
                  )}
                </span>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {loadingPreview ? (
                <div className="p-12 text-center">
                  <Loader2 className="animate-spin mx-auto text-muted-foreground h-6 w-6 mb-2" />
                  <p className="text-xs text-muted-foreground">Analyzing inventory snapshots...</p>
                </div>
              ) : previewItems.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No records currently match your filters inside this station inventory dataset.</div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-white sticky top-0 border-b shadow-sm text-muted-foreground uppercase font-bold tracking-wider z-10">
                    <tr>
                      <th className="p-2.5 pl-4">UPC / SKU</th>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5">Category Match</th>
                      <th className="p-2.5">{selectedColumn.replace('_', ' ').toUpperCase()}</th>
                      <th className="p-2.5 pr-4 text-right">On Hand</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {previewItems.map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 pl-4 font-mono font-medium text-slate-700">{item.upc_barcode}</td>
                        <td className="p-2.5 truncate max-w-[220px]" title={item.description}>{item.description}</td>
                        <td className="p-2.5 text-muted-foreground truncate max-w-[150px]">{item.categoryName}</td>
                        <td className="p-2.5">
                          <Badge variant="outline" className="bg-slate-50 font-normal">
                            {String(item[selectedColumn])}
                          </Badge>
                        </td>
                        <td className="p-2.5 pr-4 text-right font-mono text-slate-600">{Number(item.on_hand_qty || 0).toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}