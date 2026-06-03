// import { createFileRoute } from '@tanstack/react-router'
// import { useState, useEffect, useMemo } from 'react'
// import { Edit2, Trash2, Zap, Calendar, X, PlusCircle, RotateCcw, AlertTriangle, FileText, Search } from 'lucide-react'
// import CreatableSelect from 'react-select/creatable'
// import axios from 'axios'

// export const Route = createFileRoute(
//   '/_navbarLayout/fuel-price-management/supplier-discounts',
// )({
//   component: RouteComponent,
// })

// interface SupplierDiscountRow {
//   'Supplier Code': string
//   ' Supplier Item': string
//   'Inventory Item': string
//   'Live_Discounts': number | null
//   'Live_Updated_At': string | null
//   'Stg_Discounts': number | null
//   'Stg_Updated_At': string | null
// }

// interface StagedNewEntry {
//   supplierCode: string
//   supplierItem: string
//   inventoryItem: string
//   discounts: number
// }

// const customSelectStyles = {
//   control: (base: any) => ({
//     ...base,
//     borderRadius: '0.5rem',
//     borderColor: '#e5e7eb',
//     fontSize: '0.875rem',
//     minHeight: '38px',
//     boxShadow: 'none',
//     '&:hover': { borderColor: '#3b82f6' }
//   }),
//   menu: (base: any) => ({ ...base, zIndex: 9999 })
// }

// export function RouteComponent() {
//   const [data, setData] = useState<SupplierDiscountRow[]>([])
//   const [loading, setLoading] = useState(true)
//   const [searchQuery, setSearchQuery] = useState('')

//   // Staging state records for edits/deletions (Points to whichever baseline was currently display-active)
//   const [editedRows, setEditedRows] = useState<Record<string, number>>({})
//   const [deletedRows, setDeletedRows] = useState<Record<string, boolean>>({})

//   // Row Edit Dialog States
//   const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
//   const [activeDialogRow, setActiveDialogRow] = useState<SupplierDiscountRow | null>(null)
//   const [dialogInputValue, setDialogInputValue] = useState('')

//   // Multi-Step Creation Wizard Framework States
//   const [wizardStep, setWizardStep] = useState<'closed' | 'warning' | 'form'>('closed')
//   const [newEntriesList, setNewEntriesList] = useState<StagedNewEntry[]>([])

//   // Schedule Information Modal Confirmation State
//   const [isScheduleConfirmOpen, setIsScheduleConfirmOpen] = useState(false)

//   // Creation Form Input Elements 
//   const [formSupplierCode, setFormSupplierCode] = useState('')
//   const [formSupplierItem, setFormSupplierItem] = useState('')
//   const [formInventoryItem, setFormInventoryItem] = useState('')
//   const [formDiscountValue, setFormDiscountValue] = useState('')

//   const fetchDiscounts = async () => {
//     try {
//       setLoading(true)
//       const res = await axios.get('/api/fuel-pricing/supplier-discounts', {
//         headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
//       })
//       setData(res.data)
//       setEditedRows({})
//       setDeletedRows({})
//     } catch (err) {
//       console.error(err)
//       alert("Failed loading supplier discount mirrors.")
//     } finally {
//       setLoading(false)
//     }
//   }

//   useEffect(() => {
//     fetchDiscounts()
//   }, [])

//   // Helper utility to evaluate if a staged update is active in the current calendar month
//   const isStagedInCurrentMonth = (stgCodeDateStr: string | null) => {
//     if (!stgCodeDateStr) return false
//     try {
//       const date = new Date(stgCodeDateStr)
//       const now = new Date() // Evaluates perfectly relative to your system timeline matrix
//       return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
//     } catch {
//       return false
//     }
//   }

//   // --- SORTING, FILTERING & RE-INDENTING NORMALIZATION ENGINE ---
//   const sortedAndFilteredData = useMemo(() => {
//     const normalizedQuery = searchQuery.replace(/[-\s]/g, '').toUpperCase()

//     const filteredRows = data.filter(row => {
//       if (!normalizedQuery) return true
//       const supplierCodeRaw = row['Supplier Code'] || ''
//       const normalizedCode = supplierCodeRaw.replace(/[-\s]/g, '').toUpperCase()
//       return normalizedCode.includes(normalizedQuery)
//     })

//     return filteredRows.sort((a, b) => {
//       const supplierA = (a['Supplier Code'] || '').trim().toUpperCase()
//       const supplierB = (b['Supplier Code'] || '').trim().toUpperCase()

//       if (supplierA !== supplierB) {
//         return supplierA.localeCompare(supplierB)
//       }

//       // Sort by the latest available date across both records
//       const timeA = Math.max(
//         a['Live_Updated_At'] ? new Date(a['Live_Updated_At']).getTime() : 0,
//         a['Stg_Updated_At'] ? new Date(a['Stg_Updated_At']).getTime() : 0
//       )
//       const timeB = Math.max(
//         b['Live_Updated_At'] ? new Date(b['Live_Updated_At']).getTime() : 0,
//         b['Stg_Updated_At'] ? new Date(b['Stg_Updated_At']).getTime() : 0
//       )

//       return timeB - timeA
//     })
//   }, [data, searchQuery])

//   // Extract lookups based on combined datasets references
//   const uniqueSupplierCodes = useMemo(() => {
//     const codes = data.map(row => row['Supplier Code'].trim())
//     return Array.from(new Set(codes)).sort()
//   }, [data])

//   const uniqueSupplierItems = useMemo(() => {
//     const items = data.map(row => row[' Supplier Item'].trim())
//     return Array.from(new Set(items)).sort()
//   }, [data])

//   const contextualInventoryItems = useMemo(() => {
//     if (!formSupplierItem) return []
//     const filtered = data.filter(row => row[' Supplier Item'].trim() === formSupplierItem)
//     const items = filtered.map(row => row['Inventory Item'].trim())
//     return Array.from(new Set(items)).sort()
//   }, [formSupplierItem, data])

//   const getRowKey = (row: SupplierDiscountRow) => {
//     return `${row['Supplier Code']}-${row[' Supplier Item']}-${row['Inventory Item']}`
//   }

//   // Edit Handlers
//   const openEditDialog = (row: SupplierDiscountRow) => {
//     setActiveDialogRow(row)
//     const currentKey = getRowKey(row)

//     // Default form baseline values prioritizing current Month's Staging updates, falling back to Live records
//     const baselineValue = (row['Stg_Discounts'] !== null && isStagedInCurrentMonth(row['Stg_Updated_At']))
//       ? row['Stg_Discounts']
//       : (row['Live_Discounts'] ?? 0)

//     setDialogInputValue(
//       editedRows[currentKey] !== undefined ? editedRows[currentKey].toString() : baselineValue.toString()
//     )
//     setIsEditDialogOpen(true)
//   }

//   const saveDialogEdit = () => {
//     if (!activeDialogRow) return
//     const numericVal = parseFloat(dialogInputValue)
//     if (isNaN(numericVal)) {
//       alert("Please assign a valid floating calculation value.")
//       return
//     }
//     const currentKey = getRowKey(activeDialogRow)
//     setEditedRows(prev => ({ ...prev, [currentKey]: numericVal }))
//     setIsEditDialogOpen(false)
//     setActiveDialogRow(null)
//   }

//   const toggleRowDeletion = (row: SupplierDiscountRow) => {
//     const currentKey = getRowKey(row)
//     setDeletedRows(prev => ({ ...prev, [currentKey]: !prev[currentKey] }))
//   }

//   // Creation Wizard Methods
//   const resetCreationFormFields = () => {
//     setFormSupplierCode('')
//     setFormSupplierItem('')
//     setFormInventoryItem('')
//     setFormDiscountValue('')
//   }

