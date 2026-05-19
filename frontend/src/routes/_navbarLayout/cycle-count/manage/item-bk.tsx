// import { createFileRoute, useNavigate } from '@tanstack/react-router'
// import { useState, useEffect, useMemo, useCallback, memo } from 'react'
// import { Search, SlidersHorizontal, Download, Edit3, Loader2, ChevronDown, ChevronRight, X, Check } from 'lucide-react'
// import { useSite } from '@/context/SiteContext'
// import { LocationPicker } from '@/components/custom/locationPicker'
// import { useAuth } from "@/context/AuthContext";

// export const Route = createFileRoute('/_navbarLayout/cycle-count/manage/item-bk')({
//   component: RouteComponent,
// })

// const gradeStyles: Record<string, string> = {
//   A: 'bg-red-50/40 hover:bg-red-50/70 border-l-4 border-l-red-500',
//   B: 'bg-amber-50/30 hover:bg-amber-50/60 border-l-4 border-l-amber-500',
//   C: 'bg-green-50/30 hover:bg-green-50/60 border-l-4 border-l-green-500',
// }

// interface ItemBkRow {
//   id: number
//   upc_barcode: string
//   upc: string
//   description: string
//   category_id: number
//   categoryName: string
//   vendor_name: string
//   department: string
//   price_group: string
//   promo_group: string
//   grade: string
//   allow_cycle_count: boolean
//   pk_in_crt: number | null
//   crt_in_case: number | null
//   on_hand_qty: string | number | null
// }

// // Configurable dictionary defining columns available for advanced filtering
// const FILTERABLE_COLUMNS = [
//   { key: 'categoryName', label: 'Category' },
//   { key: 'vendor_name', label: 'Vendor' },
//   { key: 'department', label: 'Department' },
//   { key: 'grade', label: 'Grade' },
//   { key: 'allow_cycle_count', label: 'Allow Count Status' },
//   { key: 'price_group', label: 'Price Group' },
//   { key: 'promo_group', label: 'Promo Group' },
// ] as const

// // Payload layout for staging changes
// interface MassEditPayload {
//   allow_cycle_count: boolean | null
//   grade: string | null
//   pk_in_crt: number | null
//   crt_in_case: number | null
// }

// type FilterKey = typeof FILTERABLE_COLUMNS[number]['key'];

// // Memoized Table Row Component
// const ItemRow = memo(({
//   item,
//   isSelected,
//   onToggle
// }: {
//   item: ItemBkRow;
//   isSelected: boolean;
//   onToggle: (id: number) => void
// }) => {
//   const gradeClass = gradeStyles[item.grade] || 'hover:bg-gray-50'
//   const barcode = item.upc_barcode || item.upc

//   return (
//     <tr className={`${gradeClass} ${isSelected ? '!bg-primary/5 transition-colors' : ''}`}>
//       <td className="p-3 sticky left-0 bg-white z-10 text-center shadow-[2px_0_0_0_rgba(0,0,0,0.05)] align-middle">
//         <input
//           type="checkbox"
//           className="rounded accent-primary cursor-pointer h-4 w-4"
//           checked={isSelected}
//           onChange={() => onToggle(item.id)}
//         />
//       </td>
//       <td className="p-3 font-mono text-xs text-gray-900 sticky left-12 bg-white z-10 shadow-[2px_0_0_0_rgba(0,0,0,0.05)] align-middle">
//         {barcode}
//       </td>
//       <td className="p-3 font-medium text-gray-900 sticky left-[224px] bg-white z-10 shadow-[2px_0_0_0_rgba(0,0,0,0.05)] align-middle truncate max-w-xs" title={item.description}>
//         {item.description}
//       </td>
//       <td className="p-3 align-middle">
//         <span className="px-2 py-0.5 rounded text-xs font-bold bg-white border border-gray-200 shadow-sm">
//           Grade {item.grade}
//         </span>
//       </td>
//       <td className="p-3 whitespace-nowrap text-xs text-gray-500 align-middle">
//         {item.categoryName}
//       </td>
//       <td className="p-3 max-w-[160px] truncate text-xs align-middle" title={item.vendor_name}>
//         {item.vendor_name || '—'}
//       </td>
//       <td className="p-3 whitespace-nowrap text-xs align-middle">
//         {item.department || '—'}
//       </td>
//       <td className="p-3 font-mono text-center text-gray-900 align-middle">
//         {item.pk_in_crt ?? '—'}
//       </td>
//       <td className="p-3 font-mono text-center text-gray-900 align-middle">
//         {item.crt_in_case ?? '—'}
//       </td>
//       <td className="p-3 align-middle">
//         <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${item.allow_cycle_count ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
//           }`}>
//           {item.allow_cycle_count ? 'Yes' : 'No'}
//         </span>
//       </td>
//       <td className="p-3 whitespace-nowrap text-xs text-gray-400 align-middle">
//         {item.price_group || '—'}
//       </td>
//       <td className="p-3 whitespace-nowrap text-xs text-gray-400 align-middle">
//         {item.promo_group || '—'}
//       </td>
//       <td className="p-3 font-mono text-xs text-right pr-6 align-middle">
//         {item.on_hand_qty ? Number(item.on_hand_qty).toFixed(2) : '0.00'}
//       </td>
//     </tr>
//   )
// })
// ItemRow.displayName = 'ItemRow'

// function RouteComponent() {
//   const { selectedSite } = useSite()
//   const { user } = useAuth()
//   const navigate = useNavigate()
//   const [site, setSite] = useState<string>(selectedSite || user?.location || "")
//   const [searchQuery, setSearchQuery] = useState<string>("")
//   const [items, setItems] = useState<ItemBkRow[]>([])
//   const [selectedIds, setSelectedIds] = useState<number[]>([])
//   const [isLoading, setIsLoading] = useState<boolean>(false)
//   const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})
//   // State to control modal visibility stages
//   const [isMassEditOpen, setIsMassEditOpen] = useState<boolean>(false)
//   const [showMassEditConfirm, setShowMassEditConfirm] = useState<boolean>(false)
//   const [isUpdating, setIsUpdating] = useState<boolean>(false)


//   const [editForm, setEditForm] = useState<MassEditPayload>({
//     allow_cycle_count: null,
//     grade: null,
//     pk_in_crt: null,
//     crt_in_case: null,
//   })

//   // Advanced Filtering States
//   const [isFilterDialogOpen, setIsFilterDialogOpen] = useState<boolean>(false)
//   const [selectedFilterColumn, setSelectedFilterColumn] = useState<FilterKey>('categoryName')
//   // Dynamic state structure: { categoryName: ['Beverages', 'Candy'], grade: ['A'] }
//   const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({})

//   useEffect(() => {
//     if (!site) return

//     async function fetchItemBook() {
//       setIsLoading(true)
//       try {
//         const res = await fetch(`/api/cycle-count/item-bk?site=${encodeURIComponent(site)}`, {
//           headers: {
//             "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
//             "X-Required-Permission": "cycleCount.manageCount",
//           }
//         });
//         if (res.status === 403) { navigate({ to: "/no-access" }); return; }
//         if (res.ok) {
//           const data = await res.json()
//           setItems(data.items || [])
//         }
//       } catch (err) {
//         console.error("Error loading items database context:", err)
//       } finally {
//         setIsLoading(false)
//       }
//     }

