import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { Edit2, Trash2, Zap, Calendar, X, PlusCircle, RotateCcw, AlertTriangle, FileText, Search } from 'lucide-react'
import CreatableSelect from 'react-select/creatable'
import axios from 'axios'

export const Route = createFileRoute(
  '/_navbarLayout/fuel-price-management/carrier-haulage',
)({
  component: RouteComponent,
})

interface CarrierHaulageRow {
  'Carrier': string
  'Type': string
  'Location': string
  'Pickup': string
  'Live_Haulage': number | null
  'Live_Updated_At': string | null
  'Stg_Haulage': number | null
  'Stg_Updated_At': string | null
}

interface StagedNewHaulageEntry {
  carrier: string
  type: string
  location: string
  pickup: string
  haulage: number
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
  const [data, setData] = useState<CarrierHaulageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Track unsaved work in the current session
  const [editedRows, setEditedRows] = useState<Record<string, number>>({})
  const [deletedRows, setDeletedRows] = useState<Record<string, boolean>>({})

  // Modal window visibility states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [activeDialogRow, setActiveDialogRow] = useState<CarrierHaulageRow | null>(null)
  const [dialogInputValue, setDialogInputValue] = useState('')

  const [wizardStep, setWizardStep] = useState<'closed' | 'warning' | 'form'>('closed')
  const [newEntriesList, setNewEntriesList] = useState<StagedNewHaulageEntry[]>([])
  const [isScheduleConfirmOpen, setIsScheduleConfirmOpen] = useState(false)