//   const closeCreationWizard = () => {
//     setWizardStep('closed')
//     setNewEntriesList([])
//     resetCreationFormFields()
//   }

//   const handleAddEntryToStagingList = () => {
//     const discountNum = parseFloat(formDiscountValue)
//     if (!formSupplierCode.trim() || !formSupplierItem || !formInventoryItem || isNaN(discountNum)) {
//       alert("Please ensure all parameters are completed properly before compiling entries.")
//       return
//     }

//     const currentSupCode = formSupplierCode.trim().toUpperCase()
//     const currentSupItem = formSupplierItem.trim().toUpperCase()
//     const currentInvItem = formInventoryItem.trim().toUpperCase()

//     const isStagedDuplicate = newEntriesList.some(
//       e => e.supplierCode.trim().toUpperCase() === currentSupCode &&
//         e.supplierItem.trim().toUpperCase() === currentSupItem &&
//         e.inventoryItem.trim().toUpperCase() === currentInvItem
//     )

//     const isDatabaseDuplicate = data.some(
//       r => r['Supplier Code'].trim().toUpperCase() === currentSupCode &&
//         r[' Supplier Item'].trim().toUpperCase() === currentSupItem &&
//         r['Inventory Item'].trim().toUpperCase() === currentInvItem
//     )

//     if (isStagedDuplicate || isDatabaseDuplicate) {
//       alert("This precise supplier discount configuration mapping already exists in the system records.")
//       return
//     }

//     setNewEntriesList(prev => [...prev, {
//       supplierCode: formSupplierCode.trim().toUpperCase(),
//       supplierItem: formSupplierItem.trim(),
//       inventoryItem: formInventoryItem.trim(),
//       discounts: discountNum
//     }])

//     setFormSupplierItem('')
//     setFormInventoryItem('')
//     setFormDiscountValue('')
//   }

//   const removeStagedItemFromPreview = (index: number) => {
//     setNewEntriesList(prev => prev.filter((_, i) => i !== index))
//   }

//   const handlePushNewEntriesToServer = async () => {
//     if (newEntriesList.length === 0) return
//     try {
//       const res = await axios.post('/api/fuel-pricing/supplier-discounts/batch', {
//         entries: newEntriesList
//       }, {
//         headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
//       })

//       if (res.status === 200) {
//         alert(`Successfully injected ${newEntriesList.length} new records across both live and staging maps.`);
//         closeCreationWizard()
//         await fetchDiscounts()
//       }
//     } catch (err) {
//       console.error(err)
//       alert("Server failure processing creation payloads batch.")
//     }
//   }

//   // Unified global batch processing pipeline handler
//   const handlePushUpdatesBatch = async (isImmediateAction: boolean) => {
//     const updatesPayload = []
//     const deletionsPayload = []

//     for (const row of data) {
//       const key = getRowKey(row)
//       if (deletedRows[key]) {
//         deletionsPayload.push({
//           supplierCode: row['Supplier Code'],
//           supplierItem: row[' Supplier Item'],
//           inventoryItem: row['Inventory Item']
//         })
//       } else if (editedRows[key] !== undefined) {
//         updatesPayload.push({
//           supplierCode: row['Supplier Code'],
//           supplierItem: row[' Supplier Item'],
//           inventoryItem: row['Inventory Item'],
//           discounts: editedRows[key]
//         })
//       }
//     }

//     try {
//       const res = await axios.put('/api/fuel-pricing/supplier-discounts/batch', {
//         updates: updatesPayload,
//         deletions: deletionsPayload,
//         isImmediate: isImmediateAction
//       }, {
//         headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
//       })

//       if (res.status === 200) {
//         alert(isImmediateAction ? "Updates applied immediately to Live environment successfully." : "Updates scheduled into Staging environment successfully.")
//         setIsScheduleConfirmOpen(false)
//         await fetchDiscounts()
//       }
//     } catch (err) {
//       console.error(err)
//       alert("Error occurred committing dataset mutations down to server database.")
//     }
//   }

//   const formatToLocalTime = (utcString: string | null) => {
//     if (!utcString) return '-'
//     try {
//       const dateInstance = new Date(utcString)
//       return dateInstance.toLocaleString(undefined, {
//         year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
//       })
//     } catch {
//       return '-'
//     }
//   }

//   // 1. Dynamic calculation logic for next month's name
//   const scheduledMonthName = useMemo(() => {
//     const nextMonth = new Date()
//     nextMonth.setMonth(nextMonth.getMonth() + 1)
//     return nextMonth.toLocaleString('default', { month: 'long' }) // Returns "July"
//   }, [])

//   const hasPendingChanges = Object.keys(editedRows).length > 0 || Object.keys(deletedRows).filter(k => deletedRows[k]).length > 0
//   const totalStagedCount = Object.keys(editedRows).length + Object.keys(deletedRows).filter(k => deletedRows[k]).length

//   if (loading) {
//     return <div className="p-6 text-sm font-medium text-gray-500 animate-pulse">Loading dual-table discount entries...</div>
//   }

//   return (
//     <div className="flex-1 flex flex-col overflow-hidden p-6 bg-white">
//       {/* HEADER PANEL GRID LAYOUT CONTAINER */}
//       <div className="flex items-end justify-between w-full">
//         <div>
//           <h1 className="text-xl font-bold text-gray-900">Supplier Discounts</h1>
//           <p className="text-xs text-gray-500 mt-1">
//             Dual-mirror pricing manager. Stage shifts immediately or schedule for automated 1st-of-month release cron cycles.
//           </p>
//         </div>

//         {/* RIGHT SIDE LAYER: ADVISORY OVER BUTTONS */}
//         <div className="flex flex-col items-end gap-1.5 shrink-0">
//           {/* DELETION ADVISORY BANNER - POSITIONED ON RIGHT */}
//           <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight text-amber-800 bg-amber-50/70 border border-amber-200/50 px-2.5 py-1 rounded-md">
//             <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
//             <span>Deletions & Creations is applied immediately on live tables</span>
//           </div>

//           {/* CORE ACTION CONTROLS BUTTON BAR */}
//           <div className="flex items-center gap-2">
//             {/* CREATE ROUTE ACTION BUTTON */}
//             <button
//               onClick={() => setWizardStep('warning')}
//               className="flex items-center gap-2 h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-xs cursor-pointer transition-colors"
//             >
//               <PlusCircle className="w-4 h-4" />
//               Create Entry
//             </button>

//             {/* IMMEDIATE ACTION BUTTON */}
//             <button
//               onClick={() => handlePushUpdatesBatch(true)}
//               disabled={!hasPendingChanges}
//               className={`flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg shadow-xs transition-all ${hasPendingChanges
//                 ? 'bg-red-600 text-white hover:bg-red-700 cursor-pointer'
//                 : 'bg-gray-100 text-gray-400 cursor-not-allowed'
//                 }`}
//               title="Commit modifications instantly to production live environment channels."
//             >
//               <Zap className="w-4 h-4" />
//               Apply Immediate ({totalStagedCount})
//             </button>

//             {/* FUTURE SCHEDULED ACTION BUTTON */}
//             <button
//               onClick={() => setIsScheduleConfirmOpen(true)}
//               disabled={!hasPendingChanges}
//               className={`flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg shadow-xs transition-all ${hasPendingChanges
//                 ? 'bg-amber-600 text-white hover:bg-amber-700 cursor-pointer'
//                 : 'bg-gray-100 text-gray-400 cursor-not-allowed'
//                 }`}
//               title={`Stage modifications to activate automatically on the 1st of ${scheduledMonthName}.`}
//             >
//               <Calendar className="w-4 h-4" />
//               Schedule Update: {scheduledMonthName} ({totalStagedCount})
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* NORMALIZED SEARCH QUERY BAR COMPONENT WITH BREATHING SPACE */}
//       <div className="mt-5 mb-4 relative max-w-md w-full shrink-0">
//         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
//           <Search className="w-4 h-4" />
//         </div>
//         <input
//           type="text"
//           placeholder="Search by Supplier Code (e.g., nlpnanon or NLP-NAN-ON)..."
//           className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg bg-white placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-xs"
//           value={searchQuery}
//           onChange={(e) => setSearchQuery(e.target.value)}
//         />
//         {searchQuery && (
//           <button
//             onClick={() => setSearchQuery('')}
//             className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-400 hover:text-gray-600"
//           >
//             Clear
//           </button>
//         )}
//       </div>