//     fetchItemBook()
//     setSelectedIds([])
//     setCollapsedCategories({})
//     setActiveFilters({}) // Clear active filters on site changes
//   }, [site])

//   const handleToggleRow = useCallback((id: number) => {
//     setSelectedIds(prev =>
//       prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
//     )
//   }, [])

//   // Dynamic lookup matrix: Generates unique values for a selected column based on currently loaded dataset
//   const uniqueValuesForSelectedColumn = useMemo(() => {
//     const valuesSet = new Set<string>()
//     items.forEach(item => {
//       let val = item[selectedFilterColumn]
//       if (val === null || val === undefined || val === '') {
//         val = '—'
//       } else if (typeof val === 'boolean') {
//         val = val ? 'Yes' : 'No'
//       }
//       valuesSet.add(String(val))
//     })
//     return Array.from(valuesSet).sort((a, b) => a.localeCompare(b))
//   }, [items, selectedFilterColumn])

//   // Handle setting a criteria inside the filter configuration map
//   const handleToggleFilterValue = (column: string, value: string) => {
//     setActiveFilters(prev => {
//       const currentValues = prev[column] || []
//       let updatedValues: string[]

//       if (currentValues.includes(value)) {
//         updatedValues = currentValues.filter(v => v !== value)
//       } else {
//         updatedValues = [...currentValues, value]
//       }

//       const copy = { ...prev }
//       if (updatedValues.length === 0) {
//         delete copy[column]
//       } else {
//         copy[column] = updatedValues
//       }
//       return copy
//     })
//   }

//   const handleResetAllFilters = () => {
//     setActiveFilters({})
//     setSearchQuery("")
//   }

//   const isFilteringActive = useMemo(() => {
//     return Object.keys(activeFilters).length > 0 || searchQuery.trim().length > 0
//   }, [activeFilters, searchQuery])

//   // DYNAMIC COMPUTING PROCESSING MATRIX: Applies search criteria + multi-column filter sets
//   const { groupedItems, filteredItemCount, allFilteredIds } = useMemo(() => {
//     const cleanQuery = searchQuery.trim().toLowerCase()

//     const filtered = items.filter(item => {
//       // 1. Text Search Filter Execution
//       if (cleanQuery) {
//         const targetName = (item.description || "").toLowerCase()
//         const targetBarcode = (item.upc_barcode || item.upc || "").toLowerCase()
//         if (!targetName.includes(cleanQuery) && !targetBarcode.includes(cleanQuery)) {
//           return false
//         }
//       }

//       // 2. Multi-Column Array Filter Checks
//       for (const [colKey, allowedValues] of Object.entries(activeFilters)) {
//         let rawVal = item[colKey as keyof ItemBkRow]
//         let mappedStr = ''

//         if (rawVal === null || rawVal === undefined || rawVal === '') {
//           mappedStr = '—'
//         } else if (typeof rawVal === 'boolean') {
//           mappedStr = rawVal ? 'Yes' : 'No'
//         } else {
//           mappedStr = String(rawVal)
//         }

//         if (!allowedValues.includes(mappedStr)) {
//           return false
//         }
//       }

//       return true
//     })

//     // 3. Group remaining elements cleanly by category
//     const groups: Record<string, ItemBkRow[]> = {}
//     const filteredIds: number[] = []

//     filtered.forEach(item => {
//       filteredIds.push(item.id)
//       const catName = item.categoryName || 'Uncategorized'
//       if (!groups[catName]) {
//         groups[catName] = []
//       }
//       groups[catName].push(item)
//     })

//     return {
//       groupedItems: groups,
//       filteredItemCount: filtered.length,
//       allFilteredIds: filteredIds
//     }
//   }, [items, searchQuery, activeFilters])

//   const handleToggleSelectAll = () => {
//     if (selectedIds.length === allFilteredIds.length) {
//       setSelectedIds([])
//     } else {
//       setSelectedIds(allFilteredIds)
//     }
//   }

//   const toggleCategoryCollapse = (catName: string) => {
//     setCollapsedCategories(prev => ({ ...prev, [catName]: !prev[catName] }))
//   }

//   const handleCloseMassEdit = () => {
//     setIsMassEditOpen(false)
//     setShowMassEditConfirm(false)
//     setEditForm({ allow_cycle_count: null, grade: null, pk_in_crt: null, crt_in_case: null })
//   }

//   const handleExecuteMassEdit = async () => {
//     setIsUpdating(true)
//     try {
//       const res = await fetch('/api/cycle-count/item-bk/mass-edit', {
//         method: 'PUT',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${localStorage.getItem("token") || ""}`,
//           'X-Required-Permission': 'cycleCount.manageCount',
//         },
//         body: JSON.stringify({
//           ids: selectedIds,
//           updates: Object.fromEntries(
//             Object.entries(editForm).filter(([_, v]) => v !== null)
//           )
//         })
//       })

//       if (res.status === 403) {
//         // Assuming your TanStack router navigate hook is active here
//         navigate({ to: "/no-access" })
//         return
//       }

//       if (res.ok) {
//         // Re-fetch active items to sync client UI with modifications
//         const updatedRes = await fetch(`/api/cycle-count/item-bk?site=${encodeURIComponent(site)}`, {
//           headers: {
//             "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
//             "X-Required-Permission": "cycleCount.manageCount",
//           }
//         });
//         if (updatedRes.status === 403) { navigate({ to: "/no-access" }); return; }
//         if (updatedRes.ok) {
//           const data = await updatedRes.json()
//           setItems(data.items || [])
//         }
//         setSelectedIds([])
//         handleCloseMassEdit()
//       } else {
//         const errData = await res.json()
//         alert(`Update failed: ${errData.message || 'Unknown Server Error'}`)
//       }
//     } catch (err) {
//       console.error("Critical failure updating bulk items:", err)
//     } finally {
//       setIsUpdating(false)
//     }
//   }

//   return (
//     <div className="flex flex-col w-full h-full bg-white relative">

//       {/* TOP CONTROL BAR HEADER */}
//       <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b bg-white shrink-0">
//         <div className="flex items-center gap-4 flex-1 min-w-[300px]">
//           <div className="w-64">
//             <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Active Site</label>
//             <LocationPicker setStationName={setSite} value="stationName" defaultValue={site} />
//           </div>

//           <div className="flex-1 max-w-md relative mt-5">
//             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
//             <input
//               type="text"
//               placeholder="Search description or barcode..."
//               value={searchQuery}
//               onChange={(e) => setSearchQuery(e.target.value)}
//               className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
//             />
//           </div>
//         </div>

//         {/* Action Controls Menu */}
//         <div className="flex items-center gap-2 mt-5">
//           <button
//             onClick={() => setIsFilterDialogOpen(true)}
//             className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-all ${Object.keys(activeFilters).length > 0
//               ? 'bg-blue-50 border-blue-300 text-blue-600 ring-2 ring-blue-100'
//               : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
//               }`}
//           >
//             <SlidersHorizontal className="h-4 w-4" />
//             <span>Filters</span>
//             {Object.keys(activeFilters).length > 0 && (
//               <span className="ml-1 px-1.5 py-0.5 text-[11px] font-bold rounded-full bg-blue-600 text-white">
//                 {Object.keys(activeFilters).length}
//               </span>
//             )}
//           </button>

