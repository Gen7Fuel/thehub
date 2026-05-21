import { useState, useMemo, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Eye, Save, X, Info, Trash2 } from 'lucide-react'
import { LocationPicker } from '@/components/custom/locationPicker'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"


export const Route = createFileRoute('/_navbarLayout/cycle-count/manage/group/$id')({
  component: EditGroupComponent,
})

interface UniqueValueItem {
  id: string;
  displayName: string;
}

interface UniqueValuesResponse {
  values: UniqueValueItem[];
  isCategory: boolean;
}

interface GroupDetailsResponse {
  id: string;
  name: string;
  filter_column: string;
  values: string[];
}

function EditGroupComponent() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Configuration States
  const [groupName, setGroupName] = useState('')
  const [selectedColumn, setSelectedColumn] = useState('')
  const [selectedValues, setSelectedValues] = useState<string[]>([])

  // Preview States
  const [previewSite, setPreviewSite] = useState('')
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Query 1: Fetch Group details by URL parameters ID
  const { data: currentGroup, isLoading: loadingGroup } = useQuery<GroupDetailsResponse>({
    queryKey: ['cycle-count-group', id],
    queryFn: async () => {
      const res = await axios.get(`/api/cycle-count/groups/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      return res.data
    }
  })

  // Sync state once server sends down existing setup values
  useEffect(() => {
    if (currentGroup) {
      setGroupName(currentGroup.name)
      setSelectedColumn(currentGroup.filter_column)
      setSelectedValues(currentGroup.values)
    }
  }, [currentGroup])

  // Query 2: Fetch unique attribute values for the fixed column
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

  const valueDisplayNameMap = useMemo(() => {
    return uniqueValues.reduce((acc, item) => {
      acc[item.id] = item.displayName
      return acc;
    }, {} as Record<string, string>)
  }, [uniqueValues])

  // Query 3: Item Preview Engine
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

  // Mutation: Save changes
  const updateGroupMutation = useMutation({
    mutationFn: async () => {
      setSubmitError(null)
      return axios.put(`/api/cycle-count/groups/${id}`, {
        name: groupName,
        values: selectedValues
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
    },
    onSuccess: () => {
      // 1. Invalidate the master list query
      queryClient.invalidateQueries({ queryKey: ['cycle-count-groups'] })

      // 2. Invalidate this specific group item query so it pulls fresh next time
      queryClient.invalidateQueries({ queryKey: ['cycle-count-group', id] })

      navigate({ to: '/cycle-count/manage/group' })
    },
    onError: (error: any) => {
      const serverMessage = error.response?.data?.message || "Failed to update group rules. Please try again."
      setSubmitError(serverMessage)
    }
  })

  // Mutation: Delete Group
  const deleteGroupMutation = useMutation({
    mutationFn: async () => {
      setSubmitError(null) // Clear any old notifications
      return axios.delete(`/api/cycle-count/groups/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle-count-groups'] })
      navigate({ to: '/cycle-count/manage/group' })
    },
    onError: (error: any) => {
      // Extract the smart error string from backend validations
      const serverMessage = error.response?.data?.message || "Failed to delete group template safely."
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

  if (loadingGroup) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="animate-spin text-muted-foreground h-8 w-8 mb-3 text-blue-600" />
        <p className="text-sm text-muted-foreground font-medium">Resolving inventory group template metadata records...</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl space-y-6 mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Modify Cycle Count Group</h2>
          <p className="text-sm text-muted-foreground">Adjust matching item scope rule parameters. The base database anchor target field cannot be altered.</p>
        </div>

        {/* Delete Trigger Block */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-1.5 shadow-sm">
              <Trash2 className="h-4 w-4" /> Delete Template
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely certain?</AlertDialogTitle>
              <AlertDialogDescription>
                This action completely breaks reference rules matching this template group. Any historic schedules saved targeting this definition will untether. This operation cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Configuration</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteGroupMutation.mutate()}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteGroupMutation.isPending ? "Removing records..." : "Confirm Removal"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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

          {/* Locked Column State Notice Block */}
          <div className="space-y-2">
            <Label className="font-medium text-sm text-slate-500">Locked Base Filter Column</Label>
            <div className="flex items-center justify-between bg-slate-100 border rounded-lg px-3 py-2 text-xs font-semibold tracking-wide text-slate-700 select-none">
              <span>{selectedColumn === 'category_id' ? 'CATEGORY' : selectedColumn.replace('_', ' ').toUpperCase()}</span>
              <span className="text-[10px] bg-slate-200/80 text-slate-500 rounded px-1.5 py-0.5 font-bold uppercase tracking-normal">Immutable</span>
            </div>
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Fetching distinct values from database repository records...
            </div>
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
            <Button variant="ghost" onClick={() => navigate({ to: '/cycle-count/manage/group' })} disabled={updateGroupMutation.isPending}>Cancel</Button>
            <Button size="sm" className="gap-1.5 h-9" onClick={() => updateGroupMutation.mutate()} disabled={!groupName || !selectedColumn || selectedValues.length === 0 || updateGroupMutation.isPending}>
              {updateGroupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Rule Changes
            </Button>
          </div>
        </div>

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