//       {/* Dual Table Data Layout Frame */}
//       <div className="flex-1 overflow-auto border border-gray-200 rounded-xl shadow-sm">
//         <table className="w-full text-left border-collapse bg-white">
//           <thead className="bg-gray-50/70 text-gray-700 text-xs font-semibold uppercase tracking-wider sticky top-0 border-b z-10">
//             <tr>
//               <th className="p-4 bg-gray-50/90">Supplier Code</th>
//               <th className="p-4 bg-gray-50/90">Supplier Item</th>
//               <th className="p-4 bg-gray-50/90">Inventory Item</th>
//               <th className="p-3 text-right bg-emerald-50/40 text-emerald-900 border-x">Current Live ($)</th>
//               <th className="p-3 text-right bg-amber-50/40 text-amber-900 border-r">Scheduled ($)</th>
//               <th className="p-4">Live Updated At</th>
//               <th className="p-4">Staged Updated At</th>
//               <th className="p-4">Update Logs</th>
//               <th className="p-4 text-center w-24">Actions</th>
//             </tr>
//           </thead>
//           <tbody className="divide-y divide-gray-100 text-sm">
//             {sortedAndFilteredData.length === 0 ? (
//               <tr>
//                 <td colSpan={8} className="p-8 text-center text-sm text-gray-400 italic">
//                   No supplier record instances matched your query.
//                 </td>
//               </tr>
//             ) : (
//               sortedAndFilteredData.map((row) => {
//                 const rowKey = getRowKey(row)
//                 const isStagedDeleted = !!deletedRows[rowKey]
//                 const hasUnsavedLocalEdit = editedRows[rowKey] !== undefined

//                 // Evaluate if an update is already committed/scheduled in Azure Staging SQL for this month
//                 const hasValidStagingMonth = row['Stg_Updated_At'] !== null && isStagedInCurrentMonth(row['Stg_Updated_At'])
//                 const hasSurchargesDiff = row['Stg_Discounts'] !== row['Live_Discounts']
//                 const isCommittedScheduleActive = hasValidStagingMonth && hasSurchargesDiff

//                 // Layout variables resolution
//                 const liveValue = row['Live_Discounts'] !== null ? row['Live_Discounts'] : 0
//                 const committedStagedValue = isCommittedScheduleActive ? row['Stg_Discounts'] : null

//                 // Row styling priority logic based on work states
//                 let rowClassName = "hover:bg-gray-50/50 text-gray-700 transition-colors"
//                 if (isStagedDeleted) {
//                   rowClassName = "bg-red-50/60 text-gray-400 line-through select-none transition-colors"
//                 } else if (hasUnsavedLocalEdit) {
//                   rowClassName = "bg-amber-50/40 hover:bg-amber-50/70 text-gray-900 transition-colors"
//                 } else if (isCommittedScheduleActive) {
//                   rowClassName = "bg-blue-50/20 hover:bg-blue-50/40 text-gray-900 transition-colors"
//                 }

//                 return (
//                   <tr key={rowKey} className={rowClassName}>
//                     <td className="p-4 font-mono text-xs font-bold text-gray-900">{row['Supplier Code']}</td>
//                     <td className="p-4 text-gray-600">{row[' Supplier Item']}</td>
//                     <td className="p-4 font-medium text-gray-800">{row['Inventory Item']}</td>

//                     {/* 1. CURRENT LIVE COLUMN (Always Stable) */}
//                     <td className="p-3 text-right font-mono font-bold bg-emerald-50/10 text-emerald-700 border-x">
//                       {row['Live_Discounts'] !== null ? row['Live_Discounts'].toFixed(4) : '-'}
//                     </td>

//                     {/* 2. SCHEDULED COLUMN (Only shows items already saved to database) */}
//                     <td className={`p-3 text-right font-mono font-bold bg-amber-50/10 border-r ${isCommittedScheduleActive ? 'text-blue-600 font-semibold' : 'text-gray-400'
//                       }`}>
//                       {committedStagedValue !== null ? committedStagedValue.toFixed(4) : '-'}
//                     </td>

//                     <td className="p-4 text-xs text-gray-400 font-medium">
//                       {formatToLocalTime(row['Live_Updated_At'])}
//                     </td>

//                     <td className={`p-4 text-xs font-medium ${isCommittedScheduleActive ? 'text-blue-500 font-semibold' : 'text-gray-400'}`}>
//                       {formatToLocalTime(row['Stg_Updated_At'])}
//                     </td>

//                     {/* 3. DYNAMIC STATUS LOGS COLUMN (Handles the unsaved work visibility) */}
//                     <td className="p-4 text-center whitespace-nowrap">
//                       {isStagedDeleted && (
//                         <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-700 border border-red-200">
//                           Staged Delete
//                         </span>
//                       )}

//                       {hasUnsavedLocalEdit && !isStagedDeleted && (
//                         <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200 animate-pulse">
//                           Modifying ({(committedStagedValue ?? liveValue).toFixed(4)} → {editedRows[rowKey].toFixed(4)})
//                         </span>
//                       )}

//                       {!isStagedDeleted && !hasUnsavedLocalEdit && isCommittedScheduleActive && (
//                         <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700 border border-blue-200">
//                           Scheduled Change
//                         </span>
//                       )}

//                       {!isStagedDeleted && !hasUnsavedLocalEdit && !isCommittedScheduleActive && (
//                         <span className="text-gray-300 italic text-xs">-</span>
//                       )}
//                     </td>

//                     {/* ACTIONS INTERFACE MATRIX */}
//                     <td className="p-4 text-center">
//                       <div className="flex items-center justify-center gap-1">
//                         <button
//                           onClick={() => openEditDialog(row)}
//                           disabled={isStagedDeleted}
//                           className={`p-1.5 rounded transition-all ${isStagedDeleted ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'
//                             }`}
//                           title="Modify Row Metrics"
//                         >
//                           <Edit2 className="w-4 h-4" />
//                         </button>

//                         <button
//                           onClick={() => toggleRowDeletion(row)}
//                           className={`p-1.5 rounded transition-all ${isStagedDeleted ? 'text-amber-600 hover:bg-amber-50' : 'text-red-600 hover:bg-red-50'
//                             }`}
//                           title={isStagedDeleted ? "Restore Row Structure" : "Mark for Immediate Deletion"}
//                         >
//                           {isStagedDeleted ? <RotateCcw className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
//                         </button>
//                       </div>
//                     </td>
//                   </tr>
//                 )
//               })
//             )}
//           </tbody>
//         </table>
//       </div>