//           {isFilteringActive && (
//             <button
//               onClick={handleResetAllFilters}
//               className="px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
//             >
//               Reset Filters
//             </button>
//           )}

//           <button className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
//             <Download className="h-4 w-4 text-gray-500" />
//             <span>Export</span>
//           </button>

//           <button
//             disabled={selectedIds.length === 0}
//             onClick={() => setIsMassEditOpen(true)}
//             className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${selectedIds.length > 0
//               ? 'bg-primary text-primary-foreground hover:opacity-90 cursor-pointer'
//               : 'bg-gray-100 text-gray-400 cursor-not-allowed'
//               }`}
//           >
//             <Edit3 className="h-4 w-4" />
//             <span>Bulk Edit ({selectedIds.length})</span>
//           </button>
//         </div>
//       </div>

//       {/* ACTIVE CRITERIA BREADCRUMBS ROW */}
//       {Object.keys(activeFilters).length > 0 && (
//         <div className="flex flex-wrap gap-1.5 px-4 py-2 bg-gray-50 border-b items-center">
//           <span className="text-xs text-gray-400 mr-1 font-medium">Active criteria:</span>
//           {Object.entries(activeFilters).map(([colKey, values]) => {
//             const matchedCol = FILTERABLE_COLUMNS.find(c => c.key === colKey)
//             return (
//               <div key={colKey} className="flex items-center bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
//                 <span className="opacity-70 mr-1">{matchedCol?.label}:</span>
//                 <span className="max-w-[120px] truncate">{values.join(', ')}</span>
//                 <button
//                   onClick={() => setActiveFilters(prev => {
//                     const copy = { ...prev }; delete copy[colKey]; return copy;
//                   })}
//                   className="ml-1.5 p-0.5 hover:bg-blue-100 rounded text-blue-500 hover:text-blue-800 transition-colors"
//                 >
//                   <X className="h-3 w-3" />
//                 </button>
//               </div>
//             )
//           })}
//         </div>
//       )}

//       {/* MAIN DATA WORKSPACE CONTAINER */}
//       <div className="flex-1 overflow-auto bg-gray-50/50 p-4">
//         {isLoading ? (
//           <div className="flex flex-col items-center justify-center h-64 gap-2">
//             <Loader2 className="h-8 w-8 text-primary animate-spin" />
//             <p className="text-sm text-muted-foreground font-medium">Processing item layout configuration variables...</p>
//           </div>
//         ) : filteredItemCount === 0 ? (
//           <div className="text-center p-12 border-2 border-dashed bg-white rounded-xl text-gray-400 mt-4">
//             No matching items found for current filter criteria.
//             <button onClick={handleResetAllFilters} className="block mx-auto mt-2 text-sm text-primary underline font-medium">Clear search constraints</button>
//           </div>
//         ) : (
//           <div className="bg-white border rounded-xl shadow-sm overflow-hidden max-h-[calc(100vh-230px)] relative flex flex-col">
//             <div className="overflow-auto flex-1">
//               <table className="w-full text-left border-collapse text-sm">
//                 <thead className="bg-gray-100 text-gray-700 font-semibold sticky top-0 z-20 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
//                   <tr>
//                     <th className="p-3 sticky left-0 bg-gray-100 z-30 w-12 text-center shadow-[2px_0_0_0_rgba(0,0,0,0.05)]">
//                       <input
//                         type="checkbox"
//                         className="rounded accent-primary cursor-pointer h-4 w-4"
//                         checked={allFilteredIds.length > 0 && selectedIds.length === allFilteredIds.length}
//                         onChange={handleToggleSelectAll}
//                       />
//                     </th>
//                     <th className="p-3 sticky left-12 bg-gray-100 z-30 w-44 shadow-[2px_0_0_0_rgba(0,0,0,0.05)]">UPC Barcode</th>
//                     <th className="p-3 sticky left-[224px] bg-gray-100 z-30 min-w-[240px] shadow-[2px_0_0_0_rgba(0,0,0,0.05)]">Description</th>
//                     <th className="p-3 whitespace-nowrap">Grade</th>
//                     <th className="p-3 whitespace-nowrap">Category Mapping</th>
//                     <th className="p-3 whitespace-nowrap">Vendor Name</th>
//                     <th className="p-3 whitespace-nowrap">Department</th>
//                     <th className="p-3 whitespace-nowrap">Packs in Crt</th>
//                     <th className="p-3 whitespace-nowrap">Crt in Case</th>
//                     <th className="p-3 whitespace-nowrap">Allow Count</th>
//                     <th className="p-3 whitespace-nowrap">Price Group</th>
//                     <th className="p-3 whitespace-nowrap">Promo Group</th>
//                     <th className="p-3 whitespace-nowrap">On Hand Qty</th>
//                   </tr>
//                 </thead>

//                 <tbody className="divide-y text-gray-600">
//                   {Object.entries(groupedItems).map(([categoryName, categoryRows]) => {
//                     const isCollapsed = !!collapsedCategories[categoryName];
//                     return (
//                       // Changed from <aside className="contents"> to a standard React Fragment
//                       <div key={categoryName} style={{ display: 'contents' }}>
//                         <tr className="bg-gray-50 hover:bg-gray-100/80 cursor-pointer select-none transition-colors border-y">
//                           <td colSpan={13} onClick={() => toggleCategoryCollapse(categoryName)} className="p-2.5 font-semibold text-gray-800 text-xs tracking-wide uppercase">
//                             <div className="flex items-center gap-2">
//                               {isCollapsed ? <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />}
//                               <span>{categoryName}</span>
//                               <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-normal lowercase">
//                                 {categoryRows.length} {categoryRows.length === 1 ? 'product' : 'products'}
//                               </span>
//                             </div>
//                           </td>
//                         </tr>
//                         {!isCollapsed && categoryRows.map((item) => (
//                           <ItemRow key={item.id} item={item} isSelected={selectedIds.includes(item.id)} onToggle={handleToggleRow} />
//                         ))}
//                       </div>
//                     )
//                   })}
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         )}
//       </div>

//       {/* INTERACTIVE MULTI-STAGE FILTER MODAL OVERLAY */}
//       {isFilterDialogOpen && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
//           <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-[520px] mx-4 border">

//             {/* Modal Header */}
//             <div className="p-4 border-b flex items-center justify-between bg-gray-50">
//               <div>
//                 <h3 className="font-bold text-gray-900 text-base">Advanced Data Column Filters</h3>
//                 <p className="text-xs text-gray-500">Isolate target item parameters across multiple categorical values</p>
//               </div>
//               <button onClick={() => setIsFilterDialogOpen(false)} className="p-1 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
//                 <X className="h-5 w-5" />
//               </button>
//             </div>

//             {/* Modal Divided Content Body */}
//             <div className="flex-1 flex overflow-hidden">

//               {/* STAGE A: Left Sidebar Columns Selector */}
//               <div className="w-1/3 border-r bg-gray-50/50 p-2 flex flex-col gap-1 overflow-y-auto">
//                 <div className="px-2 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Select Column</div>
//                 {FILTERABLE_COLUMNS.map((col) => {
//                   const isCurrent = selectedFilterColumn === col.key
//                   const activeCount = activeFilters[col.key]?.length || 0

