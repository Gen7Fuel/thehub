import { memo, useMemo, useState, useEffect } from 'react'
import React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ChevronDown,
  ChevronRight,
  ImageIcon,
  Barcode as BarcodeIcon,
  Plus,
  Trash2,
  Clock,
  User,
  Search,
  X,
  AlertTriangle,
  Check,
  Star,
  Layers,
  XCircle,
  CheckCircle
} from 'lucide-react'
import Barcode from 'react-barcode'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Dialog, DialogContent } from '@/components/ui/dialog' // Adjust import path to your project rules

export const Route = createFileRoute(
  '/_navbarLayout/cycle-count/manage/schedule/$id',
)({
  component: RouteComponent,
})

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
})

// Sample style mappings copied from your Item Book reference code
const gradeStyles: Record<string, string> = {
  A: 'bg-blue-50/10 hover:bg-blue-50/40',
  B: 'bg-amber-50/10 hover:bg-amber-50/40',
  C: 'bg-green-50/10 hover:bg-green-50/40',
}
const badgeGradeStyles: Record<string, string> = {
  A: 'bg-blue-50 border-blue-200 text-blue-700',
  B: 'bg-amber-50 border-amber-200 text-amber-700',
  C: 'bg-green-50 border-green-200 text-green-700',
}

interface ItemRowProps {
  item: CycleCountItemCombined;
  isLive: boolean; // Added structural context mapping prop
  isHistorical: boolean; // Added structural context mapping prop
  isSelected: boolean;
  onToggle: (id: number) => void;
  onOpenBarcode: (name: string, upc: string, image: string | null) => void;
}

/* --- HIGH PERFORMANCE ISOLATED ITEM ROW --- */
const ItemRow = memo(({
  item,
  isLive,
  isHistorical,
  isSelected,
  onToggle,
  onOpenBarcode
}: ItemRowProps) => {
  const qty = Number(item.on_hand_qty || 0);
  const isCriticalQty = qty <= 0;

  const baseGradeClass = gradeStyles[item.grade] || (isCriticalQty ? 'bg-rose-50/40 hover:bg-rose-50' : 'hover:bg-gray-50')
  const gradeClass = isSelected && !isLive && !isHistorical ? '!bg-primary/5 transition-colors' : baseGradeClass

  // Left identity borders are assigned directly to the image container if checkboxes are missing
  const borderClass = item.grade === 'A'
    ? 'border-l-4 border-l-blue-500'
    : item.grade === 'B'
      ? 'border-l-4 border-l-amber-500'
      : item.grade === 'C'
        ? 'border-l-4 border-l-green-500'
        : isCriticalQty
          ? 'border-l-4 border-l-rose-400'
          : ''

  const barcode = item.upc_barcode || item.upc || "NO UPC"
  const showCheckbox = !isLive && !isHistorical;

  return (
    <tr className={`${gradeClass} ${isCriticalQty ? 'ring-1 ring-rose-100 ring-inset' : ''} group`}>

      {/* 1. SELECTION CHECKBOX CONTAINER (Removed fixed inline width) */}
      {showCheckbox && (
        <td className={`p-3 text-center align-middle transition-colors ${borderClass} group-hover:bg-gray-100/50`}>
          <input
            type="checkbox"
            className="rounded accent-primary cursor-pointer h-4 w-4"
            checked={isSelected}
            onChange={() => onToggle(item.product_id)}
          />
        </td>
      )}

      {/* 2. LOGISTICS IMAGE (Removed fixed inline width, safely inherits master layout slot) */}
      <td className={`p-2 align-middle text-center transition-colors ${!showCheckbox ? borderClass : ''} group-hover:bg-gray-100/50`}>
        <div className="w-9 h-9 rounded-lg bg-gray-100/60 flex-shrink-0 overflow-hidden border border-gray-200/80 mx-auto">
          {item.image_url ? (
            <img src={item.image_url} alt={item.description} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <ImageIcon className="w-4 h-4 opacity-30" />
            </div>
          )}
        </div>
      </td>

      {/* 3. INTERACTIVE UPC MONO DIALOG (Removed fixed inline width) */}
      <td className="p-3 font-mono text-xs align-middle transition-colors group-hover:bg-gray-100/50">
        <button
          type="button"
          onClick={() => onOpenBarcode(item.description, barcode, item.image_url)}
          className="flex items-center gap-1 text-xs font-mono text-blue-600 hover:bg-blue-100/50 px-1.5 py-0.5 rounded transition-colors text-left truncate w-full"
        >
          <BarcodeIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="font-bold truncate">{barcode}</span>
        </button>
      </td>

      {/* 4. COMPACT DESCRIPTION COLUMN (Removed fixed inline width, relies on table tracking layout) */}
      <td className="p-3 text-left font-medium text-gray-900 align-middle transition-colors group-hover:bg-gray-100/50" title={item.description}>
        <div className="line-clamp-2 text-xs leading-tight break-words font-medium">
          {item.description}
        </div>
      </td>

      {/* 5. ON HAND QUANTITY (Removed fixed inline width) */}
      <td className="p-3 font-mono align-middle text-right pr-4">
        <div className="flex items-center justify-end gap-1.5">
          {isCriticalQty && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
          )}
          <span className={isCriticalQty ? 'text-rose-600 font-extrabold text-sm tracking-tight' : 'text-xs text-gray-900 font-bold'}>
            {qty.toFixed(2)}
          </span>
        </div>
      </td>

      {/* 6. GRADE BADGE (Removed fixed inline width) */}
      <td className="p-3 align-middle pl-5">
        <span className={`px-2 py-0.5 rounded text-xs font-bold border shadow-sm whitespace-nowrap tracking-wide ${badgeGradeStyles[item.grade] || 'bg-white border-gray-200'}`}>
          Grade {item.grade || '—'}
        </span>
      </td>

      {/* 7. PROGRESS STATUS COLUMN (Removed fixed inline width) */}
      <td className="p-3 align-middle text-center">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${item.count_completed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {item.count_completed ? 'Completed' : 'Pending'}
        </span>
      </td>
    </tr>
  )
})
ItemRow.displayName = 'ItemRow'