//       {/* DIALOG 1: INLINE ROW EDIT MODAL */}
//       {
//         isEditDialogOpen && activeDialogRow && (
//           <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
//             <div className="bg-white border rounded-xl shadow-2xl w-full max-w-md p-6">
//               <div className="flex justify-between items-center mb-4 pb-2 border-b">
//                 <h3 className="font-bold text-gray-900 text-base">Adjust Discount Metric</h3>
//                 <button onClick={() => setIsEditDialogOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
//               </div>
//               <div className="space-y-2 mb-6 bg-gray-50 p-4 rounded-lg text-xs text-gray-600 border">
//                 <div><span className="font-semibold text-gray-500">Supplier:</span> {activeDialogRow['Supplier Code']}</div>
//                 <div><span className="font-semibold text-gray-500">Item Name:</span> {activeDialogRow[' Supplier Item']}</div>
//                 <div><span className="font-semibold text-gray-500">Inventory Mapping:</span> {activeDialogRow['Inventory Item']}</div>
//               </div>
//               <div className="mb-6">
//                 <label className="block text-sm font-medium text-gray-700 mb-2">Target Change Discount Value</label>
//                 <input
//                   type="number" step="0.0001"
//                   className="w-full p-2.5 border rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
//                   value={dialogInputValue} onChange={(e) => setDialogInputValue(e.target.value)}
//                 />
//               </div>
//               <div className="flex justify-end gap-3">
//                 <button onClick={() => setIsEditDialogOpen(false)} className="px-4 py-2 border text-gray-700 rounded-lg text-sm">Cancel</button>
//                 <button onClick={saveDialogEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Stage Adjustment</button>
//               </div>
//             </div>
//           </div>
//         )
//       }

//       {/* DIALOG 2: STEP A - PRE-REQUISITE CHECK */}
//       {
//         wizardStep === 'warning' && (
//           <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
//             <div className="bg-white border rounded-xl shadow-2xl w-full max-w-md p-6 border-amber-200">
//               <div className="flex items-center gap-3 text-amber-600 mb-4">
//                 <AlertTriangle className="w-8 h-8 shrink-0" />
//                 <h3 className="text-lg font-bold text-gray-900">Pre-requisite Audit Check</h3>
//               </div>
//               <p className="text-sm text-gray-600 leading-relaxed mb-6">
//                 Before introducing a new supplier calculation parameters model, please verify if this custom vendor entity profile has already been formally registered inside your **Bookworks** accounting architecture.
//               </p>
//               <div className="flex justify-end gap-3 border-t pt-4">
//                 <button onClick={closeCreationWizard} className="px-4 py-2 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-lg text-sm font-medium">No, Take Me Back</button>
//                 <button onClick={() => setWizardStep('form')} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm">Yes, Verified</button>
//               </div>
//             </div>
//           </div>
//         )
//       }

//       {/* DIALOG 3: STEP B - BATCH CREATION WORKFLOW FORM CONTROLS */}
//       {
//         wizardStep === 'form' && (
//           <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
//             <div className="bg-white border rounded-xl shadow-2xl w-full max-w-2xl p-6 flex flex-col max-h-[85vh]">
//               <div className="flex justify-between items-center mb-4 pb-2 border-b">
//                 <h3 className="font-bold text-gray-900 text-base">Compile New Discount Parameters</h3>
//                 <button onClick={closeCreationWizard} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
//               </div>

//               <div className="bg-gray-50/70 p-4 border rounded-xl grid grid-cols-2 gap-4 mb-4 text-xs">
//                 <div>
//                   <label className="block font-bold text-gray-600 uppercase mb-1">Supplier Code</label>
//                   <CreatableSelect
//                     isClearable styles={customSelectStyles} placeholder="Select or type entity..."
//                     options={uniqueSupplierCodes.map(c => ({ value: c, label: c }))}
//                     onChange={opt => setFormSupplierCode(opt?.value || '')}
//                     onCreateOption={val => setFormSupplierCode(val.trim().toUpperCase())}
//                     value={formSupplierCode ? { value: formSupplierCode, label: formSupplierCode } : null}
//                   />
//                 </div>

//                 <div>
//                   <label className="block font-bold text-gray-600 uppercase mb-1">Supplier Item</label>
//                   <select
//                     className="w-full p-2 border rounded-lg bg-white h-[38px] text-sm"
//                     value={formSupplierItem}
//                     onChange={(e) => {
//                       setFormSupplierItem(e.target.value)
//                       setFormInventoryItem('')
//                     }}
//                   >
//                     <option value="">-- Choose Item --</option>
//                     {uniqueSupplierItems.map(item => <option key={item} value={item}>{item}</option>)}
//                   </select>
//                 </div>

//                 <div>
//                   <label className="block font-bold text-gray-600 uppercase mb-1">
//                     Inventory Item {!formSupplierItem && <span className="text-red-500 font-normal lowercase">(Select Supplier Item first)</span>}
//                   </label>
//                   <select
//                     className="w-full p-2 border rounded-lg bg-white h-[38px] text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
//                     disabled={!formSupplierItem} value={formInventoryItem} onChange={(e) => setFormInventoryItem(e.target.value)}
//                   >
//                     <option value="">-- Choose Contextual Pair --</option>
//                     {contextualInventoryItems.map(item => <option key={item} value={item}>{item}</option>)}
//                   </select>
//                 </div>

//                 <div>
//                   <label className="block font-bold text-gray-600 uppercase mb-1">Discount Value ($)</label>
//                   <div className="flex gap-2">
//                     <input
//                       type="number" step="0.0001" placeholder="0.0000"
//                       className="w-full p-2 border rounded-lg bg-white font-mono h-[38px] text-sm"
//                       value={formDiscountValue} onChange={(e) => setFormDiscountValue(e.target.value)}
//                     />
//                     <button
//                       onClick={handleAddEntryToStagingList}
//                       className="px-4 py-2 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 shrink-0 h-[38px]"
//                     >
//                       Add To List
//                     </button>
//                   </div>
//                 </div>
//               </div>

//               <div className="flex-1 overflow-auto border rounded-xl p-2 bg-gray-50/30 flex flex-col min-h-[150px] mb-6">
//                 <span className="text-xs font-bold uppercase tracking-wider text-gray-500 px-2 py-1 flex items-center gap-1.5 mb-2">
//                   <FileText className="w-3.5 h-3.5" /> Staging Preview Block Panel ({newEntriesList.length})
//                 </span>

//                 {newEntriesList.length === 0 ? (
//                   <div className="flex-1 flex items-center justify-center text-xs text-gray-400 font-medium italic">No records compiled into local staging collections list yet.</div>
//                 ) : (
//                   <div className="space-y-1.5">
//                     {newEntriesList.map((entry, idx) => (
//                       <div key={idx} className="flex justify-between items-center bg-white border rounded-lg px-3 py-2 text-xs font-medium text-gray-700 shadow-xs">
//                         <div className="grid grid-cols-4 gap-4 flex-1 font-mono">
//                           <span className="truncate font-bold text-gray-900">{entry.supplierCode}</span>
//                           <span className="truncate text-gray-600 font-sans">{entry.supplierItem}</span>
//                           <span className="truncate text-gray-600 font-sans font-medium">{entry.inventoryItem}</span>
//                           <span className="text-right text-emerald-600 font-bold">${entry.discounts.toFixed(4)}</span>
//                         </div>
//                         <button onClick={() => removeStagedItemFromPreview(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded ml-4 transition-colors">
//                           <X className="w-4 h-4" />
//                         </button>
//                       </div>
//                     ))}
//                   </div>
//                 )}
//               </div>

//               <div className="flex justify-between items-center border-t pt-4">
//                 <button onClick={closeCreationWizard} className="px-4 py-2 border text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium">Cancel</button>
//                 <button
//                   onClick={handlePushNewEntriesToServer} disabled={newEntriesList.length === 0}
//                   className={`px-5 py-2 text-sm font-medium rounded-lg shadow-sm transition-all ${newEntriesList.length > 0 ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
//                 >
//                   Create Records ({newEntriesList.length})
//                 </button>
//               </div>
//             </div>
//           </div>
//         )
//       }

