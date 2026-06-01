import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { Edit2, Trash2, Save, X, PlusCircle, RotateCcw, AlertTriangle, FileText, Search } from 'lucide-react'
import axios from 'axios'

export const Route = createFileRoute(
  '/_navbarLayout/fuel-price-management/supplier-discounts',
)({
  component: RouteComponent,
})

interface SupplierDiscountRow {
  'Supplier Code': string
  ' Supplier Item': string
  'Inventory Item': string
  'Discounts': number
  'Updated At': string | null
}

interface StagedNewEntry {
  supplierCode: string
  supplierItem: string
  inventoryItem: string
  discounts: number
}

export function RouteComponent() {
  const [data, setData] = useState<SupplierDiscountRow[]>([])
  const [loading, setLoading] = useState(true)
  
  // Search text input state
  const [searchQuery, setSearchQuery] = useState('')
  
  // Staging state records for edits/deletions
  const [editedRows, setEditedRows] = useState<Record<string, number>>({}) 
  const [deletedRows, setDeletedRows] = useState<Record<string, boolean>>({})

  // Row Edit Dialog States
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [activeDialogRow, setActiveDialogRow] = useState<SupplierDiscountRow | null>(null)
  const [dialogInputValue, setDialogInputValue] = useState('')

  // Multi-Step Creation Wizard Framework States
  const [wizardStep, setWizardStep] = useState<'closed' | 'warning' | 'form'>('closed')
  const [newEntriesList, setNewEntriesList] = useState<StagedNewEntry[]>([])
  
  // Creation Form Input Elements 
  const [formSupplierCode, setFormSupplierCode] = useState('')
  const [formSupplierItem, setFormSupplierItem] = useState('')
  const [formInventoryItem, setFormInventoryItem] = useState('')
  const [formDiscountValue, setFormDiscountValue] = useState('')

  const fetchDiscounts = async () => {
    try {
      setLoading(true)
      const res = await axios.get('/api/fuel-pricing/supplier-discounts', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      setData(res.data)
      setEditedRows({})
      setDeletedRows({})
    } catch (err) {
      console.error(err)
      alert("Failed loading supplier rows.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDiscounts()
  }, [])

  // --- SORTING, FILTERING & RE-INDENTING NORMALIZATION ENGINE ---
  const sortedAndFilteredData = useMemo(() => {
    // Normalize user search query string to remove hyphens, spaces, and casing
    const normalizedQuery = searchQuery.replace(/[-\s]/g, '').toUpperCase()

    // 1. Filter rows first if search criteria exists
    const filteredRows = data.filter(row => {
      if (!normalizedQuery) return true
      
      const supplierCodeRaw = row['Supplier Code'] || ''
      // Normalize database field string for exact alpha-numeric checks
      const normalizedCode = supplierCodeRaw.replace(/[-\s]/g, '').toUpperCase()
      
      return normalizedCode.includes(normalizedQuery)
    })

    // 2. Group by Supplier Code (A to Z) & Sub-Sort by [Updated At] Chronology
    return filteredRows.sort((a, b) => {
      const supplierA = (a['Supplier Code'] || '').trim().toUpperCase()
      const supplierB = (b['Supplier Code'] || '').trim().toUpperCase()
      
      if (supplierA !== supplierB) {
        return supplierA.localeCompare(supplierB)
      }

      const timeA = a['Updated At'] ? new Date(a['Updated At']).getTime() : 0
      const timeB = b['Updated At'] ? new Date(b['Updated At']).getTime() : 0

      return timeB - timeA 
    })
  }, [data, searchQuery])

  // Dynamic values generation for contextual selection inputs
  const uniqueSupplierItems = useMemo(() => {
    const items = data.map(row => row[' Supplier Item'].trim())
    return Array.from(new Set(items)).sort()
  }, [data])

  const contextualInventoryItems = useMemo(() => {
    if (!formSupplierItem) return []
    const filtered = data.filter(row => row[' Supplier Item'].trim() === formSupplierItem)
    const items = filtered.map(row => row['Inventory Item'].trim())
    return Array.from(new Set(items)).sort()
  }, [formSupplierItem, data])

  const getRowKey = (row: SupplierDiscountRow) => {
    return `${row['Supplier Code']}-${row[' Supplier Item']}-${row['Inventory Item']}`
  }

  // Edit Handlers
  const openEditDialog = (row: SupplierDiscountRow) => {
    setActiveDialogRow(row)
    const currentKey = getRowKey(row)
    setDialogInputValue(
      editedRows[currentKey] !== undefined ? editedRows[currentKey].toString() : row['Discounts'].toString()
    )
    setIsEditDialogOpen(true)
  }

  const saveDialogEdit = () => {
    if (!activeDialogRow) return
    const numericVal = parseFloat(dialogInputValue)
    if (isNaN(numericVal)) {
      alert("Please assign a valid floating calculation value.")
      return
    }
    const currentKey = getRowKey(activeDialogRow)
    if (numericVal === activeDialogRow['Discounts']) {
      const updatedEdits = { ...editedRows }
      delete updatedEdits[currentKey]
      setEditedRows(updatedEdits)
    } else {
      setEditedRows(prev => ({ ...prev, [currentKey]: numericVal }))
    }
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
    setFormInventoryItem('')
    setFormDiscountValue('')
  }

  const closeCreationWizard = () => {
    setWizardStep('closed')
    setNewEntriesList([])
    resetCreationFormFields()
  }

  const handleAddEntryToStagingList = () => {
    const discountNum = parseFloat(formDiscountValue)
    if (!formSupplierCode.trim() || !formSupplierItem || !formInventoryItem || isNaN(discountNum)) {
      alert("Please ensure all parameters are completed properly before compiling entries.")
      return
    }

    const isDuplicate = newEntriesList.some(
      e => e.supplierCode.toUpperCase() === formSupplierCode.trim().toUpperCase() &&
           e.supplierItem === formSupplierItem &&
           e.inventoryItem === formInventoryItem
    )
    if (isDuplicate) {
      alert("This precise configuration mapping is already staged inside your current preview collection list.")
      return
    }

    setNewEntriesList(prev => [...prev, {
      supplierCode: formSupplierCode.trim().toUpperCase(),
      supplierItem: formSupplierItem,
      inventoryItem: formInventoryItem,
      discounts: discountNum
    }])

    setFormSupplierItem('')
    setFormInventoryItem('')
    setFormDiscountValue('')
  }

  const removeStagedItemFromPreview = (index: number) => {
    setNewEntriesList(prev => prev.filter((_, i) => i !== index))
  }

  const handlePushNewEntriesToServer = async () => {
    if (newEntriesList.length === 0) return
    try {
      const res = await axios.post('/api/fuel-pricing/supplier-discounts/batch', {
        entries: newEntriesList
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })

      if (res.status === 200) {
        alert(`${newEntriesList.length} new records loaded successfully.`)
        closeCreationWizard()
        await fetchDiscounts()
      }
    } catch (err) {
      console.error(err)
      alert("Server failure processing creation payloads batch.")
    }
  }

  // Global batch modifications pusher engine
  const handlePushUpdates = async () => {
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
        deletions: deletionsPayload
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })

      if (res.status === 200) {
        alert("Modifications committed to server cluster.")
        await fetchDiscounts()
      }
    } catch (err) {
      console.error(err)
      alert("Error occurred committing dataset mutations down to server database.")
    }
  }

  const formatToLocalTime = (utcString: string | null) => {
    if (!utcString) return 'N/A'
    try {
      const dateInstance = new Date(utcString)
      return dateInstance.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch {
      return 'Invalid Date'
    }
  }

  const hasPendingChanges = Object.keys(editedRows).length > 0 || Object.keys(deletedRows).filter(k => deletedRows[k]).length > 0

  if (loading) {
    return <div className="p-6 text-sm font-medium text-gray-500 animate-pulse">Loading discount entries...</div>
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6 bg-white">
      {/* Header Panel */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Supplier Discounts</h1>
          <p className="text-xs text-gray-500 mt-1">Configure baseline adjustments managed via pricing rules engine matrices.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setWizardStep('warning')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Create Entry
          </button>

          <button
            onClick={handlePushUpdates}
            disabled={!hasPendingChanges}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg shadow-sm transition-all ${
              hasPendingChanges 
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" />
            Push Updates ({Object.keys(editedRows).length + Object.keys(deletedRows).filter(k => deletedRows[k]).length})
          </button>
        </div>
      </div>

      {/* NEW: NORMALIZED ACTION SEARCH BAR COMPONENT LAYER */}
      <div className="mb-4 relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          <Search className="w-4 h-4" />
        </div>
        <input 
          type="text"
          placeholder="Search by Supplier Code (e.g., nlpnanon or NLP-NAN-ON)..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg bg-white placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-xs"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-400 hover:text-gray-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Main Table Container Workspace */}
      <div className="flex-1 overflow-auto border border-gray-200 rounded-xl shadow-sm">
        <table className="w-full text-left border-collapse bg-white">
          <thead className="bg-gray-50/70 text-gray-700 text-xs font-semibold uppercase tracking-wider sticky top-0 border-b z-10">
            <tr>
              <th className="p-4">Supplier Code</th>
              <th className="p-4">Supplier Item</th>
              <th className="p-4">Inventory Item</th>
              <th className="p-4 text-right">Discounts ($)</th>
              <th className="p-4">Local Updated Time</th>
              <th className="p-4 text-center">Status Logs</th>
              <th className="p-4 text-center w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {sortedAndFilteredData.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-gray-400 italic">
                  No supplier record instances matched your query.
                </td>
              </tr>
            ) : (
              sortedAndFilteredData.map((row) => {
                const rowKey = getRowKey(row)
                const isStagedDeleted = !!deletedRows[rowKey]
                const hasStagedEdit = editedRows[rowKey] !== undefined
                const displayDiscountValue = hasStagedEdit ? editedRows[rowKey] : row['Discounts']

                return (
                  <tr 
                    key={rowKey}
                    className={`transition-colors ${
                      isStagedDeleted 
                        ? 'bg-red-50/60 text-gray-400 line-through select-none' 
                        : hasStagedEdit 
                          ? 'bg-amber-50/50 hover:bg-amber-50 text-gray-900' 
                          : 'hover:bg-gray-50/50 text-gray-700'
                    }`}
                  >
                    <td className="p-4 font-mono text-xs font-bold text-gray-900">{row['Supplier Code']}</td>
                    <td className="p-4">{row[' Supplier Item']}</td>
                    <td className="p-4 font-medium">{row['Inventory Item']}</td>
                    <td className={`p-4 text-right font-mono font-bold ${hasStagedEdit && !isStagedDeleted ? 'text-amber-600' : ''}`}>
                      {displayDiscountValue.toFixed(4)}
                    </td>
                    <td className="p-4 text-xs text-gray-500 font-medium">
                      {formatToLocalTime(row['Updated At'])}
                    </td>
                    <td className="p-4 text-center">
                      {isStagedDeleted && (
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-700 border border-red-200">
                          Staged Delete
                        </span>
                      )}
                      {hasStagedEdit && !isStagedDeleted && (
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200">
                          Modified ({row['Discounts']} → {editedRows[rowKey]})
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditDialog(row)}
                          disabled={isStagedDeleted}
                          className={`p-1.5 rounded transition-all ${
                            isStagedDeleted ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'
                          }`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleRowDeletion(row)}
                          className={`p-1.5 rounded transition-all ${
                            isStagedDeleted ? 'text-amber-600 hover:bg-amber-50' : 'text-red-600 hover:bg-red-50'
                          }`}
                        >
                          {isStagedDeleted ? <RotateCcw className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* DIALOG 1: INLINE ROW EDIT MODAL */}
      {isEditDialogOpen && activeDialogRow && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white border rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <h3 className="font-bold text-gray-900 text-base">Adjust Discount Metric</h3>
              <button onClick={() => setIsEditDialogOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 mb-6 bg-gray-50 p-4 rounded-lg text-xs text-gray-600 border">
              <div><span className="font-semibold text-gray-500">Supplier:</span> {activeDialogRow['Supplier Code']}</div>
              <div><span className="font-semibold text-gray-500">Item Name:</span> {activeDialogRow[' Supplier Item']}</div>
              <div><span className="font-semibold text-gray-500">Inventory Mapping:</span> {activeDialogRow['Inventory Item']}</div>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">New Target Discount Value</label>
              <input 
                type="number" step="0.0001"
                className="w-full p-2.5 border rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
                value={dialogInputValue} onChange={(e) => setDialogInputValue(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsEditDialogOpen(false)} className="px-4 py-2 border text-gray-700 rounded-lg text-sm">Cancel</button>
              <button onClick={saveDialogEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Stage Adjustment</button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG 2: STEP A - PRE-REQUISITE CHECK */}
      {wizardStep === 'warning' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white border rounded-xl shadow-2xl w-full max-w-md p-6 border-amber-200">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <AlertTriangle className="w-8 h-8 shrink-0" />
              <h3 className="text-lg font-bold text-gray-900">Pre-requisite Audit Check</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              Before introducing a new supplier calculation parameters model, please verify if this custom vendor entity profile has already been formally registered inside your **Bookworks** accounting architecture.
            </p>
            <div className="flex justify-end gap-3 border-t pt-4">
              <button 
                onClick={closeCreationWizard}
                className="px-4 py-2 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-lg text-sm font-medium"
              >
                No, Take Me Back
              </button>
              <button 
                onClick={() => setWizardStep('form')}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm"
              >
                Yes, Verified
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG 3: STEP B - BATCH CREATION WORKFLOW FORM CONTROLS */}
      {wizardStep === 'form' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white border rounded-xl shadow-2xl w-full max-w-2xl p-6 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <h3 className="font-bold text-gray-900 text-base">Compile New Discount Parameters</h3>
              <button onClick={closeCreationWizard} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Form Inputs Workspace */}
            <div className="bg-gray-50/70 p-4 border rounded-xl grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Supplier Code</label>
                <input 
                  type="text" placeholder="e.g. VEND-004"
                  className="w-full p-2 border rounded-lg bg-white font-mono text-sm uppercase"
                  value={formSupplierCode} onChange={(e) => setFormSupplierCode(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Supplier Item</label>
                <select 
                  className="w-full p-2 border rounded-lg bg-white text-sm"
                  value={formSupplierItem} 
                  onChange={(e) => {
                    setFormSupplierItem(e.target.value)
                    setFormInventoryItem('')
                  }}
                >
                  <option value="">-- Choose Item --</option>
                  {uniqueSupplierItems.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                  Inventory Item {!formSupplierItem && <span className="text-red-500 font-normal lowercase">(Select Supplier Item first)</span>}
                </label>
                <select 
                  className="w-full p-2 border rounded-lg bg-white text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={!formSupplierItem}
                  value={formInventoryItem} 
                  onChange={(e) => setFormInventoryItem(e.target.value)}
                >
                  <option value="">-- Choose Contextual Pair --</option>
                  {contextualInventoryItems.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Discount Value ($)</label>
                <div className="flex gap-2">
                  <input 
                    type="number" step="0.0001" placeholder="0.0000"
                    className="w-full p-2 border rounded-lg bg-white font-mono text-sm"
                    value={formDiscountValue} onChange={(e) => setFormDiscountValue(e.target.value)}
                  />
                  <button 
                    onClick={handleAddEntryToStagingList}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-gray-800 shrink-0"
                  >
                    Add To List
                  </button>
                </div>
              </div>
            </div>

            {/* Preview Staging Container Window */}
            <div className="flex-1 overflow-auto border rounded-xl p-2 bg-gray-50/30 flex flex-col min-h-[150px] mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 px-2 py-1 flex items-center gap-1.5 mb-2">
                <FileText className="w-3.5 h-3.5" /> Staging Preview Block Panel ({newEntriesList.length})
              </span>
              
              {newEntriesList.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400 font-medium italic">
                  No records compiled into local staging collections list yet.
                </div>
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
                      <button 
                        onClick={() => removeStagedItemFromPreview(idx)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded ml-4 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Wizard Operations Interface Footer */}
            <div className="flex justify-between items-center border-t pt-4">
              <button onClick={closeCreationWizard} className="px-4 py-2 border text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium">Cancel</button>
              <button 
                onClick={handlePushNewEntriesToServer}
                disabled={newEntriesList.length === 0}
                className={`px-5 py-2 text-sm font-medium rounded-lg shadow-sm transition-all ${
                  newEntriesList.length > 0 ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                Create Records ({newEntriesList.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}