//                   return (
//                     <button
//                       key={col.key}
//                       onClick={() => setSelectedFilterColumn(col.key)}
//                       className={`w-full text-left p-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${isCurrent
//                         ? 'bg-blue-600 text-white shadow-sm'
//                         : 'hover:bg-gray-100 text-gray-700'
//                         }`}
//                     >
//                       <span className="truncate mr-1">{col.label}</span>
//                       {activeCount > 0 && (
//                         <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${isCurrent ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-700'
//                           }`}>
//                           {activeCount}
//                         </span>
//                       )}
//                     </button>
//                   )
//                 })}
//               </div>

//               {/* STAGE B: Right Selection List of Unique Dataset Values */}
//               <div className="w-2/3 p-4 flex flex-col overflow-hidden">
//                 <div className="flex items-center justify-between mb-2">
//                   <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
//                     Available Matches ({uniqueValuesForSelectedColumn.length})
//                   </div>
//                   {(activeFilters[selectedFilterColumn]?.length || 0) > 0 && (
//                     <button
//                       onClick={() => setActiveFilters(prev => { const c = { ...prev }; delete c[selectedFilterColumn]; return c; })}
//                       className="text-xs text-blue-600 hover:underline"
//                     >
//                       Clear active column values
//                     </button>
//                   )}
//                 </div>

//                 <div className="flex-1 border rounded-lg bg-gray-50/30 overflow-y-auto divide-y">
//                   {uniqueValuesForSelectedColumn.map((value) => {
//                     const isChecked = (activeFilters[selectedFilterColumn] || []).includes(value)

//                     return (
//                       <label
//                         key={value}
//                         className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 cursor-pointer select-none text-xs text-gray-700 transition-colors"
//                       >
//                         <div className="flex items-center gap-2.5 min-w-0 flex-1">
//                           <input
//                             type="checkbox"
//                             checked={isChecked}
//                             onChange={() => handleToggleFilterValue(selectedFilterColumn, value)}
//                             className="rounded accent-blue-600 h-4 w-4 cursor-pointer shrink-0"
//                           />
//                           <span className="font-medium text-gray-900 truncate">{value}</span>
//                         </div>
//                         {isChecked && <Check className="h-4 w-4 text-blue-600 shrink-0 ml-2" />}
//                       </label>
//                     )
//                   })}
//                 </div>
//               </div>

//             </div>

//             {/* Modal Footer Controls */}
//             <div className="p-3 border-t bg-gray-50 flex items-center justify-between shrink-0">
//               <button
//                 onClick={handleResetAllFilters}
//                 className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 transition-colors"
//               >
//                 Reset All System Filters
//               </button>
//               <button
//                 onClick={() => setIsFilterDialogOpen(false)}
//                 className="px-5 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-white font-medium text-xs shadow-sm transition-colors"
//               >
//                 Apply Constraints ({allFilteredIds.length} items passing)
//               </button>
//             </div>

//           </div>
//         </div>
//       )}

//       {/* BULK EDIT DIALOG OVERLAY */}
//       {isMassEditOpen && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
//           <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col mx-4 border max-h-[90vh]">

//             {/* Modal Title Banner */}
//             <div className="p-4 border-b flex items-center justify-between bg-gray-50">
//               <div>
//                 <h3 className="font-bold text-gray-900 text-base">Bulk Edit Selection Matrix</h3>
//                 <p className="text-xs text-gray-500">Modifying <span className="font-semibold text-blue-600">{selectedIds.length}</span> active row selections concurrently</p>
//               </div>
//               <button onClick={handleCloseMassEdit} className="p-1 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
//                 <X className="h-5 w-5" />
//               </button>
//             </div>

//             {!showMassEditConfirm ? (
//               <>
//                 {/* Main Edit Parameters Panels */}
//                 <div className="flex-1 overflow-y-auto p-4 space-y-5">

//                   {/* Section 1: Cycle Count Eligibility */}
//                   <div className="space-y-2">
//                     <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">1. Allow Cycle Count Status</label>
//                     <div className="grid grid-cols-3 gap-2">
//                       <button
//                         type="button"
//                         onClick={() => setEditForm(p => ({ ...p, allow_cycle_count: true }))}
//                         className={`p-2.5 border rounded-lg text-xs font-semibold transition-all ${editForm.allow_cycle_count === true ? 'bg-green-50 border-green-500 text-green-700 ring-2 ring-green-100' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
//                       >
//                         Enable Counting (Yes)
//                       </button>
//                       <button
//                         type="button"
//                         onClick={() => setEditForm(p => ({ ...p, allow_cycle_count: false }))}
//                         className={`p-2.5 border rounded-lg text-xs font-semibold transition-all ${editForm.allow_cycle_count === false ? 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-100' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
//                       >
//                         Disable Counting (No)
//                       </button>
//                       <button
//                         type="button"
//                         onClick={() => setEditForm(p => ({ ...p, allow_cycle_count: null }))}
//                         className={`p-2.5 border border-dashed rounded-lg text-xs font-medium text-gray-400 hover:bg-gray-50 ${editForm.allow_cycle_count === null ? 'bg-gray-50 border-gray-300 text-gray-600' : ''}`}
//                       >
//                         Leave Unchanged
//                       </button>
//                     </div>
//                   </div>

//                   {/* Section 2: Product Velocity Classification Grade */}
//                   <div className="space-y-2">
//                     <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">2. Target Product Grade</label>
//                     <div className="grid grid-cols-4 gap-2">
//                       {['A', 'B', 'C'].map((g) => (
//                         <button
//                           key={g}
//                           type="button"
//                           onClick={() => setEditForm(p => ({ ...p, grade: g }))}
//                           className={`p-2.5 border rounded-lg text-xs font-bold transition-all ${editForm.grade === g ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
//                         >
//                           Grade {g}
//                         </button>
//                       ))}
//                       <button
//                         type="button"
//                         onClick={() => setEditForm(p => ({ ...p, grade: null }))}
//                         className={`p-2.5 border border-dashed rounded-lg text-xs font-medium text-gray-400 hover:bg-gray-50 ${editForm.grade === null ? 'bg-gray-50 border-gray-300 text-gray-600' : ''}`}
//                       >
//                         Unchanged
//                       </button>
//                     </div>
//                   </div>

//                   {/* Section 3: Crate Mapping Ratios */}
//                   <div className="space-y-2">
//                     <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">3. Carton Logistics Mapping</label>
//                     <div className="bg-gray-50/50 p-3 border rounded-xl grid grid-cols-2 gap-3">
//                       <div>
//                         <label className="block text-[11px] font-semibold text-gray-500 mb-1">Packs In Crate (pk_in_crt)</label>
//                         <input
//                           type="number"
//                           min="0"
//                           placeholder="Unchanged"
//                           value={editForm.pk_in_crt ?? ''}
//                           onChange={(e) => setEditForm(p => ({ ...p, pk_in_crt: e.target.value !== '' ? parseInt(e.target.value, 10) : null }))}
//                           className="w-full p-2 border rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
//                         />
//                       </div>
//                       <div>
//                         <label className="block text-[11px] font-semibold text-gray-500 mb-1">Crates In Case (crt_in_case)</label>
//                         <input
//                           type="number"
//                           min="0"
//                           placeholder="Unchanged"
//                           value={editForm.crt_in_case ?? ''}
//                           onChange={(e) => setEditForm(p => ({ ...p, crt_in_case: e.target.value !== '' ? parseInt(e.target.value, 10) : null }))}
//                           className="w-full p-2 border rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
//                         />
//                       </div>
//                     </div>
//                   </div>