//       {/* DIALOG 4: SCHEDULE NEXT MONTH CONFIRMATION WARNING MODAL */}
//       {isScheduleConfirmOpen && (
//         <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
//           <div className="bg-white border rounded-xl shadow-2xl w-full max-w-md p-6 border-amber-200">
//             <div className="flex items-center gap-3 text-amber-500 mb-4">
//               <Calendar className="w-8 h-8 shrink-0" />
//               <h3 className="text-lg font-bold text-gray-900">Confirm Future Scheduled Update</h3>
//             </div>

//             <p className="text-sm text-gray-600 leading-relaxed mb-4">
//               You are queueing <strong className="text-gray-900">{totalStagedCount} total changes</strong> to be written to the pricing tables.
//             </p>

//             {/* DYNAMIC DELETION WARNING: Renders ONLY if there is at least one active deletion operation in the batch */}
//             {Object.keys(deletedRows).filter(k => deletedRows[k]).length > 0 && (
//               <div className="flex items-start gap-2 bg-red-50 text-red-900 border border-red-200 p-3 rounded-lg text-xs leading-relaxed mb-4 font-medium">
//                 <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
//                 <div>
//                   <span className="font-bold uppercase tracking-wider block text-red-700 text-[10px] mb-0.5">Immediate Live Execution Warning</span>
//                   Your pending batch contains active row deletion requests. These specific removal actions bypass staging queues and will execute **immediately** on live production distribution channels upon configuration submission.
//                 </div>
//               </div>
//             )}

//             {/* SCHEDULED UPDATE EXPLANATORY NOTICE */}
//             <div className="bg-amber-50/50 text-amber-900 border border-amber-200/60 p-3 rounded-lg text-xs leading-relaxed mb-6 font-medium">
//               Note: The pricing and baseline rate updates you are making will isolate strictly inside the Staging mirror tables. The automated core system cron runner will compile and apply these updates to live production channels on **1st of {scheduledMonthName}**.
//             </div>

//             <div className="flex justify-end gap-3 border-t pt-4">
//               <button
//                 onClick={() => setIsScheduleConfirmOpen(false)}
//                 className="px-4 py-2 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={() => handlePushUpdatesBatch(false)}
//                 className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors cursor-pointer"
//               >
//                 Confirm & Schedule Release
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div >
//   )
// }

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { Edit2, Trash2, Zap, Calendar, X, PlusCircle, RotateCcw, AlertTriangle, FileText, Search } from 'lucide-react'
import CreatableSelect from 'react-select/creatable'
import axios from 'axios'
import { useAuth } from '@/context/AuthContext'

export const Route = createFileRoute(
  '/_navbarLayout/fuel-settings/supplier-discounts',
)({
  component: RouteComponent,
})

interface SupplierDiscountRow {
  'Supplier Code': string
  ' Supplier Item': string
  'Inventory Item': string
  'Live_Discounts': number | null
  'Live_Updated_At': string | null
  'Stg_Discounts': number | null
  'Stg_Updated_At': string | null
}

interface StagedNewEntry {
  supplierCode: string
  supplierItem: string
  inventoryItem: string
  discounts: number
}

const customSelectStyles = {
  control: (base: any) => ({
    ...base,
    borderRadius: '0.5rem',
    borderColor: '#e5e7eb',
    fontSize: '0.875rem',
    minHeight: '38px',
    boxShadow: 'none',
    '&:hover': { borderColor: '#3b82f6' }
  }),
  menu: (base: any) => ({ ...base, zIndex: 9999 })
}