  // Creation form inputs
  const [formCarrier, setFormCarrier] = useState('')
  const [formType, setFormType] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formPickup, setFormPickup] = useState('')
  const [formHaulageValue, setFormHaulageValue] = useState('')

  const fetchHaulageData = async () => {
    try {
      setLoading(true)
      const res = await axios.get('/api/fuel-pricing/carrier-haulage', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      setData(res.data)
      setEditedRows({})
      setDeletedRows({})
    } catch (err) {
      console.error(err)
      alert("Could not load the haulage routes from the server. Please refresh the page.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHaulageData()
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

    const filtered = data.filter(row => {
      if (!normalizedQuery) return true
      const carrierNormalized = (row['Carrier'] || '').replace(/[-\s]/g, '').toUpperCase()
      const locationNormalized = (row['Location'] || '').replace(/[-\s]/g, '').toUpperCase()
      return carrierNormalized.includes(normalizedQuery) || locationNormalized.includes(normalizedQuery)
    })

    return filtered.sort((a, b) => {
      const carrierA = (a['Carrier'] || '').trim().toUpperCase()
      const carrierB = (b['Carrier'] || '').trim().toUpperCase()

      if (carrierA !== carrierB) {
        return carrierA.localeCompare(carrierB)
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

  // Dropdown options extractors
  const uniqueCarriers = useMemo(() => Array.from(new Set(data.map(r => r['Carrier'].trim()))).sort(), [data])
  const uniqueTypes = useMemo(() => Array.from(new Set(data.map(r => r['Type'].trim()))).sort(), [data])
  const uniqueLocations = useMemo(() => Array.from(new Set(data.map(r => r['Location'].trim()))).sort(), [data])
  const uniquePickups = useMemo(() => Array.from(new Set(data.map(r => r['Pickup'].trim()))).sort(), [data])

  const getRowKey = (row: CarrierHaulageRow) => {
    return `${row['Carrier']}-${row['Type']}-${row['Location']}-${row['Pickup']}`
  }

  // Edit Handlers
  const openEditDialog = (row: CarrierHaulageRow) => {
    setActiveDialogRow(row)
    const key = getRowKey(row)
    
    // Default to scheduled price if one exists from this month, otherwise show live price
    const baselineValue = (row['Stg_Haulage'] !== null && isStagedInCurrentMonth(row['Stg_Updated_At']))
      ? row['Stg_Haulage']
      : (row['Live_Haulage'] ?? 0)

    setDialogInputValue(editedRows[key] !== undefined ? editedRows[key].toString() : baselineValue.toString())
    setIsEditDialogOpen(true)
  }

  const saveDialogEdit = () => {
    if (!activeDialogRow) return
    const numericVal = parseFloat(dialogInputValue)
    if (isNaN(numericVal)) {
      alert("Please enter a valid number.")
      return
    }
    const key = getRowKey(activeDialogRow)
    setEditedRows(prev => ({ ...prev, [key]: numericVal }))
    setIsEditDialogOpen(false)
    setActiveDialogRow(null)
  }

  const toggleRowDeletion = (row: CarrierHaulageRow) => {
    const key = getRowKey(row)
    setDeletedRows(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Creation Wizard Methods
  const resetFormFields = () => {
    setFormCarrier('')
    setFormType('')
    setFormLocation('')
    setFormPickup('')
    setFormHaulageValue('')
  }

  const closeCreationWizard = () => {
    setWizardStep('closed')
    setNewEntriesList([])
    resetFormFields()
  }

  const handleAddEntryToStagingList = () => {
    const haulageNum = parseFloat(formHaulageValue)
    if (!formCarrier || !formType || !formLocation || !formPickup || isNaN(haulageNum)) {
      alert("Please fill out all choices completely before adding.")
      return
    }

    const currentCarrier = formCarrier.trim().toUpperCase()
    const currentType = formType.trim().toUpperCase()
    const currentLocation = formLocation.trim().toUpperCase()
    const currentPickup = formPickup.trim().toUpperCase()

    const isStagedDuplicate = newEntriesList.some(
      e => e.carrier.trim().toUpperCase() === currentCarrier &&
        e.type.trim().toUpperCase() === currentType &&
        e.location.trim().toUpperCase() === currentLocation &&
        e.pickup.trim().toUpperCase() === currentPickup
    )

    const isDatabaseDuplicate = data.some(
      r => r['Carrier'].trim().toUpperCase() === currentCarrier &&
        r['Type'].trim().toUpperCase() === currentType &&
        r['Location'].trim().toUpperCase() === currentLocation &&
        r['Pickup'].trim().toUpperCase() === currentPickup
    )

    if (isStagedDuplicate || isDatabaseDuplicate) {
      alert("This exact route combination already exists in the table.")
      return
    }

    setNewEntriesList(prev => [...prev, {
      carrier: formCarrier.trim().toUpperCase(),
      type: formType.trim().toUpperCase(),
      location: formLocation.trim().toUpperCase(),
      pickup: formPickup.trim().toUpperCase(),
      haulage: haulageNum
    }])

    setFormHaulageValue('')
  }

  const removeStagedItemFromPreview = (index: number) => {
    setNewEntriesList(prev => prev.filter((_, i) => i !== index))
  }

  const handlePushNewEntriesToServer = async () => {
    if (newEntriesList.length === 0) return
    try {
      const res = await axios.post('/api/fuel-pricing/carrier-haulage/batch', { entries: newEntriesList }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (res.status === 200) {
        alert("Successfully added new routes to the table.")
        closeCreationWizard()
        await fetchHaulageData()
      }
    } catch (err) {
      console.error(err)
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
          carrier: row['Carrier'],
          type: row['Type'],
          location: row['Location'],
          pickup: row['Pickup']
        })
      } else if (editedRows[key] !== undefined) {
        updatesPayload.push({
          carrier: row['Carrier'],
          type: row['Type'],
          location: row['Location'],
          pickup: row['Pickup'],
          haulage: editedRows[key]
        })
      }
    }

    try {
      const res = await axios.put('/api/fuel-pricing/carrier-haulage/batch', {
        updates: updatesPayload,
        deletions: deletionsPayload,
        isImmediate: isImmediateAction
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (res.status === 200) {
        alert(isImmediateAction ? "Changes applied live right now!" : "Changes saved and scheduled successfully.")
        setIsScheduleConfirmOpen(false)
        await fetchHaulageData()
      }
    } catch (err) {
      console.error(err)
      alert("Could not save your changes. Please try again.")
    }
  }

  const formatToLocalTime = (utcString: string | null) => {
    if (!utcString) return '-'
    if (utcString.startsWith('1900-01-01')) return '-'
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
    return <div className="p-6 text-sm font-medium text-gray-500 animate-pulse">Loading haulage route information...</div>
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6 bg-white">
      
      {/* HEADER ACTION CONTROL INTERFACE LAYOUT */}
      <div className="flex items-end justify-between w-full">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Carrier Haulage Routes</h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage shipping and delivery costs for different truck routes. You can make updates live right away, or schedule them to go live automatically on the 1st of next month.
          </p>
        </div>

        {/* CONTROLS CLUSTER */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {/* DELETION ADVISORY BANNER */}
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight text-amber-800 bg-amber-50/70 border border-amber-200/50 px-2.5 py-1 rounded-md">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
            <span>Deleting a row happens instantly live</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setWizardStep('warning')}
              className="flex items-center gap-2 h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-xs cursor-pointer transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Add New Route
            </button>

            <button
              onClick={() => handlePushUpdatesBatch(true)}
              disabled={!hasPendingChanges}
              className={`flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg shadow-xs transition-all ${
                hasPendingChanges ? 'bg-red-600 text-white hover:bg-red-700 cursor-pointer' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              title="Push changes live to production systems right now."
            >
              <Zap className="w-4 h-4" />
              Go Live Now ({totalStagedCount})
            </button>

            <button
              onClick={() => setIsScheduleConfirmOpen(true)}
              disabled={!hasPendingChanges}
              className={`flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg shadow-xs transition-all ${
                hasPendingChanges ? 'bg-amber-600 text-white hover:bg-amber-700 cursor-pointer' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              title={`Save updates to turn on automatically on the 1st of ${scheduledMonthName}.`}
            >
              <Calendar className="w-4 h-4" />
              Schedule for {scheduledMonthName} ({totalStagedCount})
            </button>
          </div>
        </div>
      </div>

      {/* SEARCH INPUT BAR */}
      <div className="mt-5 mb-4 relative max-w-md w-full shrink-0">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          placeholder="Search by Carrier name or Destination Location..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg bg-white placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-xs"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-400 hover:text-gray-600">Clear</button>
        )}
      </div>

      {/* HAULAGE DATA TABLE FRAME */}
      <div className="flex-1 overflow-auto border border-gray-200 rounded-xl shadow-sm">
        <table className="w-full text-left border-collapse bg-white">
          <thead className="bg-gray-50/70 text-gray-700 text-xs font-semibold uppercase tracking-wider sticky top-0 border-b z-10">
            <tr>
              <th className="p-4 bg-gray-50/90">Carrier</th>
              <th className="p-4 bg-gray-50/90">Type</th>
              <th className="p-4 bg-gray-50/90">Location</th>
              <th className="p-4 bg-gray-50/90">Pickup Terminal</th>
              
              {/* ALIGNED RATE AND DATE COLUMN GROUPS */}
              <th className="p-3 text-right bg-emerald-50/40 text-emerald-900 border-x">Current Haulage ($)</th>
              <th className="p-4">Rate Last Updated At</th>
              <th className="p-3 text-right bg-amber-50/40 text-amber-900 border-r">Scheduled Haulage ($)</th>
              <th className="p-4">Schedule Last Updated At</th>
              
              <th className="p-4 text-center">Status Checks</th>
              <th className="p-4 text-center w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {sortedAndFilteredData.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-sm text-gray-400 italic">No records found matching your search.</td>
              </tr>
            ) : (
              sortedAndFilteredData.map((row) => {
                const key = getRowKey(row)
                const isStagedDeleted = !!deletedRows[key]
                const hasUnsavedLocalEdit = editedRows[key] !== undefined

                // Check if there is an active future price already stored on the database server
                const hasValidStagingMonth = row['Stg_Updated_At'] !== null && isStagedInCurrentMonth(row['Stg_Updated_At'])
                const hasSurchargesDiff = row['Stg_Haulage'] !== row['Live_Haulage']
                const isCommittedScheduleActive = hasValidStagingMonth && hasSurchargesDiff

                const liveValue = row['Live_Haulage'] !== null ? row['Live_Haulage'] : 0
                const committedStagedValue = isCommittedScheduleActive ? row['Stg_Haulage'] : null

                let rowClassName = "hover:bg-gray-50/50 text-gray-700 transition-colors"
                if (isStagedDeleted) {
                  rowClassName = "bg-red-50/60 text-gray-400 line-through select-none transition-colors"
                } else if (hasUnsavedLocalEdit) {
                  rowClassName = "bg-amber-50/40 hover:bg-amber-50/70 text-gray-900 transition-colors"
                } else if (isCommittedScheduleActive) {
                  rowClassName = "bg-blue-50/20 hover:bg-blue-50/40 text-gray-900 transition-colors"
                }

                return (
                  <tr key={key} className={rowClassName}>
                    <td className="p-4 font-bold text-gray-900">{row['Carrier']}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 font-mono text-xs rounded border">
                        {row['Type']}
                      </span>
                    </td>
                    <td className="p-4 font-medium">{row['Location']}</td>
                    <td className="p-4 text-gray-600">{row['Pickup']}</td>

                    {/* LIVE DISPLAY BLOCK */}
                    <td className="p-3 text-right font-mono font-bold bg-emerald-50/10 text-emerald-700 border-x">
                      {row['Live_Haulage'] !== null ? row['Live_Haulage'].toFixed(4) : '-'}
                    </td>
                    <td className="p-4 text-xs text-gray-400 font-medium border-r">
                      {formatToLocalTime(row['Live_Updated_At'])}
                    </td>

                    {/* FUTURE COMMITTED DISPLAY BLOCK */}
                    <td className={`p-3 text-right font-mono font-bold bg-amber-50/10 border-r ${isCommittedScheduleActive ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
                      {committedStagedValue !== null ? committedStagedValue.toFixed(4) : '-'}
                    </td>
                    <td className={`p-4 text-xs font-medium border-r ${isCommittedScheduleActive ? 'text-blue-500 font-semibold' : 'text-gray-400'}`}>
                      {formatToLocalTime(row['Stg_Updated_At'])}
                    </td>

                    {/* STATUS BADGES COLUMN */}
                    <td className="p-4 text-center whitespace-nowrap">
                      {isStagedDeleted && (
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-700 border border-red-200">
                          To Be Deleted
                        </span>
                      )}
                      {hasUnsavedLocalEdit && !isStagedDeleted && (
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200 animate-pulse">
                          Changing: ({ (committedStagedValue ?? liveValue).toFixed(4) } → { editedRows[key].toFixed(4) })
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
              <h3 className="font-bold text-gray-900 text-base">Change Route Haulage Rate</h3>
              <button onClick={() => setIsEditDialogOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2 mb-6 bg-gray-50 p-4 rounded-lg text-xs text-gray-600 border">
              <div><span className="font-semibold text-gray-500">Carrier:</span> {activeDialogRow['Carrier']}</div>
              <div><span className="font-semibold text-gray-500">Route Type:</span> {activeDialogRow['Type']}</div>
              <div><span className="font-semibold text-gray-500">Destination:</span> {activeDialogRow['Location']}</div>
              <div><span className="font-semibold text-gray-500">Terminal:</span> {activeDialogRow['Pickup']}</div>
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
              Before adding a new shipping route to this dashboard, please double-check that you have already registered and added this trucking company inside the **Bookworks** system.
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
              <h3 className="font-bold text-gray-900 text-base">Add New Shipping Routes</h3>
              <button onClick={closeCreationWizard} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-gray-50/70 p-4 border rounded-xl grid grid-cols-2 gap-3 mb-4 text-xs">
              <div>
                <label className="block font-bold text-gray-600 uppercase mb-1">Carrier Name</label>
                <CreatableSelect
                  isClearable styles={customSelectStyles} placeholder="Select or type company..."
                  options={uniqueCarriers.map(c => ({ value: c, label: c }))}
                  onChange={opt => setFormCarrier(opt?.value || '')}
                  onCreateOption={val => setFormCarrier(val.trim().toUpperCase())}
                  value={formCarrier ? { value: formCarrier, label: formCarrier } : null}
                />
              </div>

              <div>
                <label className="block font-bold text-gray-600 uppercase mb-1">Route Type</label>
                <select
                  className="w-full p-2 border rounded-lg bg-white h-[38px] text-sm"
                  value={formType} onChange={(e) => setFormType(e.target.value)}
                >
                  <option value="">-- Select Route Segment Type --</option>
                  {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-600 uppercase mb-1">Destination Location</label>
                <CreatableSelect
                  isClearable styles={customSelectStyles} placeholder="Select or type location..."
                  options={uniqueLocations.map(l => ({ value: l, label: l }))}
                  onChange={opt => setFormLocation(opt?.value || '')}
                  onCreateOption={val => setFormLocation(val.trim().toUpperCase())}
                  value={formLocation ? { value: formLocation, label: formLocation } : null}
                />
              </div>

              <div>
                <label className="block font-bold text-gray-600 uppercase mb-1">Pickup Terminal</label>
                <CreatableSelect
                  isClearable styles={customSelectStyles} placeholder="Select or type terminal..."
                  options={uniquePickups.map(p => ({ value: p, label: p }))}
                  onChange={opt => setFormPickup(opt?.value || '')}
                  onCreateOption={val => setFormPickup(val.trim().toUpperCase())}
                  value={formPickup ? { value: formPickup, label: formPickup } : null}
                />
              </div>

              <div className="col-span-2">
                <label className="block font-bold text-gray-600 uppercase mb-1">Haulage Rate Amount ($)</label>
                <div className="flex gap-2">
                  <input
                    type="number" step="0.0001" placeholder="0.0000"
                    className="w-full p-2 border rounded-lg bg-white font-mono h-[38px] text-sm"
                    value={formHaulageValue} onChange={(e) => setFormHaulageValue(e.target.value)}
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
                <FileText className="w-3.5 h-3.5" /> Routes Waiting to be Added ({newEntriesList.length})
              </span>

              {newEntriesList.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400 font-medium italic">No routes added to the temporary queue yet.</div>
              ) : (
                <div className="space-y-1.5">
                  {newEntriesList.map((entry, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white border rounded-lg px-3 py-2 text-xs font-medium text-gray-700 shadow-xs">
                      <div className="grid grid-cols-5 gap-2 flex-1 font-mono">
                        <span className="truncate font-bold text-gray-900">{entry.carrier}</span>
                        <span className="truncate text-blue-600">{entry.type}</span>
                        <span className="truncate text-gray-600 font-sans">{entry.location}</span>
                        <span className="truncate text-gray-500 font-sans">{entry.pickup}</span>
                        <span className="text-right text-emerald-600 font-bold">${entry.haulage.toFixed(4)}</span>
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
                Save and Add Routes ({newEntriesList.length})
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
              Note: The shipping route updates you made will stay hidden in the background for now. They will turn on automatically on live stations on **1st of {scheduledMonthName}**.
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
    </div>
  )
}