// Define explicit typings matching your database aggregation payloads
interface CycleCountItemCombined {
  product_id: number
  cycle_count_item_id: number
  description: string
  upc: string
  upc_barcode: string | null
  priority: boolean
  image_url: string | null
  on_hand_qty: number
  grade: string
  category_id: number
  categoryName: string
  count_completed: boolean
  foh: number
  boh: number
}

interface ScheduleInstancePayload {
  instanceData: {
    id: number
    date: string
    day: string
    is_scheduled: boolean
    scheduled_by: string | null
    site_mongo_id: string
    updated_by: string | null
  }
  stationTimezone: string
  itemsData: CycleCountItemCombined[]
}

/* --- PRIMARY ROUTE VIEW COMPONENT --- */
function RouteComponent() {
  const { id } = Route.useParams()
  const queryClient = useQueryClient()

  // --- STATE FOR INTERACTION MANAGEMENTS ---
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})
  const [activeBarcodeItem, setActiveBarcodeItem] = useState<{ name: string; upc: string; image: string | null } | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery<ScheduleInstancePayload>({
    queryKey: ['cycleCountInstanceDetails', id],
    queryFn: async () => {
      // Retrieve the token from localStorage right when the request fires
      const token = localStorage.getItem('token') // Change 'token' to your actual storage key

      const response = await axios.get(`/api/cycle-count/schedules/details/${id}`, {
        headers: {
          // Attach the token as a standard Bearer header
          Authorization: token ? `Bearer ${token}` : '',
        }
      })
      return response.data
    },
    enabled: !!id,
  })

  // Extract variables with robust safe fallback states during fetch intervals
  const instanceData = data?.instanceData
  const stationTimezone = data?.stationTimezone || 'America/New_York'
  const itemsData = data?.itemsData || []

  // --- TIMEZONE, LIVE, AND HISTORICAL STATE LOGIC ---
  const { isLive, isHistorical, badgeText, subStatusText } = useMemo(() => {
    if (!instanceData) {
      return { isLive: false, isHistorical: false, badgeText: 'Loading...', subStatusText: '' }
    }

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: stationTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    const todayStr = formatter.format(new Date()) // Format results in 'YYYY-MM-DD'

    const totalItems = itemsData.length
    const completedItems = itemsData.filter(i => i.count_completed).length
    const remainingItems = totalItems - completedItems

    if (instanceData.date === todayStr) {
      return {
        isLive: true,
        isHistorical: false,
        badgeText: 'Currently Live',
        subStatusText: `${completedItems} done, ${remainingItems} remaining`
      }
    } else {
      const instanceDate = new Date(`${instanceData.date}T00:00:00`)
      const todayDate = new Date(`${todayStr}T00:00:00`)
      const diffTime = instanceDate.getTime() - todayDate.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      // If diffDays is less than 0, it means the calendar date is entirely in the past
      const historicalFlag = diffDays < 0;

      return {
        isLive: false,
        isHistorical: historicalFlag,
        badgeText: historicalFlag ? 'Schedule Completed' : 'Upcoming',
        subStatusText: historicalFlag
          ? `Archived • Completed ${completedItems}/${totalItems} items`
          : (diffDays > 0 ? `Starts in ${diffDays} day${diffDays > 1 ? 's' : ''}` : 'Scheduled past date')
      }
    }
  }, [instanceData, itemsData, stationTimezone])

  // --- BUSINESS LOGIC LIMIT CHECKS FOR MUTATION BUTTONS ---
  const isInstanceScheduled = instanceData?.is_scheduled ?? false
  const totalItemCount = itemsData.length

  const canAddItem = isInstanceScheduled || (!isInstanceScheduled && totalItemCount < 20)
  const isDeleteActive = selectedIds.length > 0

  // --- CATEGORIZED RECORD GROUPING ---
  const groupedItems = useMemo(() => {
    // Explicitly tell TypeScript that keys are strings and values are arrays of your Item type
    const groups: Record<string, typeof itemsData> = {};

    // 1. Initialize the Priority List container safely at the absolute top
    groups["Priority List"] = [];

    itemsData.forEach((item) => {
      if (item.priority) {
        // Send priority items directly to the top group
        groups["Priority List"].push(item);
      } else {
        // Group regular items by their category names
        const catName = item.categoryName || "Uncategorized";
        if (!groups[catName]) groups[catName] = [];
        groups[catName].push(item);
      }
    });

    // Clean up the Priority List key if no priority items exist
    if (groups["Priority List"].length === 0) {
      delete groups["Priority List"];
    }

    return groups;
  }, [itemsData]);

  // --- COMPUTE ATTRIBUTION LABEL AND VALUE BASED ON 3 BUSINESS CONDITIONS ---
  const attributionData = useMemo(() => {
    const isScheduled = instanceData?.is_scheduled ?? false
    const scheduledBy = instanceData?.scheduled_by
    const updatedBy = instanceData?.updated_by

    // Condition 1: If is_scheduled is true, always keep as Scheduled By
    if (isScheduled) {
      return {
        label: 'Scheduled By',
        value: scheduledBy || 'System'
      }
    }

    // Condition 2: If is_scheduled is false and updated_by exists
    if (updatedBy) {
      return {
        label: 'Updated By',
        value: updatedBy
      }
    }

    // Condition 3: If is_scheduled is false and updated_by is null
    return {
      label: 'Scheduled By',
      value: 'System'
    }
  }, [instanceData])

  // --- INTERACTION HANDLERS ---
  const handleToggleRow = (productId: number) => {
    setSelectedIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    )
  }

  const handleToggleSelectAll = () => {
    if (selectedIds.length === itemsData.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(itemsData.map(item => item.product_id))
    }
  }

  const toggleCategoryCollapse = (categoryName: string) => {
    setCollapsedCategories(prev => ({ ...prev, [categoryName]: !prev[categoryName] }))
  }

  const handleOpenBarcodeDialog = (name: string, upc: string, image: string | null) => {
    setActiveBarcodeItem({ name, upc, image })
  }

  // --- TANSTACK MUTATION FOR BATCH RECOVERY CLEANUPS ---
  const deleteItemsMutation = useMutation({
    mutationFn: async (productIds: number[]) => {
      // Fetches security storage tokens inline dynamically
      const token = localStorage.getItem('token')

      const response = await axios.delete(`/api/cycle-count/schedules/details/${id}/items`, {
        data: { productIds },
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        }
      })
      return response.data
    },
    onSuccess: () => {
      // 1. Invalidate cash indexes to invoke clean layout updates instantly
      queryClient.invalidateQueries({ queryKey: ['cycleCountInstanceDetails', id] })
      // 2. Purge selections arrays
      setSelectedIds([])
    },
    onError: (err: any) => {
      const errorMsg = err.response?.data?.message || "Failed to successfully execute row exclusion procedures."
      alert(`Error: ${errorMsg}`)
    }
  })

  // --- CONFIRMATION HANDLER TRIGGER ---
  const handleDeleteSelectedItems = () => {
    if (selectedIds.length === 0) return;

    const confirmText = selectedIds.length === 1
      ? "Are you sure you want to remove this item? Once it is removed, it won't be showing up in the count anymore."
      : `Are you sure you want to remove these ${selectedIds.length} items? Once they are removed, they won't be showing up in the count anymore.`

    if (window.confirm(confirmText)) {
      deleteItemsMutation.mutate(selectedIds)
    }
  }

  // --- MUTATION FOR REMOVING THE ENTIRE INSTANCE ---
  // --- 2. Update your Mutation Handler ---
  const deleteEntireScheduleMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('token');

      const response = await axios.delete(`/api/cycle-count/instance/${id}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        }
      });
      return response.data;
    },
    onSuccess: () => {
      // Force a fresh layout reload on the side panel's master index list cache track
      queryClient.invalidateQueries({ queryKey: ['cycle-count-instances'] });

      alert("Schedule instance completely deleted successfully.");

      // Smooth, client-side routing via TanStack Router
      navigate({ to: "/cycle-count/manage/schedule" });
    },
    onError: (err: any) => {
      const errorMsg = err.response?.data?.message || "Failed to successfully terminate the targeted count instance.";
      alert(`Error: ${errorMsg}`);
    }
  });

  // --- FULL DELETION TRIGGER INTERACTION ---
  const handleDeleteEntireSchedule = () => {
    const confirmText = "⚠️ CRITICAL WARNING: Are you sure you want to completely DELETE this entire schedule? This action will permanently drop the instance along with all linked item lines. This action cannot be undone.";

    if (window.confirm(confirmText)) {
      deleteEntireScheduleMutation.mutate();
    }
  };

  // --- ASYNC NETWORK STATE RENDERS ---
  if (isLoading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Loading count profile data...</span>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="bg-white p-6 max-w-md w-full rounded-2xl border border-rose-200 shadow-sm text-center">
          <span className="inline-block px-2 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-md uppercase tracking-wide mb-3">Error</span>
          <h3 className="text-base font-black text-gray-900 mb-1">Failed to fetch context records</h3>
          <p className="text-xs text-gray-500 mb-4">{error instanceof Error ? error.message : 'Unknown network connection failure'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all"
          >
            Retry Connection
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6">

      {/* ================= HEADER SUMMARY CONTROL DASHBOARD ================= */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm overflow-x-auto scrollbar-thin">
        <div className="flex items-center justify-between gap-6 min-w-max">
          {/* Left Side: Metadata Metrics Row */}
          <div className="flex items-center gap-6">

            {/* Status Schedule Badge */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold w-max shadow-sm border ${isHistorical
                ? 'bg-slate-100 border-slate-300 text-slate-700' // Neutral gray look for closed history records
                : isInstanceScheduled
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-blue-50 border-blue-200 text-blue-700'
                }`}>
                {isHistorical ? 'Schedule Completed' : isInstanceScheduled ? 'Scheduled' : 'System'}
              </span>
            </div>

            <div className="h-8 w-px bg-gray-200" />

            {/* Total Scope Metrics */}
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Scheduled Items</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-gray-900">{totalItemCount}</span>
                <span className="text-xs text-gray-500 font-medium">products</span>
              </div>
            </div>

            <div className="h-8 w-px bg-gray-200" />

            {/* Live Timeline Badge Monitor */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Timeline Status</span>
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold ${isLive
                  ? 'bg-rose-100 text-rose-800 animate-pulse'
                  : isHistorical
                    ? 'bg-emerald-100 text-emerald-800' // Clear signature indicator color for archived rows
                    : 'bg-blue-100 text-blue-800'
                  }`}>
                  {isHistorical ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  {badgeText}
                </span>
                <span className="text-xs font-medium text-gray-600">{subStatusText}</span>
              </div>
            </div>

            <div className="h-8 w-px bg-gray-200" />

            {/* Identity & Attribution Track */}
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {attributionData.label}
              </span>
              <div className="flex items-center gap-1.5 text-sm font-bold text-gray-800">
                <User className="w-4 h-4 text-gray-400" />
                {attributionData.value}
              </div>
            </div>
          </div>

          {/* Right Side: Legend & Actions Locked on the Same Line */}
          <div className="flex items-center gap-4">

            {/* VISUAL LEGEND: GRADES & CRITICAL STOCK */}
            <div className="flex items-center gap-3 bg-gray-50/50 border border-gray-100 rounded-lg px-3 py-1.5 h-[38px]">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1">Legend:</span>

              {/* Grade Tags */}
              <div className="flex items-center gap-1.5 border-r border-gray-200 pr-3">
                <div className="flex items-center gap-1 text-xs font-medium text-gray-600">
                  <span className="w-1.5 h-3.5 bg-blue-500 rounded-sm"></span>
                  <span>A</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-gray-600">
                  <span className="w-1.5 h-3.5 bg-amber-500 rounded-sm"></span>
                  <span>B</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-gray-600">
                  <span className="w-1.5 h-3.5 bg-green-500 rounded-sm"></span>
                  <span>C</span>
                </div>
              </div>

              {/* Critical Stock Alert Indicator */}
              <div className="flex items-center gap-2 px-1 py-0.5 rounded bg-rose-50 border border-rose-100/60">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
                <span className="text-xs font-bold text-rose-700 leading-none">≤ 0 On Hand</span>
              </div>
            </div>

            {/* --- GLOBAL WORKFLOW ACTION BUTTONS: HIDE COMPLETELY IF VIEW IS HISTORICAL --- */}
            {!isHistorical && (
              <>
                <button
                  type="button"
                  onClick={handleDeleteSelectedItems}
                  disabled={!isDeleteActive || isLive || deleteItemsMutation.isPending}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm h-[38px] ${isDeleteActive && !isLive && !deleteItemsMutation.isPending
                    ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer active:scale-[0.98]'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  {deleteItemsMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Remove Item ({selectedIds.length})
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  disabled={!canAddItem || isLive}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm h-[38px] ${canAddItem && !isLive
                    ? 'bg-gray-900 hover:bg-black text-white cursor-pointer active:scale-[0.98]'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>

                {isInstanceScheduled && (
                  <button
                    type="button"
                    onClick={handleDeleteEntireSchedule}
                    disabled={deleteEntireScheduleMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-rose-600 border border-rose-200 hover:bg-rose-50/50 transition-all shadow-sm h-[38px] cursor-pointer active:scale-[0.98]"
                  >
                    {deleteEntireScheduleMutation.isPending ? (
                      <div className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Delete Entire Schedule
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Unscheduled Max Threshold Alert Box Banner - HIDE IF HISTORICAL */}
      {/* ================= CONTEXTUAL NOTIFICATION BANNERS ================= */}
      {isHistorical ? (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3 shadow-sm">
          <span className="p-1 rounded-md bg-slate-200 text-slate-700 text-xs font-bold uppercase shrink-0">Archive View</span>
          <p className="text-xs text-slate-600 leading-normal font-medium">
            You are viewing an immutable historical entry record. For detailed information about consolidated final counts, operational adjustments, and inventory variances, please visit the <a href="/cycle-count/report" className="text-blue-600 font-bold hover:underline">Reports page</a>.
          </p>
        </div>
      ) : (
        !isInstanceScheduled && totalItemCount >= 20 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <span className="p-1 rounded-md bg-amber-100 text-amber-800 text-xs font-bold uppercase shrink-0">Limit Hit</span>
            <p className="text-xs text-amber-800 leading-normal font-medium">
              This count instance is system generated and has hit its limit of <b>20 items per day</b>. To insert alternative SKU entities, remove items from the list first or create a full schedule compilation rules.
            </p>
          </div>
        )
      )}

      {/* ================= CONDENSED DATA MATRIX WORKBENCH ================= */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse text-sm table-fixed">
            <thead className="bg-gray-100 text-gray-700 font-semibold sticky top-0 z-30 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
              <tr>
                {/* Conditionally hide the selection header column if the count instance is live */}
                {!isLive && !isHistorical && (
                  <th className="p-3 bg-gray-100 text-center w-12">
                    <input
                      type="checkbox"
                      className="rounded accent-primary cursor-pointer h-4 w-4"
                      checked={itemsData.length > 0 && selectedIds.length === itemsData.length}
                      onChange={handleToggleSelectAll}
                    />
                  </th>
                )}
                <th className="p-3 bg-gray-100 text-center w-14">Image</th>
                <th className="p-3 bg-gray-100 w-36 font-mono">UPC</th>
                <th className="p-3 bg-gray-100 w-54">Description</th>
                <th className="p-3 text-right pr-4 w-24">On Hand</th>
                <th className="p-3 w-24 pl-5">Grade</th>
                <th className="p-3 text-center w-32">Count Status</th>
              </tr>
            </thead>


            <tbody className="divide-y text-gray-600">
              {Object.entries(groupedItems).map(([categoryName, categoryRows]) => {
                const isCollapsed = !!collapsedCategories[categoryName];
                const isPriorityGroup = categoryName === "Priority List";

                return (
                  <caption key={categoryName} style={{ display: 'contents' }}>
                    {/* ================= CATEGORY TITLE ACCORDION HEADER ROW ================= */}
                    <tr
                      onClick={() => toggleCategoryCollapse(categoryName)}
                      className={`cursor-pointer select-none transition-colors border-y ${isPriorityGroup
                        ? 'bg-blue-50/60 hover:bg-blue-50 border-blue-100'
                        : 'bg-gray-50 hover:bg-gray-100/80'
                        }`}
                    >
                      {/* Dynamically adjust colSpan matching the active number of columns */}
                      <td
                        colSpan={isLive || isHistorical ? 6 : 7}
                        className="p-2.5 font-semibold text-xs tracking-wide uppercase"
                      >
                        <div className="flex items-center justify-between w-full pr-2">
                          <div className="flex items-center gap-2">
                            {isCollapsed ? (
                              <ChevronRight className={`h-4 w-4 shrink-0 ${isPriorityGroup ? 'text-blue-500' : 'text-gray-500'}`} />
                            ) : (
                              <ChevronDown className={`h-4 w-4 shrink-0 ${isPriorityGroup ? 'text-blue-500' : 'text-gray-500'}`} />
                            )}

                            {/* Visual indicator distinction */}
                            {isPriorityGroup && (
                              <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0 animate-pulse" />
                            )}

                            <span className={isPriorityGroup ? 'text-blue-900 font-black tracking-tight' : 'text-gray-800'}>
                              {categoryName}
                            </span>

                            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-normal lowercase ${isPriorityGroup
                              ? 'bg-blue-100 text-blue-700 font-bold'
                              : 'bg-gray-200 text-gray-600'
                              }`}>
                              {categoryRows.length} {categoryRows.length === 1 ? 'product' : 'products'}
                            </span>
                          </div>

                          {isPriorityGroup && (
                            <span className="text-[10px] font-extrabold bg-blue-600 text-white px-2 py-0.5 rounded tracking-widest uppercase shadow-sm">
                              High Importance
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* ================= RENDER UNCOLLAPSED ITEMS MATRICES ================= */}
                    {!isCollapsed && categoryRows.map((item) => (
                      <ItemRow
                        key={item.product_id}
                        item={item}
                        isLive={isLive}
                        isHistorical={isHistorical}
                        isSelected={selectedIds.includes(item.product_id)}
                        onToggle={handleToggleRow}
                        onOpenBarcode={handleOpenBarcodeDialog}
                      />
                    ))}
                  </caption>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- HIGH PERFORMANCE ISOLATED BARCODE ZOOM DIALOG --- */}
      <Dialog open={!!activeBarcodeItem} onOpenChange={(open) => { if (!open) setActiveBarcodeItem(null); }}>
        {/* Dialog markup keeps running identically */}
        <DialogContent className="sm:max-w-md rounded-3xl overflow-hidden p-0 border-none bg-white">
          <div className="w-full h-48 bg-gray-50 relative border-b border-gray-100">
            <div className="absolute top-4 left-0 right-0 text-center z-10">
              <span className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-[9px] uppercase tracking-tighter font-black text-gray-500 shadow-sm border border-white/50">
                Verify Product Identity
              </span>
            </div>
            {activeBarcodeItem?.image ? (
              <img
                src={activeBarcodeItem.image}
                alt={activeBarcodeItem.name}
                className="w-full h-full object-contain p-4"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                <ImageIcon className="w-12 h-12 mb-2 opacity-20" />
                <span className="text-xs font-bold uppercase tracking-widest opacity-40">No Image Available</span>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center items-center p-8 pt-6">
            <div className="w-full p-6 bg-white rounded-2xl border-2 border-gray-100 mb-6 flex justify-center shadow-sm">
              {activeBarcodeItem?.upc && (
                <Barcode
                  value={activeBarcodeItem.upc}
                  width={2.2}
                  height={100}
                  displayValue={false}
                />
              )}
            </div>

            <div className="text-center px-4">
              <h3 className="text-base font-black text-gray-900 leading-tight mb-2 max-w-sm" title={activeBarcodeItem?.name}>
                {activeBarcodeItem?.name}
              </h3>
              <div className="inline-block bg-blue-50 px-4 py-1.5 rounded-lg">
                <p className="text-sm font-mono font-black text-blue-700 tracking-[0.15em]">
                  {activeBarcodeItem?.upc}
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveBarcodeItem(null)}
              className="mt-6 w-full py-3 bg-gray-900 text-white rounded-2xl font-bold transition-all hover:bg-black active:scale-[0.98]"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AddItemsModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        instanceId={id || ''}
        siteMongoId={instanceData?.site_mongo_id || ''} // <-- Add this new property reference here
        isScheduled={instanceData?.is_scheduled ?? false}
        alreadyAddedCount={itemsData?.length ?? 0}
      />
    </div>
  )
}


