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
import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react'
import { Search, SlidersHorizontal, Edit3, AlertTriangle, Loader2, ChevronDown, ChevronRight, X, Check, Image as ImageIcon, Barcode as BarcodeIcon } from 'lucide-react'
import { useSite } from '@/context/SiteContext'
import { LocationPicker } from '@/components/custom/locationPicker'
import { useAuth } from "@/context/AuthContext"
import { Dialog, DialogContent } from '@/components/ui/dialog'
import * as XLSX from "xlsx";
import { FileSpreadsheet } from "lucide-react"
import Barcode from 'react-barcode'

export const Route = createFileRoute('/_navbarLayout/cycle-count/manage/item-bk')({
  component: RouteComponent,
})

const gradeStyles: Record<string, string> = {
  A: 'bg-blue-50/40 hover:bg-blue-50/70 border-l-4 border-l-blue-500',
  B: 'bg-amber-50/30 hover:bg-amber-50/60 border-l-4 border-l-amber-500',
  C: 'bg-green-50/30 hover:bg-green-50/60 border-l-4 border-l-green-500',
}

interface ItemBkRow {
  id: number
  upc_barcode: string
  upc: string
  gtin: string | null
  description: string
  category_id: number | string | null
  categoryName: string
  vendor_name: string
  department: string
  price_group: string
  promo_group: string
  grade: string
  allow_cycle_count: boolean
  is_active: boolean | null
  pk_in_crt: number | null
  crt_in_case: number | null
  on_hand_qty: string | number | null
  retail: string | number | null
  last_counted_at: string | null
  last_inv_date: string | null
  image_url: string | null
}

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

const badgeGradeStyles: Record<string, string> = {
  A: 'bg-blue-100 text-blue-800 border-blue-200',
  B: 'bg-amber-100 text-amber-800 border-amber-200',
  C: 'bg-green-100 text-green-800 border-green-200',
}

const frozenGradeBgStyles: Record<string, string> = {
  A: 'bg-[#ebedff]', // Matches blue-50 base row color
  B: 'bg-[#fffbeb]', // Matches amber-50 base row color
  C: 'bg-[#f0fdf4]', // Matches green-50 base row color
}

const VIRTUAL_ROW_HEIGHT = 58
const VIRTUAL_OVERSCAN = 12

const formatDateValue = (value: string | null) => value ? new Date(value).toLocaleDateString() : '-'