export function RouteComponent() {
  const { user } = useAuth()
  const access = user?.access || {}
  const canEdit = access?.fuelSettings?.supplierDiscounts?.edit === true;
  const navigate = useNavigate()
  const [data, setData] = useState<SupplierDiscountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Track unsaved work in the current session
  const [editedRows, setEditedRows] = useState<Record<string, number>>({})
  const [deletedRows, setDeletedRows] = useState<Record<string, boolean>>({})

  // Modal window visibility states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [activeDialogRow, setActiveDialogRow] = useState<SupplierDiscountRow | null>(null)
  const [dialogInputValue, setDialogInputValue] = useState('')

  const [wizardStep, setWizardStep] = useState<'closed' | 'warning' | 'form'>('closed')
  const [newEntriesList, setNewEntriesList] = useState<StagedNewEntry[]>([])
  const [isScheduleConfirmOpen, setIsScheduleConfirmOpen] = useState(false)
  const [isLiveConfirmOpen, setIsLiveConfirmOpen] = useState(false);


  // Creation form inputs
  const [formSupplierCode, setFormSupplierCode] = useState('')
  const [formSupplierItem, setFormSupplierItem] = useState('')
  // const [formInventoryItem, setFormInventoryItem] = useState('')
  const [formDiscountValue, setFormDiscountValue] = useState('')

  const fetchDiscounts = async () => {
    try {
      setLoading(true)
      const res = await axios.get('/api/fuel-pricing/supplier-discounts', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Required-Permission': 'fuelSettings.supplierDiscounts'
        }
      })
      setData(res.data)
      setEditedRows({})
      setDeletedRows({})
    } catch (err: any) {
      console.error(err)
      if (err.response?.status === 403) {
        navigate({ to: '/no-access' })
        return
      }
      alert("Could not load the discounts from the server. Please refresh the page.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDiscounts()
  }, [])

  // Check if a saved update belongs to the current month
  const isStagedInCurrentMonth = (dateStr: string | null) => {
    if (!dateStr) return false
    try {
      const date = new Date(dateStr)
      const now = new Date()
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    } catch {
      return false
    }
  }

  // --- FILTER AND SORT ENGINE ---
  const sortedAndFilteredData = useMemo(() => {
    const normalizedQuery = searchQuery.replace(/[-\s]/g, '').toUpperCase()

    const filteredRows = data.filter(row => {
      if (!normalizedQuery) return true
      const supplierCodeRaw = row['Supplier Code'] || ''
      const normalizedCode = supplierCodeRaw.replace(/[-\s]/g, '').toUpperCase()
      return normalizedCode.includes(normalizedQuery)
    })

    return filteredRows.sort((a, b) => {
      const supplierA = (a['Supplier Code'] || '').trim().toUpperCase()
      const supplierB = (b['Supplier Code'] || '').trim().toUpperCase()

      if (supplierA !== supplierB) {
        return supplierA.localeCompare(supplierB)
      }

      const timeA = Math.max(
        a['Live_Updated_At'] ? new Date(a['Live_Updated_At']).getTime() : 0,
        a['Stg_Updated_At'] ? new Date(a['Stg_Updated_At']).getTime() : 0
      )
      const timeB = Math.max(
        b['Live_Updated_At'] ? new Date(b['Live_Updated_At']).getTime() : 0,
        b['Stg_Updated_At'] ? new Date(b['Stg_Updated_At']).getTime() : 0
      )

      return timeB - timeA
    })
  }, [data, searchQuery])

  // Dropdown list extractors
  const uniqueSupplierCodes = useMemo(() => {
    const codes = data.map(row => row['Supplier Code'].trim())
    return Array.from(new Set(codes)).sort()
  }, [data])

  // const uniqueSupplierItems = useMemo(() => {
  //   const items = data.map(row => row[' Supplier Item'].trim())
  //   return Array.from(new Set(items)).sort()
  // }, [data])

  // const contextualInventoryItems = useMemo(() => {
  //   if (!formSupplierItem) return []
  //   const filtered = data.filter(row => row[' Supplier Item'].trim() === formSupplierItem)
  //   const items = filtered.map(row => row['Inventory Item'].trim())
  //   return Array.from(new Set(items)).sort()
  // }, [formSupplierItem, data])

  const getRowKey = (row: SupplierDiscountRow) => {
    return `${row['Supplier Code']}-${row[' Supplier Item']}-${row['Inventory Item']}`
  }

  // Edit Handlers
  const openEditDialog = (row: SupplierDiscountRow) => {
    setActiveDialogRow(row)
    const currentKey = getRowKey(row)

    // Default to scheduled price if one exists from this month, otherwise show live price
    const baselineValue = (row['Stg_Discounts'] !== null && isStagedInCurrentMonth(row['Stg_Updated_At']))
      ? row['Stg_Discounts']
      : (row['Live_Discounts'] ?? 0)

    setDialogInputValue(
      editedRows[currentKey] !== undefined ? editedRows[currentKey].toString() : baselineValue.toString()
    )
    setIsEditDialogOpen(true)
  }

  const saveDialogEdit = () => {
    if (!activeDialogRow) return
    const numericVal = parseFloat(dialogInputValue)
    if (isNaN(numericVal)) {
      alert("Please enter a valid number.")
      return
    }
    const currentKey = getRowKey(activeDialogRow)
    setEditedRows(prev => ({ ...prev, [currentKey]: numericVal }))
    setIsEditDialogOpen(false)
    setActiveDialogRow(null)
  }

  const toggleRowDeletion = (row: SupplierDiscountRow) => {
    const currentKey = getRowKey(row)
    setDeletedRows(prev => ({ ...prev, [currentKey]: !prev[currentKey] }))
  }

  // Creation Wizard Methods
  const resetCreationFormFields = () => {
    setFormSupplierCode('')
    setFormSupplierItem('')
    // setFormInventoryItem('')
    setFormDiscountValue('')
  }

  const closeCreationWizard = () => {
    setWizardStep('closed')
    setNewEntriesList([])
    resetCreationFormFields()
  }

  const handleAddEntryToStagingList = () => {
    const discountNum = parseFloat(formDiscountValue);
    const selectedCategory = formSupplierItem; // e.g., "GAS" or "DIESEL & DYED"

    if (!formSupplierCode.trim() || !selectedCategory || isNaN(discountNum)) {
      alert("Please enter a Supplier Code, pick a Fuel Category, and set a price.");
      return;
    }

    // Define the relationship for expansion
    const MAPPING_CONFIG = {
      "GAS": [
        { supplierItem: "GAS", inventoryItem: "RUL87" },
        { supplierItem: "GAS", inventoryItem: "PUL91" }
      ],
      "DIESEL & DYED": [
        { supplierItem: "DIESEL", inventoryItem: "ULSD" },
        { supplierItem: "DIESEL", inventoryItem: "WULSD" },
        { supplierItem: "DYED", inventoryItem: "ULSDD" }
      ]
    };

    // 2. Ensure the category exists in your config
    if (!(selectedCategory in MAPPING_CONFIG)) {
      alert("Invalid fuel category selected.");
      return;
    }

    // Now TypeScript knows selectedCategory is valid
    const itemsToPush = MAPPING_CONFIG[selectedCategory as keyof typeof MAPPING_CONFIG]; const supplierCode = formSupplierCode.trim().toUpperCase();

    let addedCount = 0;

    itemsToPush.forEach((item: any) => {
      // 1. Check for duplicates in staging or existing database
      const isStagedDuplicate = newEntriesList.some(
        e => e.supplierCode === supplierCode &&
          e.supplierItem === item.supplierItem &&
          e.inventoryItem === item.inventoryItem
      );

      const isDatabaseDuplicate = data.some(
        r => r['Supplier Code'].trim().toUpperCase() === supplierCode &&
          r[' Supplier Item'].trim().toUpperCase() === item.supplierItem &&
          r['Inventory Item'].trim().toUpperCase() === item.inventoryItem
      );

      if (!isStagedDuplicate && !isDatabaseDuplicate) {
        setNewEntriesList(prev => [...prev, {
          supplierCode: supplierCode,
          supplierItem: item.supplierItem,
          inventoryItem: item.inventoryItem,
          discounts: discountNum
        }]);
        addedCount++;
      }
    });

    if (addedCount === 0) {
      alert("All items for this category already exist in the list or database.");
    }

    // Reset form fields
    setFormSupplierItem('');
    setFormDiscountValue('');
    // Note: If you keep formInventoryItem in state, reset it here too
    // setFormInventoryItem('');
  };

  const removeStagedItemFromPreview = (index: number) => {
    setNewEntriesList(prev => prev.filter((_, i) => i !== index))
  }

  const handlePushNewEntriesToServer = async () => {
    if (newEntriesList.length === 0) return
    try {
      const res = await axios.post('/api/fuel-pricing/supplier-discounts/batch', {
        entries: newEntriesList
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Required-Permission': 'fuelSettings.supplierDiscounts.edit'
        }
      })

      if (res.status === 200) {
        alert("Successfully added new entries to the table.");
        closeCreationWizard()
        await fetchDiscounts()
      }
    } catch (err: any) {
      console.error(err)
      if (err.response?.status === 403) {
        navigate({ to: '/no-access' })
        return
      }
      alert("Something went wrong on the server. Could not create the records.")
    }
  }

  // Unified Save Changes Handler
  const handlePushUpdatesBatch = async (isImmediateAction: boolean) => {
    const updatesPayload = []
    const deletionsPayload = []

    for (const row of data) {
      const key = getRowKey(row)
      if (deletedRows[key]) {
        deletionsPayload.push({
          supplierCode: row['Supplier Code'],
          supplierItem: row[' Supplier Item'],
          inventoryItem: row['Inventory Item']
        })
      } else if (editedRows[key] !== undefined) {
        updatesPayload.push({
          supplierCode: row['Supplier Code'],
          supplierItem: row[' Supplier Item'],
          inventoryItem: row['Inventory Item'],
          discounts: editedRows[key]
        })
      }
    }

    try {
      const res = await axios.put('/api/fuel-pricing/supplier-discounts/batch', {
        updates: updatesPayload,
        deletions: deletionsPayload,
        isImmediate: isImmediateAction
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Required-Permission': 'fuelSettings.supplierDiscounts.edit'
        }
      })

      if (res.status === 200) {
        alert(isImmediateAction ? "Changes applied live right now!" : "Changes saved and scheduled successfully.")
        setIsScheduleConfirmOpen(false)
        setIsLiveConfirmOpen(false)
        await fetchDiscounts()
      }
    } catch (err: any) {
      console.error(err)
      if (err.response?.status === 403) {
        navigate({ to: '/no-access' })
        return
      }
      alert("Could not save your changes. Please try again.")
    }
  }

  const formatToLocalTime = (utcString: string | null) => {
    if (!utcString) return '-'
    try {
      const dateInstance = new Date(utcString)
      return dateInstance.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
      })
    } catch {
      return '-'
    }
  }

  const hasPendingChanges = Object.keys(editedRows).length > 0 || Object.keys(deletedRows).filter(k => deletedRows[k]).length > 0
  const totalStagedCount = Object.keys(editedRows).length + Object.keys(deletedRows).filter(k => deletedRows[k]).length

  // Calculate next month name dynamically
  const scheduledMonthName = useMemo(() => {
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    return nextMonth.toLocaleString('default', { month: 'long' })
  }, [])

  if (loading) {
    return <div className="p-6 text-sm font-medium text-gray-500 animate-pulse">Loading discount information...</div>
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6 bg-white">

      {/* HEADER ACTION CONTROL INTERFACE LAYOUT */}
      <div className="flex items-end justify-between w-full">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Supplier Discounts</h1>
          <p className="text-xs text-gray-500 mt-1">
            View and Manage your Supplier Discounts here. {canEdit && "You can make updates live right away, or schedule them to go live automatically on the 1st of next month."}
          </p>
        </div>

        {/* CONTROLS CLUSTER */}
        {canEdit && (
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {/* DELETION ADVISORY BANNER */}
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight text-amber-800 bg-amber-50/70 border border-amber-200/50 px-2.5 py-1 rounded-md">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
              <span>Creating and Deleting rows happens instantly live</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setWizardStep('warning')}
                className="flex items-center gap-2 h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-xs cursor-pointer transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                Add New Line
              </button>

              <button
                onClick={() => setIsLiveConfirmOpen(true)}
                disabled={!hasPendingChanges}
                className={`flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg shadow-xs transition-all ${hasPendingChanges
                  ? 'bg-red-600 text-white hover:bg-red-700 cursor-pointer'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
              >
                <Zap className="w-4 h-4" />
                Go Live Now ({totalStagedCount})
              </button>

              <button
                onClick={() => setIsScheduleConfirmOpen(true)}
                disabled={!hasPendingChanges}
                className={`flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg shadow-xs transition-all ${hasPendingChanges
                  ? 'bg-amber-600 text-white hover:bg-amber-700 cursor-pointer'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                title={`Save updates to turn on automatically on the 1st of ${scheduledMonthName}.`}
              >
                <Calendar className="w-4 h-4" />
                Schedule for {scheduledMonthName} ({totalStagedCount})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SEARCH INPUT BAR */}
      <div className="mt-5 mb-4 relative max-w-md w-full shrink-0">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          placeholder="Search by Vendor Code (example: nlpnanon)..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg bg-white placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-xs"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-400 hover:text-gray-600">Clear</button>
        )}
      </div>

      {/* FREIGHT MATRIX DATA TABLE */}
      <div className="flex-1 overflow-auto border border-gray-200 rounded-xl shadow-sm">
        <table className="w-full text-left border-collapse bg-white">
          <thead className="bg-gray-50/70 text-gray-700 text-xs font-semibold uppercase tracking-wider sticky top-0 border-b z-10">
            <tr>
              <th className="p-4 bg-gray-50/90">Supplier Code</th>
              <th className="p-4 bg-gray-50/90">Supplier Item</th>
              <th className="p-4 bg-gray-50/90">Inventory Item</th>
              <th className="p-3 text-right bg-emerald-50/40 text-emerald-900 border-x">Current Discount ($)</th>
              <th className="p-4">Last Updated At</th>
              <th className="p-3 text-right bg-amber-50/40 text-amber-900 border-r">Scheduled Discount ($)</th>
              <th className="p-4">Schedule Last Updated At</th>
              <th className="p-4 text-center">Status Checks</th>
              {canEdit && <th className="p-4 text-center w-24">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {sortedAndFilteredData.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-sm text-gray-400 italic">No records found matching your search.</td>
              </tr>
            ) : (
              sortedAndFilteredData.map((row) => {
                const rowKey = getRowKey(row)
                const isStagedDeleted = !!deletedRows[rowKey]
                const hasUnsavedLocalEdit = editedRows[rowKey] !== undefined

                // Check if there is an active future price already stored on the database server
                const hasValidStagingMonth = row['Stg_Updated_At'] !== null && isStagedInCurrentMonth(row['Stg_Updated_At'])
                const hasSurchargesDiff = row['Stg_Discounts'] !== row['Live_Discounts']
                const isCommittedScheduleActive = hasValidStagingMonth && hasSurchargesDiff

                const liveValue = row['Live_Discounts'] !== null ? row['Live_Discounts'] : 0
                const committedStagedValue = isCommittedScheduleActive ? row['Stg_Discounts'] : null

                let rowClassName = "hover:bg-gray-50/50 text-gray-700 transition-colors"
                if (isStagedDeleted) {
                  rowClassName = "bg-red-50/60 text-gray-400 line-through select-none transition-colors"
                } else if (hasUnsavedLocalEdit) {
                  rowClassName = "bg-amber-50/40 hover:bg-amber-50/70 text-gray-900 transition-colors"
                } else if (isCommittedScheduleActive) {
                  rowClassName = "bg-blue-50/20 hover:bg-blue-50/40 text-gray-900 transition-colors"
                }

                return (
                  <tr key={rowKey} className={rowClassName}>
                    <td className="p-4 font-mono text-xs font-bold text-gray-900">{row['Supplier Code']}</td>
                    <td className="p-4 text-gray-600">{row[' Supplier Item']}</td>
                    <td className="p-4 font-medium text-gray-800">{row['Inventory Item']}</td>

                    {/* LIVE DISPLAY */}
                    <td className="p-3 text-right font-mono font-bold bg-emerald-50/10 text-emerald-700 border-x">
                      {row['Live_Discounts'] !== null ? row['Live_Discounts'].toFixed(4) : '-'}
                    </td>
                    <td className="p-4 text-xs text-gray-400 font-medium">{formatToLocalTime(row['Live_Updated_At'])}</td>

                    {/* FUTURE COMMITTED DISPLAY */}
                    <td className={`p-3 text-right font-mono font-bold bg-amber-50/10 border-r ${isCommittedScheduleActive ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
                      {committedStagedValue !== null ? committedStagedValue.toFixed(4) : '-'}
                    </td>

                    <td className={`p-4 text-xs font-medium ${isCommittedScheduleActive ? 'text-blue-500 font-semibold' : 'text-gray-400'}`}>{formatToLocalTime(row['Stg_Updated_At'])}</td>

                    {/* STATUS BADGES COLUMN */}
                    <td className="p-4 text-center whitespace-nowrap">
                      {isStagedDeleted && (
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-700 border border-red-200">
                          To Be Deleted
                        </span>
                      )}
                      {hasUnsavedLocalEdit && !isStagedDeleted && (
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200 animate-pulse">
                          Changing: ({(committedStagedValue ?? liveValue).toFixed(4)} → {editedRows[rowKey].toFixed(4)})
                        </span>
                      )}
                      {!isStagedDeleted && !hasUnsavedLocalEdit && isCommittedScheduleActive && (
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700 border border-blue-200">
                          Saved for {scheduledMonthName} 1st
                        </span>
                      )}
                      {!isStagedDeleted && !hasUnsavedLocalEdit && !isCommittedScheduleActive && <span className="text-gray-300 italic text-xs">-</span>}
                    </td>

                    {/* ITEM ROW CONTROLS */}
                    {canEdit && (
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditDialog(row)}
                            disabled={isStagedDeleted}
                            className={`p-1.5 rounded transition-all ${isStagedDeleted ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleRowDeletion(row)}
                            className={`p-1.5 rounded transition-all ${isStagedDeleted ? 'text-amber-600 hover:bg-amber-50' : 'text-red-600 hover:bg-red-50'}`}
                          >
                            {isStagedDeleted ? <RotateCcw className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* DIALOG 1: PRICE CHANGE MODAL */}
      {isEditDialogOpen && activeDialogRow && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white border rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <h3 className="font-bold text-gray-900 text-base">Change Discount Value</h3>
              <button onClick={() => setIsEditDialogOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2 mb-6 bg-gray-50 p-4 rounded-lg text-xs text-gray-600 border">
              <div><span className="font-semibold text-gray-500">Supplier:</span> {activeDialogRow['Supplier Code']}</div>
              <div><span className="font-semibold text-gray-500">Item Name:</span> {activeDialogRow[' Supplier Item']}</div>
              <div><span className="font-semibold text-gray-500">Inventory Mapping:</span> {activeDialogRow['Inventory Item']}</div>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Enter New Number Amount</label>
              <input
                type="number" step="0.0001"
                className="w-full p-2.5 border rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
                value={dialogInputValue} onChange={(e) => setDialogInputValue(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsEditDialogOpen(false)} className="px-4 py-2 border text-gray-700 rounded-lg text-sm">Cancel</button>
              <button onClick={saveDialogEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Keep Change</button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG 2: WIZARD STEP 1 - BOOKWORKS SYSTEM AUDIT ALERT */}
      {wizardStep === 'warning' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white border rounded-xl shadow-2xl w-full max-w-md p-6 border-amber-200">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <AlertTriangle className="w-8 h-8 shrink-0" />
              <h3 className="text-lg font-bold text-gray-900">Please Check Bookworks First</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              Before adding a new vendor discount to this dashboard, please double-check that you have already registered and added this vendor profile inside the **Bookworks** system.
            </p>
            <div className="flex justify-end gap-3 border-t pt-4">
              <button onClick={closeCreationWizard} className="px-4 py-2 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-lg text-sm font-medium">No, Go Back</button>
              <button onClick={() => setWizardStep('form')} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm">Yes, It Is Added</button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG 3: WIZARD STEP 2 - ADD MULTIPLE ITEMS FORM */}
      {wizardStep === 'form' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white border rounded-xl shadow-2xl w-full max-w-2xl p-6 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <h3 className="font-bold text-gray-900 text-base">Add New Discount Lines</h3>
              <button onClick={closeCreationWizard} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-gray-50/70 p-4 border rounded-xl grid grid-cols-2 gap-4 mb-4 text-xs">
              <div>
                <label className="block font-bold text-gray-600 uppercase mb-1">Supplier Code</label>
                <CreatableSelect
                  isClearable styles={customSelectStyles} placeholder="Select or type code..."
                  options={uniqueSupplierCodes.map(c => ({ value: c, label: c }))}
                  onChange={opt => setFormSupplierCode(opt?.value || '')}
                  onCreateOption={val => setFormSupplierCode(val.trim().toUpperCase())}
                  value={formSupplierCode ? { value: formSupplierCode, label: formSupplierCode } : null}
                />
              </div>

              {/* Replace your Supplier Item select dropdown with this */}
              <div>
                <label className="block font-bold text-gray-600 uppercase mb-1">Select Fuel Type</label>
                <select
                  className="w-full p-2 border rounded-lg bg-white h-[38px] text-sm"
                  value={formSupplierItem}
                  onChange={(e) => setFormSupplierItem(e.target.value)}
                >
                  <option value="">-- Choose Fuel Category --</option>
                  <option value="GAS">GAS</option>
                  <option value="DIESEL & DYED">DIESEL & DYED</option>
                </select>
              </div>

              {/* <div>
                <label className="block font-bold text-gray-600 uppercase mb-1">
                  Inventory Item {!formSupplierItem && <span className="text-red-500 font-normal lowercase">(Please pick Supplier Item first)</span>}
                </label>
                <select
                  className="w-full p-2 border rounded-lg bg-white h-[38px] text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={!formSupplierItem} value={formInventoryItem} onChange={(e) => setFormInventoryItem(e.target.value)}
                >
                  <option value="">-- Select Store Label Match --</option>
                  {contextualInventoryItems.map(item => <option key={item} value={item}>{item}</option>)}
                </select> 
              </div> */}

              <div>
                <label className="block font-bold text-gray-600 uppercase mb-1">Discount Number Amount ($)</label>
                <div className="flex gap-2">
                  <input
                    type="number" step="0.0001" placeholder="0.0000"
                    className="w-full p-2 border rounded-lg bg-white font-mono h-[38px] text-sm"
                    value={formDiscountValue} onChange={(e) => setFormDiscountValue(e.target.value)}
                  />
                  <button
                    onClick={handleAddEntryToStagingList}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 shrink-0 h-[38px]"
                  >
                    Add To Queue List
                  </button>
                </div>
              </div>
            </div>

            {/* PREVIEW CONTAINER STAGING WINDOW */}
            <div className="flex-1 overflow-auto border rounded-xl p-2 bg-gray-50/30 flex flex-col min-h-[150px] mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 px-2 py-1 flex items-center gap-1.5 mb-2">
                <FileText className="w-3.5 h-3.5" /> Items Waiting to be Added ({newEntriesList.length})
              </span>

              {newEntriesList.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400 font-medium italic">No items added to the temporary queue yet.</div>
              ) : (
                <div className="space-y-1.5">
                  {newEntriesList.map((entry, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white border rounded-lg px-3 py-2 text-xs font-medium text-gray-700 shadow-xs">
                      <div className="grid grid-cols-4 gap-4 flex-1 font-mono">
                        <span className="truncate font-bold text-gray-900">{entry.supplierCode}</span>
                        <span className="truncate text-gray-600 font-sans">{entry.supplierItem}</span>
                        <span className="truncate text-gray-600 font-sans font-medium">{entry.inventoryItem}</span>
                        <span className="text-right text-emerald-600 font-bold">${entry.discounts.toFixed(4)}</span>
                      </div>
                      <button onClick={() => removeStagedItemFromPreview(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded ml-4 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center border-t pt-4">
              <button onClick={closeCreationWizard} className="px-4 py-2 border text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium">Cancel</button>
              <button
                onClick={handlePushNewEntriesToServer} disabled={newEntriesList.length === 0}
                className={`px-5 py-2 text-sm font-medium rounded-lg shadow-sm transition-all ${newEntriesList.length > 0 ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
              >
                Save and Add List Items ({newEntriesList.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG 4: CONFIRM MONTH SCHEDULE RELEASE WARNING BOX */}
      {isScheduleConfirmOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white border rounded-xl shadow-2xl w-full max-w-md p-6 border-amber-200">
            <div className="flex items-center gap-3 text-amber-500 mb-4">
              <Calendar className="w-8 h-8 shrink-0" />
              <h3 className="text-lg font-bold text-gray-900">Confirm Future Scheduled Update</h3>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              You are queueing <strong className="text-gray-900">{totalStagedCount} changes</strong> to be saved into the future planning table.
            </p>

            {/* DELETION MIXED NOTIFICATION ALERT */}
            {Object.keys(deletedRows).filter(k => deletedRows[k]).length > 0 && (
              <div className="flex items-start gap-2 bg-red-50 text-red-900 border border-red-200 p-3 rounded-lg text-xs leading-relaxed mb-4 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <div>
                  <span className="font-bold uppercase tracking-wider block text-red-700 text-[10px] mb-0.5">Live Deletion Warning</span>
                  Your list includes row deletion requests. Deleting an item completely skips scheduling and will happen **immediately live right now** once you click confirm below.
                </div>
              </div>
            )}

            <div className="bg-amber-50/50 text-amber-900 border border-amber-200/60 p-3 rounded-lg text-xs leading-relaxed mb-6 font-medium">
              Note: The price and discount updates you made will stay hidden in the background for now. They will turn on automatically on live stations on **1st of {scheduledMonthName}**.
            </div>

            <div className="flex justify-end gap-3 border-t pt-4">
              <button onClick={() => setIsScheduleConfirmOpen(false)} className="px-4 py-2 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors">Cancel</button>
              <button
                onClick={() => handlePushUpdatesBatch(false)}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors cursor-pointer"
              >
                Confirm and Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG 5: CONFIRM LIVE UPDATE WARNING */}
      {isLiveConfirmOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white border rounded-xl shadow-2xl w-full max-w-md p-6 border-red-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <Zap className="w-8 h-8 shrink-0" />
              <h3 className="text-lg font-bold text-gray-900">Push Changes Live?</h3>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              You are about to push <strong className="text-gray-900">{totalStagedCount} changes</strong> directly to live calculation table. This action is <strong>immediate</strong> and cannot be undone.
            </p>

            <div className="flex justify-end gap-3 border-t pt-4">
              <button
                onClick={() => setIsLiveConfirmOpen(false)}
                className="px-4 py-2 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handlePushUpdatesBatch(true);
                  setIsLiveConfirmOpen(false);
                }}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium shadow-sm"
              >
                Confirm and Go Live
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}