interface AddItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceId: string;
  siteMongoId: string;
  isScheduled: boolean;
  alreadyAddedCount: number;
}

interface CatalogItem {
  id: number;
  upc: string;
  description: string;
  on_hand_qty: number;
  categoryName: string;
}

export const AddItemsModal: React.FC<AddItemsModalProps> = ({
  isOpen,
  onClose,
  instanceId,
  siteMongoId,
  isScheduled,
  alreadyAddedCount
}) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedItemMap, setSelectedItemMap] = useState<Record<number, CatalogItem>>({});

  // 1. Handle Input Debounce
  useEffect(() => {
    if (searchTerm.trim().length === 0) {
      setDebouncedSearch('');
      return;
    }

    if (searchTerm.trim().length >= 3) {
      const handler = setTimeout(() => {
        setDebouncedSearch(searchTerm.trim());
      }, 300);
      return () => clearTimeout(handler);
    }
  }, [searchTerm]);

  // 2. TanStack Query with siteMongoId integration properties mapped inside
  const { data: items = [], isLoading } = useQuery<CatalogItem[]>({
    // We add siteMongoId directly into the caching key arrays so switches completely dump past searches safely
    queryKey: ['catalogSearch', debouncedSearch, siteMongoId, isOpen],
    queryFn: async () => {
      console.log(`🚀 API Fetching with query: "${debouncedSearch}" for site: ${siteMongoId}`);
      const res = await axios.get('/api/cycle-count/schedules/items/search', {
        params: {
          query: debouncedSearch,
          siteMongoId: siteMongoId // <-- Send site filter mapping through network parameters
        },
        headers: getAuthHeaders(),
      });
      return res.data;
    },
    // Only fetch if modal is completely visible AND we have a valid site location scope string loaded
    enabled: isOpen && !!siteMongoId,
    placeholderData: (previousData) => previousData,
  });

  // 3. Save Mutation Put Execution Hooks
  const appendMutation = useMutation({
    mutationFn: async (productIds: number[]) => {
      const res = await axios.put(
        `/api/cycle-count/schedules/details/${instanceId}/items`,
        { productIds },
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycleCountInstanceDetails', instanceId] });
      handleClose();
    },
    onError: (err: any) => {
      alert(`Error appending records: ${err.response?.data?.message || 'Transaction failed.'}`);
    }
  });

  const currentSelectedCount = Object.keys(selectedItemMap).length;
  const aggregateProjectedTotal = alreadyAddedCount + currentSelectedCount;
  const isLimitHit = !isScheduled && aggregateProjectedTotal >= 20;

  const handleSelectItem = (item: CatalogItem, isChecked: boolean) => {
    setSelectedItemMap(prev => {
      const next = { ...prev };
      if (isChecked) {
        if (!isScheduled && (alreadyAddedCount + Object.keys(next).length) >= 20) {
          return prev;
        }
        next[item.id] = item;
      } else {
        delete next[item.id];
      }
      return next;
    });
  };

  const handleRemoveFromPreview = (id: number) => {
    setSelectedItemMap(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSaveSubmit = () => {
    const idsToSubmit = Object.keys(selectedItemMap).map(Number);
    if (idsToSubmit.length === 0) return;

    if (window.confirm(`Are you sure you want to add these ${idsToSubmit.length} items into this count instance profile?`)) {
      appendMutation.mutate(idsToSubmit);
    }
  };

  const handleClose = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setSelectedItemMap({});
    onClose();
  };

  // Safe Guard Condition integrated directly into the core execution return block
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden border border-gray-100">

        {/* Header Block */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-gray-500" />
            <h3 className="text-base font-bold text-gray-900">Add Inventory Items</h3>
          </div>
          <button onClick={handleClose} className="p-1.5 hover:bg-gray-200/60 rounded-lg transition-all text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Warning Alert Bar */}
        {isLimitHit && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-amber-800 text-xs font-semibold shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Instance limit reached. You cannot choose more than 20 total composite items.</span>
          </div>
        )}

        {/* Real-time Sticky Selection Preview Tray */}
        {/* CHANGED: Fixed heights via h-[115px], flex layout, and absolute shrink-0 protection */}
        <div className="p-4 bg-gray-50 border-b border-gray-200/60 h-[115px] flex flex-col shrink-0">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5 shrink-0">
            Selected Items Preview ({currentSelectedCount})
          </span>
          <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar pr-1">
            {currentSelectedCount === 0 ? (
              <span className="text-xs text-gray-400 italic block pt-1">
                No items chosen yet. Select items from the directory grid below.
              </span>
            ) : (
              <div className="flex flex-wrap gap-2 pb-1">
                {Object.values(selectedItemMap).map(item => (
                  <div key={item.id} className="inline-flex items-center gap-1.5 bg-white border border-gray-200 px-2.5 py-1 rounded-lg shadow-sm text-xs text-gray-800 font-medium transition-all">
                    <span className="max-w-[180px] truncate">{item.description}</span>
                    <button onClick={() => handleRemoveFromPreview(item.id)} className="hover:bg-rose-50 p-0.5 rounded text-gray-400 hover:text-rose-600 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Search Bar Block */}
        <div className="p-4 border-b border-gray-100 shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search catalog repository by UPC Barcode, Item Description, or Category ID..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 hover:bg-gray-100/50 focus:bg-white text-sm font-medium border border-gray-200 rounded-xl outline-none focus:border-gray-900 transition-all text-gray-800 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Main Lightweight Grid Data Table */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <div className="w-8 h-8 border-3 border-gray-900 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-gray-400 font-medium tracking-wide">Streaming structural index matrices...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400 font-medium italic">No catalog entries match current search conditions.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white z-10 shadow-[0_1px_0_0_rgba(229,231,235,1)]">
                <tr className="text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50">
                  <th className="p-2.5 w-[50px] text-center">Select</th>
                  <th className="p-2.5">UPC Barcode</th>
                  <th className="p-2.5">Product Description</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5 text-right">On Hand Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-medium text-gray-700">
                {items.map((item) => {
                  const isChecked = !!selectedItemMap[item.id];
                  const shouldHideSelector = isLimitHit && !isChecked;

                  return (
                    <tr key={item.id} className={`hover:bg-gray-50/80 transition-colors ${isChecked ? 'bg-blue-50/30' : ''}`}>
                      <td className="p-2.5 text-center">
                        {shouldHideSelector ? (
                          <div className="w-4 h-4 mx-auto flex items-center justify-center"><X className="w-3 h-3 text-gray-300" /></div>
                        ) : (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleSelectItem(item, e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer accent-gray-900"
                          />
                        )}
                      </td>
                      <td className="p-2.5 font-mono text-gray-500">{item.upc}</td>
                      <td className="p-2.5 font-bold text-gray-900">{item.description}</td>
                      <td className="p-2.5 text-gray-500">{item.categoryName}</td>
                      <td className="p-2.5 text-right font-bold text-gray-900">{item.on_hand_qty}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Action Bar */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
          <div className="text-xs text-gray-500 font-medium">
            Projected Instance Count: <span className="font-bold text-gray-900">{aggregateProjectedTotal}</span> / {!isScheduled ? '20 max' : 'unlimited'}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleClose} className="px-4 py-2 border border-gray-200 bg-white text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-50 transition-all active:scale-[0.98]">
              Cancel
            </button>
            <button
              onClick={handleSaveSubmit}
              disabled={currentSelectedCount === 0 || appendMutation.isPending}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl shadow-sm transition-all text-white ${currentSelectedCount > 0 && !appendMutation.isPending
                ? 'bg-gray-900 hover:bg-black active:scale-[0.98] cursor-pointer'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                }`}
            >
              {appendMutation.isPending ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Finalize Additions ({currentSelectedCount})
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