//                 </div>

//                 {/* Modal Action Controls Footer */}
//                 <div className="p-3 border-t bg-gray-50 flex items-center justify-end gap-2">
//                   <button
//                     onClick={handleCloseMassEdit}
//                     className="px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
//                   >
//                     Cancel
//                   </button>
//                   <button
//                     disabled={Object.values(editForm).every(val => val === null)}
//                     onClick={() => setShowMassEditConfirm(true)}
//                     className="px-5 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-medium text-xs shadow-sm transition-colors"
//                   >
//                     Review Changes
//                   </button>
//                 </div>
//               </>
//             ) : (
//               <>
//                 {/* Confirmation Stage Component View */}
//                 <div className="flex-1 overflow-y-auto p-4 space-y-4">
//                   <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs leading-relaxed">
//                     ⚠️ <strong>Warning:</strong> You are about to mass overwrite attributes on <span className="font-bold underline">{selectedIds.length} items</span>. Current database configurations for these entries will be instantly replaced.
//                   </div>

//                   <div>
//                     <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Modifications Summary Layout:</div>
//                     <div className="border border-gray-100 rounded-lg divide-y bg-white overflow-hidden text-xs">
//                       {editForm.allow_cycle_count !== null && (
//                         <div className="p-2.5 flex justify-between items-center">
//                           <span className="font-semibold text-gray-600">Allow Cycle Count:</span>
//                           <span className={`px-2 py-0.5 rounded font-bold ${editForm.allow_cycle_count ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
//                             {editForm.allow_cycle_count ? 'Enabled (Yes)' : 'Disabled (No)'}
//                           </span>
//                         </div>
//                       )}
//                       {editForm.grade !== null && (
//                         <div className="p-2.5 flex justify-between items-center">
//                           <span className="font-semibold text-gray-600">Product Grade Velocity:</span>
//                           <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 font-bold rounded">
//                             Grade {editForm.grade}
//                           </span>
//                         </div>
//                       )}
//                       {editForm.pk_in_crt !== null && (
//                         <div className="p-2.5 flex justify-between items-center">
//                           <span className="font-semibold text-gray-600">Packs in Crate (pk_in_crt):</span>
//                           <span className="font-mono bg-gray-50 px-2 py-0.5 border rounded font-bold text-gray-900">
//                             {editForm.pk_in_crt}
//                           </span>
//                         </div>
//                       )}
//                       {editForm.crt_in_case !== null && (
//                         <div className="p-2.5 flex justify-between items-center">
//                           <span className="font-semibold text-gray-600">Crates in Case (crt_in_case):</span>
//                           <span className="font-mono bg-gray-50 px-2 py-0.5 border rounded font-bold text-gray-900">
//                             {editForm.crt_in_case}
//                           </span>
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 </div>

//                 <div className="p-3 border-t bg-gray-50 flex items-center justify-between">
//                   <button
//                     disabled={isUpdating}
//                     onClick={() => setShowMassEditConfirm(false)}
//                     className="px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
//                   >
//                     Back to Form
//                   </button>
//                   <button
//                     disabled={isUpdating}
//                     onClick={handleExecuteMassEdit}
//                     className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-sm transition-colors flex items-center gap-1.5"
//                   >
//                     {isUpdating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
//                     <span>Confirm & Write to DB</span>
//                   </button>
//                 </div>
//               </>
//             )}

//           </div>
//         </div>
//       )}

//     </div>
//   )
// }
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { Search, SlidersHorizontal, Download, Edit3, Loader2, ChevronDown, ChevronRight, X, Check, AlertTriangle } from 'lucide-react'
import { useSite } from '@/context/SiteContext'
import { LocationPicker } from '@/components/custom/locationPicker'
import { useAuth } from "@/context/AuthContext"

export const Route = createFileRoute('/_navbarLayout/cycle-count/manage/item-bk')({
  component: RouteComponent,
})

const gradeStyles: Record<string, string> = {
  A: 'bg-red-50/40 hover:bg-red-50/70 border-l-4 border-l-red-500',
  B: 'bg-amber-50/30 hover:bg-amber-50/60 border-l-4 border-l-amber-500',
  C: 'bg-green-50/30 hover:bg-green-50/60 border-l-4 border-l-green-500',
}

interface ItemBkRow {
  id: number
  upc_barcode: string
  upc: string
  description: string
  category_id: number
  categoryName: string
  vendor_name: string
  department: string
  price_group: string
  promo_group: string
  grade: string
  allow_cycle_count: boolean
  pk_in_crt: number | null
  crt_in_case: number | null
  on_hand_qty: string | number | null
}

// Configurable dictionary defining columns available for advanced filtering
const FILTERABLE_COLUMNS = [
  { key: 'categoryName', label: 'Category' },
  { key: 'vendor_name', label: 'Vendor' },
  { key: 'department', label: 'Department' },
  { key: 'grade', label: 'Grade' },
  { key: 'allow_cycle_count', label: 'Allow Count Status' },
  { key: 'price_group', label: 'Price Group' },
  { key: 'promo_group', label: 'Promo Group' },
] as const

// Payload layout for staging changes
interface MassEditPayload {
  allow_cycle_count: boolean | null
  grade: string | null
  pk_in_crt: number | null
  crt_in_case: number | null
}

type FilterKey = typeof FILTERABLE_COLUMNS[number]['key'];