// High performance memoized row element explicitly processing explicit cell distributions
const ItemRow = memo(({
  item,
  isSelected,
  onToggle,
  onOpenBarcode
}: {
  item: ItemBkRow;
  isSelected: boolean;
  onToggle: (id: number) => void;
  onOpenBarcode: (name: string, upc: string, image: string | null) => void;
}) => {
  const qty = Number(item.on_hand_qty || 0);
  const isCriticalQty = qty <= 0;

  const baseGradeClass = gradeStyles[item.grade] || (isCriticalQty ? 'bg-rose-50/40 hover:bg-rose-50' : 'hover:bg-gray-50')
  const gradeClass = isSelected ? '!bg-primary/5 transition-colors' : baseGradeClass

  const frozenBgClass = isSelected
    ? '!bg-primary/5'
    : (frozenGradeBgStyles[item.grade] || (isCriticalQty ? 'bg-[#fff5f5]' : 'bg-white'))

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

  return (
    <tr className={`${gradeClass} ${isCriticalQty ? 'ring-1 ring-rose-100 ring-inset' : ''} group`}>

      {/* 1. FREEZED CHECKBOX CONTAINER */}
      <td className={`p-3 sticky left-0 z-10 text-center align-middle w-12 text-gray-900 transition-colors ${frozenBgClass} ${borderClass} group-hover:bg-gray-100/50`}>
        <input
          type="checkbox"
          className="rounded accent-primary cursor-pointer h-4 w-4"
          checked={isSelected}
          onChange={() => onToggle(item.id)}
        />
      </td>

      {/* 2. FREEZED LOGISTICS IMAGE (Width matches the header offset) */}
      <td className={`p-2 sticky left-[48px] z-10 align-middle text-center w-14 transition-colors ${frozenBgClass} group-hover:bg-gray-100/50`}>
        <div className="w-9 h-9 rounded-lg bg-gray-100/60 flex-shrink-0 overflow-hidden border border-gray-200/80 mx-auto">
          {item.image_url ? (
            <img src={item.image_url} alt={item.description} loading="lazy" decoding="async" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <ImageIcon className="w-4 h-4 opacity-30" />
            </div>
          )}
        </div>
      </td>

      {/* 3. FREEZED INTERACTIVE UPC MONO DIALOG (Width matches the header offset) */}
      <td className={`p-3 sticky left-[104px] z-10 font-mono text-xs align-middle w-36 transition-colors ${frozenBgClass} group-hover:bg-gray-100/50`}>
        <button
          type="button"
          onClick={() => onOpenBarcode(item.description, barcode, item.image_url)}
          className="flex items-center gap-1 text-xs font-mono text-blue-600 hover:bg-blue-100/50 px-1.5 py-0.5 rounded transition-colors text-left truncate w-full"
        >
          <BarcodeIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="font-bold truncate">{barcode}</span>
        </button>
      </td>

      {/* 4. FREEZED COMPACT DESCRIPTION COLUMN (Shadow edge added, text truncation applied) */}
      <td className={`p-3 sticky left-[248px] z-10 font-medium text-gray-900 align-middle w-54 shadow-[4px_0_8px_-3px_rgba(0,0,0,0.12)] transition-colors ${frozenBgClass} group-hover:bg-gray-100/50`} title={item.description}>
        <div className="line-clamp-2 text-xs leading-tight break-words font-medium">
          {item.description}
        </div>
      </td>

      {/* 7. CRITICAL HIGHLIGHTED QUANTITY FIELD */}
      <td className="p-3 font-mono align-middle text-right pr-4 w-24">
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

      {/* 5. SCROLLABLE LOGISTICS PARAMETERS (Grade Badge) */}
      <td className="p-3 align-middle w-24 pl-5">
        <span className={`px-2 py-0.5 rounded text-xs font-bold border shadow-sm whitespace-nowrap tracking-wide ${badgeGradeStyles[item.grade] || 'bg-white border-gray-200'}`}>
          Grade {item.grade || '—'}
        </span>
      </td>

      {/* 6. ADDITIONAL SCROLLABLE DATA COLUMNS WITH MATCHED WIDTHS */}
      <td className="p-3 font-mono text-xs text-gray-500 align-left w-36 truncate" title={item.gtin || ''}>
        {item.gtin || '—'}
      </td>
      <td className="p-3 font-mono text-xs text-gray-900 font-bold align-middle text-right w-24">
        {item.retail ? `${Number(item.retail).toFixed(2)}` : '—'}
      </td>
      <td className="p-3 font-mono text-xs text-gray-400 text-center align-middle w-20">
        {item.category_id ?? '—'}
      </td>
      <td className="p-3 text-xs text-gray-700 font-medium align-left w-48" title={item.categoryName || ''}>
        {item.categoryName || '—'}
      </td>
      <td className="p-3 align-middle text-center w-32">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${item.allow_cycle_count ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {item.allow_cycle_count ? 'Yes' : 'No'}
        </span>
      </td>
      <td className="p-3 text-xs text-gray-500 align-left w-44 truncate" title={item.vendor_name || ''}>
        {item.vendor_name || '—'}
      </td>
      <td className="p-3 text-xs text-gray-500 align-left w-44 truncate" title={item.department || ''}>
        {item.department || '—'}
      </td>
      <td className="p-3 align-middle text-center w-24">
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${item.is_active !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
          {item.is_active !== false ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="p-3 font-mono text-xs text-gray-400 text-center align-middle w-32">
        {formatDateValue(item.last_counted_at)}
      </td>
      <td className="p-3 font-mono text-xs text-gray-400 text-center align-middle w-32">
        {formatDateValue(item.last_inv_date)}
      </td>
      <td className="p-3 text-xs text-gray-400 align-left w-44 truncate" title={item.price_group || ''}>
        {item.price_group || '—'}
      </td>
      <td className="p-3 text-xs text-gray-400 align-left w-44 truncate" title={item.promo_group || ''}>
        {item.promo_group || '—'}
      </td>

      <td className="p-3 font-mono text-center text-gray-900 align-middle font-semibold w-28">
        {item.pk_in_crt ?? '—'}
      </td>
      <td className="p-3 font-mono text-center text-gray-900 align-middle font-semibold w-28">
        {item.crt_in_case ?? '—'}
      </td>
    </tr>
  )
})
ItemRow.displayName = 'ItemRow'

function RouteComponent() {
  const { selectedSite } = useSite()
  const { user } = useAuth()
  const navigate = useNavigate()
  const tableScrollRef = useRef<HTMLDivElement | null>(null)
  const [site, setSite] = useState<string>(selectedSite || user?.location || "")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>("")
  const [items, setItems] = useState<ItemBkRow[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(650)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})
  const [isMassEditOpen, setIsMassEditOpen] = useState<boolean>(false)
  const [showMassEditConfirm, setShowMassEditConfirm] = useState<boolean>(false)
  const [isUpdating, setIsUpdating] = useState<boolean>(false)
  // Fast Barcode Isolation References
  const [activeBarcodeItem, setActiveBarcodeItem] = useState<{ name: string; upc: string; image: string | null } | null>(null)

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
    const timeout = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [searchQuery])

  useEffect(() => {
    const scrollEl = tableScrollRef.current
    if (!scrollEl) return

    const updateViewportHeight = () => setViewportHeight(scrollEl.clientHeight || 650)
    updateViewportHeight()

    const resizeObserver = new ResizeObserver(updateViewportHeight)
    resizeObserver.observe(scrollEl)

    return () => resizeObserver.disconnect()
  }, [])

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

  // Instantly map triggers to lightweight state signatures
  const handleOpenBarcodeDialog = useCallback((name: string, upc: string, image: string | null) => {
    setActiveBarcodeItem({ name, upc, image })
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
    const cleanQuery = debouncedSearchQuery.trim().toLowerCase()

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
  }, [items, debouncedSearchQuery, activeFilters])

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const virtualRows = useMemo(() => {
    return Object.entries(groupedItems).flatMap(([categoryName, categoryRows]) => {
      const rows: Array<
        | { type: 'category'; categoryName: string; categoryRows: ItemBkRow[] }
        | { type: 'item'; item: ItemBkRow }
      > = [{ type: 'category', categoryName, categoryRows }]

      if (!collapsedCategories[categoryName]) {
        rows.push(...categoryRows.map(item => ({ type: 'item' as const, item })))
      }

      return rows
    })
  }, [groupedItems, collapsedCategories])

  const virtualStartIndex = Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN)
  const virtualEndIndex = Math.min(
    virtualRows.length,
    Math.ceil((scrollTop + viewportHeight) / VIRTUAL_ROW_HEIGHT) + VIRTUAL_OVERSCAN
  )
  const visibleVirtualRows = virtualRows.slice(virtualStartIndex, virtualEndIndex)
  const topSpacerHeight = virtualStartIndex * VIRTUAL_ROW_HEIGHT
  const bottomSpacerHeight = Math.max(0, (virtualRows.length - virtualEndIndex) * VIRTUAL_ROW_HEIGHT)

  useEffect(() => {
    setScrollTop(0)
    tableScrollRef.current?.scrollTo({ top: 0 })
  }, [debouncedSearchQuery, activeFilters, site])

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

  const exportToExcel = () => {
    // Flatten your filtered/grouped items to pass to the sheet mapping
    const itemsToExport = Object.values(groupedItems).flat();

    if (!itemsToExport.length) return;

    // Map database keys to clean, human-readable Excel headers
    const data = itemsToExport.map(item => {
      const qty = Number(item.on_hand_qty || 0);
      const barcode = item.upc_barcode || item.upc || "NO UPC";

      return {
        "Barcode/UPC": barcode,
        "Description": item.description || "—",
        "On Hand Qty": qty,
        "Grade": item.grade || "—",
        "GTIN": item.gtin || "—",
        "Retail Price": item.retail ? Number(item.retail) : 0,
        "Category ID": item.category_id ?? "—",
        "Category Name": item.categoryName || "—",
        "Allow Cycle Count": item.allow_cycle_count ? "Yes" : "No",
        "Vendor Name": item.vendor_name || "—",
        "Department": item.department || "—",
        "Status": item.is_active !== false ? "Active" : "Inactive",
        "Last Counted Date": formatDateValue(item.last_counted_at),
        "Last Inventory Date": formatDateValue(item.last_inv_date),
        "Price Group": item.price_group || "—",
        "Promo Group": item.promo_group || "—",
        "Packs In Crt": item.pk_in_crt ?? "—",
        "Crt In Case": item.crt_in_case ?? "—"
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory Metrics");

    // Dynamic naming fallback if site or selectedCategory aren't globally defined in context
    const activeSite = typeof site !== 'undefined' ? site : 'All';

    const fileName = `Inventory_${activeSite}_${new Date().toISOString().split('T')[0]}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="flex flex-col w-full h-full bg-white relative">

      {/* TOP CONTROL BAR HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b bg-white shrink-0">
        <div className="flex flex-wrap items-center gap-4 flex-1 min-w-[300px]">
          <div className="w-64">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Active Site</label>
            <LocationPicker setStationName={setSite} value="stationName" defaultValue={site} />
          </div>

          <div className="flex-1 max-w-xl relative mt-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search description or UPC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* VISUAL LEGEND: GRADES & CRITICAL STOCK */}
          <div className="flex items-center gap-3 bg-gray-50/50 border border-gray-100 rounded-lg px-3 py-1.5 self-end h-[38px]">
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

          <button
            type="button"
            onClick={exportToExcel}
            disabled={Object.values(groupedItems).flat().length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium shadow-sm border border-emerald-700/20 transition-all"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export Excel</span>
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
            <p className="text-sm text-muted-foreground font-medium">Loading Item Price Book....</p>
          </div>
        ) : filteredItemCount === 0 ? (
          <div className="text-center p-12 border-2 border-dashed bg-white rounded-xl text-gray-400 mt-4">
            No matching items found for current filter criteria.
            <button onClick={handleResetAllFilters} className="block mx-auto mt-2 text-sm text-primary underline font-medium">Clear constraints</button>
          </div>
        ) : (
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden max-h-[calc(100vh-230px)] relative flex flex-col">
            <div
              ref={tableScrollRef}
              onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
              className="overflow-auto flex-1"
            >
              <table className="w-full text-left border-collapse text-sm table-fixed">
                <thead className="bg-gray-100 text-gray-700 font-semibold sticky top-0 z-30 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                  <tr>
                    {/* 1. FREEZED HEADER: SELECT ALL BOX */}
                    <th className="p-3 sticky left-0 bg-gray-100 z-40 w-12 text-center">
                      <input
                        type="checkbox"
                        className="rounded accent-primary cursor-pointer h-4 w-4"
                        checked={allFilteredIds.length > 0 && selectedIds.length === allFilteredIds.length}
                        onChange={handleToggleSelectAll}
                      />
                    </th>

                    {/* 2. FREEZED HEADER: IMAGE */}
                    <th className="p-3 sticky left-[48px] bg-gray-100 z-40 text-center w-14">Image</th>

                    {/* 3. FREEZED HEADER: UPC BARCODE */}
                    <th className="p-3 sticky left-[104px] bg-gray-100 z-40 w-36 font-mono">UPC</th>

                    {/* 4. FREEZED HEADER: DESCRIPTION (Width dropped to w-44, matching custom offset tracking) */}
                    <th className="p-3 sticky left-[248px] bg-gray-100 z-40 w-54 shadow-[4px_0_8px_-3px_rgba(0,0,0,0.12)]">Description</th>

                    {/* SCROLLABLE HEADERS WITH SAFE SPACING REFINE VALUES */}
                    {/* SCROLLABLE HEADERS WITH CLAMPED FIXED WIDTHS */}
                    <th className="p-3 text-right pr-4 w-24">On Hand</th>
                    <th className="p-3 w-24 pl-5">Grade</th>
                    <th className="p-3 w-36">GTIN</th>
                    <th className="p-3 text-right w-24">Retail</th>
                    <th className="p-3 text-center w-20">Cat#</th>
                    <th className="p-3 w-48">Category</th>
                    <th className="p-3 text-center w-32">Allow Count</th>
                    <th className="p-3 w-44">Vendor Name</th>
                    <th className="p-3 w-44">Department</th>
                    <th className="p-3 text-center w-24">Status</th>
                    <th className="p-3 text-center w-32">Last Counted</th>
                    <th className="p-3 text-center w-32">Last Inv Date</th>
                    <th className="p-3 w-44">Price Group</th>
                    <th className="p-3 w-44">Promo Group</th>
                    <th className="p-3 text-center w-28">Packs In Crt</th>
                    <th className="p-3 text-center w-28">Crt In Case</th>
                  </tr>
                </thead>

                <tbody className="divide-y text-gray-600">
                  {topSpacerHeight > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={20} style={{ height: topSpacerHeight, padding: 0 }} />
                    </tr>
                  )}
                  {visibleVirtualRows.map((row, index) => {
                    if (row.type === 'category') {
                      const isCollapsed = !!collapsedCategories[row.categoryName]
                      return (
                        <tr
                          key={`category-${row.categoryName}`}
                          onClick={() => toggleCategoryCollapse(row.categoryName)}
                          className="bg-gray-50 hover:bg-gray-100/80 cursor-pointer select-none transition-colors border-y"
                        >
                          <td colSpan={20} className="p-2.5 font-semibold text-gray-800 text-xs tracking-wide uppercase sticky left-0 z-20 bg-gray-50">
                            <div className="flex items-center gap-2">
                              {isCollapsed ? <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />}
                              <span>{row.categoryName}</span>
                              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-normal lowercase">
                                {row.categoryRows.length} {row.categoryRows.length === 1 ? 'product' : 'products'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    return (
                      <ItemRow
                        key={`item-${row.item.id}-${virtualStartIndex + index}`}
                        item={row.item}
                        isSelected={selectedIdSet.has(row.item.id)}
                        onToggle={handleToggleRow}
                        onOpenBarcode={handleOpenBarcodeDialog}
                      />
                    )
                  })}
                  {bottomSpacerHeight > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={20} style={{ height: bottomSpacerHeight, padding: 0 }} />
                    </tr>
                  )}
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

      {/* --- HIGH PERFORMANCE ISOLATED BARCODE ZOOM DIALOG --- */}
      <Dialog open={!!activeBarcodeItem} onOpenChange={(open) => { if (!open) setActiveBarcodeItem(null); }}>
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
                    className={`px-5 py-2 rounded-lg font-semibold text-xs text-white shadow-sm transition-all ${Object.values(editForm).every(val => val === null)
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