// Memoized Table Row Component
const ItemRow = memo(({
  item,
  isSelected,
  onToggle
}: {
  item: ItemBkRow;
  isSelected: boolean;
  onToggle: (id: number) => void
}) => {
  const gradeClass = gradeStyles[item.grade] || 'hover:bg-gray-50'
  const barcode = item.upc_barcode || item.upc

  return (
    <tr className={`${gradeClass} ${isSelected ? '!bg-primary/5 transition-colors' : ''}`}>
      <td className="p-3 sticky left-0 bg-white z-10 text-center shadow-[2px_0_0_0_rgba(0,0,0,0.05)] align-middle">
        <input
          type="checkbox"
          className="rounded accent-primary cursor-pointer h-4 w-4"
          checked={isSelected}
          onChange={() => onToggle(item.id)}
        />
      </td>
      <td className="p-3 font-mono text-xs text-gray-900 sticky left-12 bg-white z-10 shadow-[2px_0_0_0_rgba(0,0,0,0.05)] align-middle">
        {barcode}
      </td>
      <td className="p-3 font-medium text-gray-900 sticky left-[224px] bg-white z-10 shadow-[2px_0_0_0_rgba(0,0,0,0.05)] align-middle truncate max-w-xs" title={item.description}>
        {item.description}
      </td>
      <td className="p-3 align-middle">
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-white border border-gray-200 shadow-sm">
          Grade {item.grade}
        </span>
      </td>
      <td className="p-3 whitespace-nowrap text-xs text-gray-500 align-middle">
        {item.categoryName}
      </td>
      <td className="p-3 max-w-[160px] truncate text-xs align-middle" title={item.vendor_name}>
        {item.vendor_name || '—'}
      </td>
      <td className="p-3 whitespace-nowrap text-xs align-middle">
        {item.department || '—'}
      </td>
      <td className="p-3 font-mono text-center text-gray-900 align-middle">
        {item.pk_in_crt ?? '—'}
      </td>
      <td className="p-3 font-mono text-center text-gray-900 align-middle">
        {item.crt_in_case ?? '—'}
      </td>
      <td className="p-3 align-middle">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${item.allow_cycle_count ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
          {item.allow_cycle_count ? 'Yes' : 'No'}
        </span>
      </td>
      <td className="p-3 whitespace-nowrap text-xs text-gray-400 align-middle">
        {item.price_group || '—'}
      </td>
      <td className="p-3 whitespace-nowrap text-xs text-gray-400 align-middle">
        {item.promo_group || '—'}
      </td>
      <td className="p-3 font-mono text-xs text-right pr-6 align-middle">
        {item.on_hand_qty ? Number(item.on_hand_qty).toFixed(2) : '0.00'}
      </td>
    </tr>
  )
})
ItemRow.displayName = 'ItemRow'

function RouteComponent() {
  const { selectedSite } = useSite()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [site, setSite] = useState<string>(selectedSite || user?.location || "")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [items, setItems] = useState<ItemBkRow[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})
  const [isMassEditOpen, setIsMassEditOpen] = useState<boolean>(false)
  const [showMassEditConfirm, setShowMassEditConfirm] = useState<boolean>(false)
  const [isUpdating, setIsUpdating] = useState<boolean>(false)

  const [editForm, setEditForm] = useState<MassEditPayload>({
    allow_cycle_count: null,
    grade: null,
    pk_in_crt: null,
    crt_in_case: null,
  })

  // Advanced Filtering States
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState<boolean>(false)
  const [selectedFilterColumn, setSelectedFilterColumn] = useState<FilterKey>('categoryName')
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({})

  useEffect(() => {
    if (!site) return

    async function fetchItemBook() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/cycle-count/item-bk?site=${encodeURIComponent(site)}`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
            "X-Required-Permission": "cycleCount.manageCount",
          }
        });
        if (res.status === 403) { navigate({ to: "/no-access" }); return; }
        if (res.ok) {
          const data = await res.json()
          setItems(data.items || [])
        }
      } catch (err) {
        console.error("Error loading items database context:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchItemBook()
    setSelectedIds([])
    setCollapsedCategories({})
    setActiveFilters({})
  }, [site])

  const handleToggleRow = useCallback((id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    )
  }, [])

  const uniqueValuesForSelectedColumn = useMemo(() => {
    const valuesSet = new Set<string>()
    items.forEach(item => {
      let val = item[selectedFilterColumn]
      if (val === null || val === undefined || val === '') {
        val = '—'
      } else if (typeof val === 'boolean') {
        val = val ? 'Yes' : 'No'
      }
      valuesSet.add(String(val))
    })
    return Array.from(valuesSet).sort((a, b) => a.localeCompare(b))
  }, [items, selectedFilterColumn])

  const handleToggleFilterValue = (column: string, value: string) => {
    setActiveFilters(prev => {
      const currentValues = prev[column] || []
      let updatedValues: string[]

      if (currentValues.includes(value)) {
        updatedValues = currentValues.filter(v => v !== value)
      } else {
        updatedValues = [...currentValues, value]
      }

      const copy = { ...prev }
      if (updatedValues.length === 0) {
        delete copy[column]
      } else {
        copy[column] = updatedValues
      }
      return copy
    })
  }

  const handleResetAllFilters = () => {
    setActiveFilters({})
    setSearchQuery("")
  }

  const isFilteringActive = useMemo(() => {
    return Object.keys(activeFilters).length > 0 || searchQuery.trim().length > 0
  }, [activeFilters, searchQuery])

  const { groupedItems, filteredItemCount, allFilteredIds } = useMemo(() => {
    const cleanQuery = searchQuery.trim().toLowerCase()

    const filtered = items.filter(item => {
      if (cleanQuery) {
        const targetName = (item.description || "").toLowerCase()
        const targetBarcode = (item.upc_barcode || item.upc || "").toLowerCase()
        if (!targetName.includes(cleanQuery) && !targetBarcode.includes(cleanQuery)) {
          return false
        }
      }

      for (const [colKey, allowedValues] of Object.entries(activeFilters)) {
        let rawVal = item[colKey as keyof ItemBkRow]
        let mappedStr = ''

        if (rawVal === null || rawVal === undefined || rawVal === '') {
          mappedStr = '—'
        } else if (typeof rawVal === 'boolean') {
          mappedStr = rawVal ? 'Yes' : 'No'
        } else {
          mappedStr = String(rawVal)
        }

        if (!allowedValues.includes(mappedStr)) {
          return false
        }
      }

      return true
    })

    const groups: Record<string, ItemBkRow[]> = {}
    const filteredIds: number[] = []

    filtered.forEach(item => {
      filteredIds.push(item.id)
      const catName = item.categoryName || 'Uncategorized'
      if (!groups[catName]) {
        groups[catName] = []
      }
      groups[catName].push(item)
    })

    return {
      groupedItems: groups,
      filteredItemCount: filtered.length,
      allFilteredIds: filteredIds
    }
  }, [items, searchQuery, activeFilters])

  const handleToggleSelectAll = () => {
    if (selectedIds.length === allFilteredIds.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(allFilteredIds)
    }
  }

  const toggleCategoryCollapse = (catName: string) => {
    setCollapsedCategories(prev => ({ ...prev, [catName]: !prev[catName] }))
  }

  const handleCloseMassEdit = () => {
    setIsMassEditOpen(false)
    setShowMassEditConfirm(false)
    setEditForm({ allow_cycle_count: null, grade: null, pk_in_crt: null, crt_in_case: null })
  }

  const handleExecuteMassEdit = async () => {
    setIsUpdating(true)
    try {
      const res = await fetch('/api/cycle-count/item-bk/mass-edit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem("token") || ""}`,
          'X-Required-Permission': 'cycleCount.manageCount',
        },
        body: JSON.stringify({
          ids: selectedIds,
          updates: Object.fromEntries(
            Object.entries(editForm).filter(([_, v]) => v !== null)
          )
        })
      })

      if (res.status === 403) {
        navigate({ to: "/no-access" })
        return
      }

      if (res.ok) {
        const updatedRes = await fetch(`/api/cycle-count/item-bk?site=${encodeURIComponent(site)}`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
            "X-Required-Permission": "cycleCount.manageCount",
          }
        });
        if (updatedRes.status === 403) { navigate({ to: "/no-access" }); return; }
        if (updatedRes.ok) {
          const data = await updatedRes.json()
          setItems(data.items || [])
        }
        setSelectedIds([])
        handleCloseMassEdit()
      } else {
        const errData = await res.json()
        alert(`Update failed: ${errData.message || 'Unknown Server Error'}`)
      }
    } catch (err) {
      console.error("Critical failure updating bulk items:", err)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="flex flex-col w-full h-full bg-white relative">

      {/* TOP CONTROL BAR HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b bg-white shrink-0">
        <div className="flex items-center gap-4 flex-1 min-w-[300px]">
          <div className="w-64">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Active Site</label>
            <LocationPicker setStationName={setSite} value="stationName" defaultValue={site} />
          </div>

          <div className="flex-1 max-w-md relative mt-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search description or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Action Controls Menu */}
        <div className="flex items-center gap-2 mt-5">
          <button
            onClick={() => setIsFilterDialogOpen(true)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-all ${Object.keys(activeFilters).length > 0
              ? 'bg-blue-50 border-blue-300 text-blue-600 ring-2 ring-blue-100'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Filters</span>
            {Object.keys(activeFilters).length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[11px] font-bold rounded-full bg-blue-600 text-white">
                {Object.keys(activeFilters).length}
              </span>
            )}
          </button>

          {isFilteringActive && (
            <button
              onClick={handleResetAllFilters}
              className="px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
            >
              Reset Filters
            </button>
          )}

          <button className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            <Download className="h-4 w-4 text-gray-500" />
            <span>Export</span>
          </button>

          <button
            disabled={selectedIds.length === 0}
            onClick={() => setIsMassEditOpen(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${selectedIds.length > 0
              ? 'bg-primary text-primary-foreground hover:opacity-90 cursor-pointer'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
          >
            <Edit3 className="h-4 w-4" />
            <span>Bulk Edit ({selectedIds.length})</span>
          </button>
        </div>
      </div>

      {/* ACTIVE CRITERIA BREADCRUMBS ROW */}
      {Object.keys(activeFilters).length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 py-2 bg-gray-50 border-b items-center">
          <span className="text-xs text-gray-400 mr-1 font-medium">Active criteria:</span>
          {Object.entries(activeFilters).map(([colKey, values]) => {
            const matchedCol = FILTERABLE_COLUMNS.find(c => c.key === colKey)
            return (
              <div key={colKey} className="flex items-center bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                <span className="opacity-70 mr-1">{matchedCol?.label}:</span>
                <span className="max-w-[120px] truncate">{values.join(', ')}</span>
                <button
                  onClick={() => setActiveFilters(prev => {
                    const copy = { ...prev }; delete copy[colKey]; return copy;
                  })}
                  className="ml-1.5 p-0.5 hover:bg-blue-100 rounded text-blue-500 hover:text-blue-800 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* MAIN DATA WORKSPACE CONTAINER */}
      <div className="flex-1 overflow-auto bg-gray-50/50 p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground font-medium">Processing item layout configuration variables...</p>
          </div>
        ) : filteredItemCount === 0 ? (
          <div className="text-center p-12 border-2 border-dashed bg-white rounded-xl text-gray-400 mt-4">
            No matching items found for current filter criteria.
            <button onClick={handleResetAllFilters} className="block mx-auto mt-2 text-sm text-primary underline font-medium">Clear search constraints</button>
          </div>
        ) : (
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden max-h-[calc(100vh-230px)] relative flex flex-col">
            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-gray-100 text-gray-700 font-semibold sticky top-0 z-20 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                  <tr>
                    <th className="p-3 sticky left-0 bg-gray-100 z-30 w-12 text-center shadow-[2px_0_0_0_rgba(0,0,0,0.05)]">
                      <input
                        type="checkbox"
                        className="rounded accent-primary cursor-pointer h-4 w-4"
                        checked={allFilteredIds.length > 0 && selectedIds.length === allFilteredIds.length}
                        onChange={handleToggleSelectAll}
                      />
                    </th>
                    <th className="p-3 sticky left-12 bg-gray-100 z-30 w-44 shadow-[2px_0_0_0_rgba(0,0,0,0.05)]">UPC Barcode</th>
                    <th className="p-3 sticky left-[224px] bg-gray-100 z-30 min-w-[240px] shadow-[2px_0_0_0_rgba(0,0,0,0.05)]">Description</th>
                    <th className="p-3 whitespace-nowrap">Grade</th>
                    <th className="p-3 whitespace-nowrap">Category Mapping</th>
                    <th className="p-3 whitespace-nowrap">Vendor Name</th>
                    <th className="p-3 whitespace-nowrap">Department</th>
                    <th className="p-3 whitespace-nowrap">Packs in Crt</th>
                    <th className="p-3 whitespace-nowrap">Crt in Case</th>
                    <th className="p-3 whitespace-nowrap">Allow Count</th>
                    <th className="p-3 whitespace-nowrap">Price Group</th>
                    <th className="p-3 whitespace-nowrap">Promo Group</th>
                    <th className="p-3 whitespace-nowrap">On Hand Qty</th>
                  </tr>
                </thead>

                <tbody className="divide-y text-gray-600">
                  {Object.entries(groupedItems).map(([categoryName, categoryRows]) => {
                    const isCollapsed = !!collapsedCategories[categoryName];
                    return (
                      <tr key={categoryName} style={{ display: 'contents' }}>
                        <td colSpan={13} className="p-0">
                          <table className="w-full border-collapse">
                            <tbody>
                              <tr 
                                onClick={() => toggleCategoryCollapse(categoryName)}
                                className="bg-gray-50 hover:bg-gray-100/80 cursor-pointer select-none transition-colors border-y"
                              >
                                <td colSpan={13} className="p-2.5 font-semibold text-gray-800 text-xs tracking-wide uppercase">
                                  <div className="flex items-center gap-2">
                                    {isCollapsed ? <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />}
                                    <span>{categoryName}</span>
                                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-normal lowercase">
                                      {categoryRows.length} {categoryRows.length === 1 ? 'product' : 'products'}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                              {!isCollapsed && categoryRows.map((item) => (
                                <ItemRow key={item.id} item={item} isSelected={selectedIds.includes(item.id)} onToggle={handleToggleRow} />
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* INTERACTIVE MULTI-STAGE FILTER MODAL OVERLAY */}
      {isFilterDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-[520px] mx-4 border">

            {/* Modal Header */}
            <div className="p-4 border-b flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Advanced Data Column Filters</h3>
                <p className="text-xs text-gray-500">Isolate target item parameters across multiple categorical values</p>
              </div>
              <button onClick={() => setIsFilterDialogOpen(false)} className="p-1 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Divided Content Body */}
            <div className="flex-1 flex overflow-hidden">

              {/* STAGE A: Left Sidebar Columns Selector */}
              <div className="w-1/3 border-r bg-gray-50/50 p-2 flex flex-col gap-1 overflow-y-auto">
                <div className="px-2 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Select Column</div>
                {FILTERABLE_COLUMNS.map((col) => {
                  const isCurrent = selectedFilterColumn === col.key
                  const activeCount = activeFilters[col.key]?.length || 0

                  return (
                    <button
                      key={col.key}
                      onClick={() => setSelectedFilterColumn(col.key)}
                      className={`w-full text-left p-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${isCurrent
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'hover:bg-gray-100 text-gray-700'
                        }`}
                    >
                      <span className="truncate mr-1">{col.label}</span>
                      {activeCount > 0 && (
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${isCurrent ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-700'
                          }`}>
                          {activeCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* STAGE B: Right Selection List of Unique Dataset Values */}
              <div className="w-2/3 p-4 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    Available Matches ({uniqueValuesForSelectedColumn.length})
                  </div>
                  {(activeFilters[selectedFilterColumn]?.length || 0) > 0 && (
                    <button
                      onClick={() => setActiveFilters(prev => { const c = { ...prev }; delete c[selectedFilterColumn]; return c; })}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Clear active column values
                    </button>
                  )}
                </div>

                <div className="flex-1 border rounded-lg bg-gray-50/30 overflow-y-auto divide-y">
                  {uniqueValuesForSelectedColumn.map((value) => {
                    const isChecked = (activeFilters[selectedFilterColumn] || []).includes(value)

                    return (
                      <label
                        key={value}
                        className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 cursor-pointer select-none text-xs text-gray-700 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleFilterValue(selectedFilterColumn, value)}
                            className="rounded accent-blue-600 h-4 w-4 cursor-pointer shrink-0"
                          />
                          <span className="font-medium text-gray-900 truncate">{value}</span>
                        </div>
                        {isChecked && <Check className="h-4 w-4 text-blue-600 shrink-0 ml-2" />}
                      </label>
                    )
                  })}
                </div>
              </div>

            </div>

            {/* Modal Footer Controls */}
            <div className="p-3 border-t bg-gray-50 flex items-center justify-between shrink-0">
              <button
                onClick={handleResetAllFilters}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 transition-colors"
              >
                Reset All System Filters
              </button>
              <button
                onClick={() => setIsFilterDialogOpen(false)}
                className="px-5 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-white font-medium text-xs shadow-sm transition-colors"
              >
                Apply Constraints ({allFilteredIds.length} items passing)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* BULK EDIT DIALOG OVERLAY */}
      {isMassEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col mx-4 border max-h-[90vh]">

            {/* Modal Title Banner */}
            <div className="p-4 border-b flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Bulk Edit Selection Matrix</h3>
                <p className="text-xs text-gray-500">Modifying <span className="font-semibold text-blue-600">{selectedIds.length}</span> active row selections concurrently</p>
              </div>
              <button onClick={handleCloseMassEdit} className="p-1 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!showMassEditConfirm ? (
              <>
                {/* Main Edit Parameters Panels */}
                <div className="flex-1 overflow-y-auto p-4 space-y-5">

                  {/* Section 1: Cycle Count Eligibility */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">1. Allow Cycle Count Status</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditForm(p => ({ ...p, allow_cycle_count: true }))}
                        className={`p-2.5 border rounded-lg text-xs font-semibold transition-all ${editForm.allow_cycle_count === true ? 'bg-green-50 border-green-500 text-green-700 ring-2 ring-green-100' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
                      >
                        Enable Counting (Yes)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditForm(p => ({ ...p, allow_cycle_count: false }))}
                        className={`p-2.5 border rounded-lg text-xs font-semibold transition-all ${editForm.allow_cycle_count === false ? 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-100' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
                      >
                        Disable Counting (No)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditForm(p => ({ ...p, allow_cycle_count: null }))}
                        className={`p-2.5 border border-dashed rounded-lg text-xs font-medium text-gray-400 hover:bg-gray-50 ${editForm.allow_cycle_count === null ? 'bg-gray-50 border-gray-300 text-gray-600' : ''}`}
                      >
                        Leave Unchanged
                      </button>
                    </div>
                  </div>

                  {/* Section 2: Product Velocity Classification Grade */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">2. Target Product Grade</label>
                    <div className="grid grid-cols-4 gap-2">
                      {['A', 'B', 'C'].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setEditForm(p => ({ ...p, grade: g }))}
                          className={`p-2.5 border rounded-lg text-xs font-bold transition-all ${editForm.grade === g ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
                        >
                          Grade {g}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEditForm(p => ({ ...p, grade: null }))}
                        className={`p-2.5 border border-dashed rounded-lg text-xs font-medium text-gray-400 hover:bg-gray-50 ${editForm.grade === null ? 'bg-gray-50 border-gray-300 text-gray-600' : ''}`}
                      >
                        Unchanged
                      </button>
                    </div>
                  </div>

                  {/* Section 3: Ratio Controls (Packs in Crt & Crts in Case) */}
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">3. Packs in Crt</label>
                      <input
                        type="number"
                        placeholder="Keep existing values"
                        value={editForm.pk_in_crt ?? ""}
                        onChange={(e) => setEditForm(p => ({ ...p, pk_in_crt: e.target.value === "" ? null : parseInt(e.target.value, 10) }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-gray-50/50 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">4. Crt in Case</label>
                      <input
                        type="number"
                        placeholder="Keep existing values"
                        value={editForm.crt_in_case ?? ""}
                        onChange={(e) => setEditForm(p => ({ ...p, crt_in_case: e.target.value === "" ? null : parseInt(e.target.value, 10) }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-gray-50/50 focus:bg-white"
                      />
                    </div>
                  </div>

                </div>

                {/* Main Edit Operational Footer Buttons */}
                <div className="p-3 border-t bg-gray-50 flex items-center justify-end gap-2 shrink-0">
                  <button
                    onClick={handleCloseMassEdit}
                    className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-100 text-xs font-medium bg-white transition-colors"
                  >
                    Cancel Action
                  </button>
                  <button
                    type="button"
                    disabled={Object.values(editForm).every(val => val === null)}
                    onClick={() => setShowMassEditConfirm(true)}
                    className={`px-5 py-2 rounded-lg font-semibold text-xs text-white shadow-sm transition-all ${
                      Object.values(editForm).every(val => val === null)
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-primary hover:opacity-95'
                    }`}
                  >
                    Review Target Modifications
                  </button>
                </div>
              </>
            ) : (
              /* STAGE 2: CONFIRMATION STAGE SCREEN VIEW */
              <>
                <div className="flex-1 p-6 space-y-4">
                  <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm">Dangerous Write Operations Warning</h4>
                      <p className="text-xs text-amber-800 leading-relaxed mt-0.5">
                        You are explicitly re-writing structural fields across <strong>{selectedIds.length}</strong> items simultaneously. 
                        This action cannot be cleanly undone from this view.
                      </p>
                    </div>
                  </div>

                  <div className="border rounded-xl overflow-hidden bg-gray-50/50">
                    <div className="px-4 py-2 bg-gray-100 border-b text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Staged Payload Summary
                    </div>
                    <div className="p-4 space-y-2.5 text-xs text-gray-700">
                      {editForm.allow_cycle_count !== null && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 font-medium">Allow Cycle Count:</span>
                          <span className={`font-bold px-2 py-0.5 rounded ${editForm.allow_cycle_count ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {editForm.allow_cycle_count ? 'Enabled (Yes)' : 'Disabled (No)'}
                          </span>
                        </div>
                      )}
                      {editForm.grade !== null && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 font-medium">Reclassify Grade:</span>
                          <span className="font-bold border px-2 py-0.5 rounded bg-white">Grade {editForm.grade}</span>
                        </div>
                      )}
                      {editForm.pk_in_crt !== null && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 font-medium">Overwrite Packs in Crt:</span>
                          <span className="font-mono font-bold text-gray-900">{editForm.pk_in_crt}</span>
                        </div>
                      )}
                      {editForm.crt_in_case !== null && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 font-medium">Overwrite Crts in Case:</span>
                          <span className="font-mono font-bold text-gray-900">{editForm.crt_in_case}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Final Action Submission Bar */}
                <div className="p-3 border-t bg-gray-50 flex items-center justify-between shrink-0">
                  <button
                    disabled={isUpdating}
                    onClick={() => setShowMassEditConfirm(false)}
                    className="px-4 py-2 rounded-lg border text-gray-600 hover:bg-gray-100 bg-white text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    Back to Edit Form
                  </button>
                  <button
                    disabled={isUpdating}
                    onClick={handleExecuteMassEdit}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm transition-colors disabled:opacity-50"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Synchronizing Storage Matrix...</span>
                      </>
                    ) : (
                      <span>Commit Bulk Update Changes ({selectedIds.length})</span>
                    )}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  )
}