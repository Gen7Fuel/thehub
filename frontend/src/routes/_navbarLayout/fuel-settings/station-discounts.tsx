import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import CreatableSelect from 'react-select/creatable'
import {
  PlusCircle, Zap, Calendar as CalendarIcon, AlertTriangle,
  Trash2, X, RefreshCw, Search, FileText, RotateCcw, Edit2
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { DatePicker } from '@/components/custom/datePicker'
import { format, addDays, isToday } from 'date-fns'

export const Route = createFileRoute('/_navbarLayout/fuel-settings/station-discounts')({
  component: RouteComponent,
})

interface StationDiscountRow {
  Station_SK: string
  Location: string
  Province: string
  Type: string | null
  Fuel_Grade: string | null
  Live_Discounts: number | null
  Live_Updated_At: string | null
  Stg_Discounts: number | null
  Stg_Updated_At: string | null
  Schedule_Effective_From: string | null
}

function RouteComponent() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const access = user?.access || {}

  const canEdit = access?.fuelSettings?.stationDiscounts?.edit === true

  // Core Functional States
  const [data, setData] = useState<StationDiscountRow[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [editedRows, setEditedRows] = useState<Record<string, number>>({})
  const [deletedRows, setDeletedRows] = useState<Record<string, boolean>>({})

  // Dialog State Control Hooks
  const [isLiveConfirmOpen, setIsLiveConfirmOpen] = useState(false)
  const [isScheduleConfirmOpen, setIsScheduleConfirmOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<'idle' | 'warning' | 'form'>('idle')

  // Explicitly type the new rescheduling wizard states for TypeScript
  const [isRescheduling, setIsRescheduling] = useState<boolean>(false)
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined)
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState<boolean>(false)

  // Inline Row Modification State Focusers
  const [activeDialogRow, setActiveDialogRow] = useState<StationDiscountRow | null>(null)
  const [dialogInputValue, setDialogInputValue] = useState('')

  // Creation Form Input Elements Workspace Hooks
  const [formStationSk, setFormStationSk] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formProvince, setFormProvince] = useState('')
  const [formCategoryType, setFormCategoryType] = useState('') // "GAS" or "DIESEL"
  const [formDiscountValue, setFormDiscountValue] = useState('')
  const [newEntriesList, setNewEntriesList] = useState<any[]>([])

  // Calendar Runtime Parameter Defaults (Tomorrow)
  const [scheduledEffectiveDate, setScheduledEffectiveDate] = useState<Date | undefined>(() => addDays(new Date(), 1))

  const getRowKey = (row: StationDiscountRow) =>
    `${row.Station_SK}-${row.Location}-${row.Province}-${row.Type || 'NA'}-${row.Fuel_Grade || 'NA'}`

  const fetchStationDiscounts = async () => {
    try {
      setLoading(true)
      const res = await axios.get('/api/fuel-settings/station-discounts', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Required-Permission': 'fuelSettings.stationDiscounts'
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
      alert("We couldn't load the current station discounts. Please refresh the page.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStationDiscounts()
  }, [])

  // Dynamic Array Inversion Lists (Options Extraction for Component Selects)
  const uniqueStationSks = useMemo(() => Array.from(new Set(data.map(r => r.Station_SK))), [data])
  const uniqueLocations = useMemo(() => Array.from(new Set(data.map(r => r.Location))), [data])
  const canadianProvinces = ["ON", "QC", "NS", "NB", "MB", "BC", "PE", "SK", "AB", "NL", "YT", "NT", "NU"]

  // Filtering Utility Layer Integration
  const sortedAndFilteredData = useMemo(() => {
    return data.filter(row => {
      const matchTerm = searchQuery.toLowerCase().trim()
      if (!matchTerm) return true
      return (
        row.Station_SK.toLowerCase().includes(matchTerm) ||
        row.Location.toLowerCase().includes(matchTerm) ||
        row.Province.toLowerCase().includes(matchTerm)
      )
    })
  }, [data, searchQuery])

  // Conversion Utilities for Timestamps
  const formatToLocalTime = (isoString: string | null) => {
    if (!isoString || isoString.startsWith('1900-01-01')) return '—'
    try {
      return format(new Date(isoString), "yyyy-MM-dd HH:mm")
    } catch {
      return '—'
    }
  }

  // Row operations togglers
  const openEditDialog = (row: StationDiscountRow) => {
    const key = getRowKey(row)
    setActiveDialogRow(row)
    setDialogInputValue(editedRows[key] !== undefined ? editedRows[key].toString() : (row.Stg_Discounts ?? row.Live_Discounts ?? 0).toString())
    setIsEditDialogOpen(true)
  }

  const saveDialogEdit = () => {
    if (!activeDialogRow) return
    const key = getRowKey(activeDialogRow)
    const parsed = parseFloat(dialogInputValue)
    if (isNaN(parsed)) {
      delete editedRows[key]
      setEditedRows({ ...editedRows })
    } else {
      setEditedRows({ ...editedRows, [key]: parsed })
    }
    setIsEditDialogOpen(false)
  }

  const toggleRowDeletion = (row: StationDiscountRow) => {
    const key = getRowKey(row)
    if (deletedRows[key]) {
      delete deletedRows[key]
    } else {
      deletedRows[key] = true
    }
    setDeletedRows({ ...deletedRows })
  }

  // Automated Grade Generator Logic Block
  const handleAddEntryToStagingList = () => {
    if (!formStationSk || !formLocation || !formProvince || !formCategoryType || !formDiscountValue) {
      alert("Please fill out all the fields before adding this discount to your list.");
      return;
    }

    const discNum = parseFloat(formDiscountValue);
    if (isNaN(discNum)) return;

    // Determine the expansion grade array exactly like before
    const targetedGrades = formCategoryType === "GAS" ? ["REG", "PNL"] : ["DYED", "DSL"];

    // Normalize comparing tokens to prevent casing/spacing anomalies
    const stationSkToken = formStationSk.trim().toUpperCase();
    const locationToken = formLocation.trim().toUpperCase();
    const provinceToken = formProvince.trim().toUpperCase();

    const generatedAdditions: any[] = [];

    targetedGrades.forEach(grade => {
      // 1. Verify if it's already in the local setup list waiting to be submitted
      const isStagedDuplicate = newEntriesList.some(
        e => e.stationSk.trim().toUpperCase() === stationSkToken &&
          e.location.trim().toUpperCase() === locationToken &&
          e.province.trim().toUpperCase() === provinceToken &&
          e.type === formCategoryType &&
          e.fuelGrade === grade
      );

      // 2. Verify if it already exists live inside your active database view state
      const isDatabaseDuplicate = data.some(
        r => r.Station_SK.trim().toUpperCase() === stationSkToken &&
          r.Location.trim().toUpperCase() === locationToken &&
          r.Province.trim().toUpperCase() === provinceToken &&
          (r.Type || 'NA') === formCategoryType &&
          (r.Fuel_Grade || 'NA') === grade
      );

      // If it's unique across both checks, stack it up
      if (!isStagedDuplicate && !isDatabaseDuplicate) {
        generatedAdditions.push({
          stationSk: formStationSk,
          location: formLocation,
          province: formProvince,
          type: formCategoryType,
          fuelGrade: grade,
          discounts: discNum
        });
      }
    });

    if (generatedAdditions.length === 0) {
      alert("All fuel grades for this selection already exist in your list or database.");
      return;
    }

    // Atomically append the valid new elements to the array list
    setNewEntriesList(prev => [...prev, ...generatedAdditions]);

    // Clean the inputs down to facilitate quick multi-line entries
    setFormCategoryType("");
    setFormDiscountValue("");
  };

  const removeStagedItemFromPreview = (index: number) => {
    setNewEntriesList(prev => prev.filter((_, i) => i !== index));
  };

  const handlePushNewEntriesToServer = async () => {
    if (newEntriesList.length === 0) return;

    try {
      const res = await axios.post('/api/fuel-settings/station-discounts/batch', { entries: newEntriesList }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Required-Permission': 'fuelSettings.stationDiscounts.edit'
        }
      });

      if (res.status === 200) {
        alert("The new discounts have been added successfully.");
        closeCreationWizard();
        await fetchStationDiscounts();
      }
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 403) {
        navigate({ to: '/no-access' });
        return;
      }
      alert("Something went wrong while saving the new discounts. Please try again.");
    }
  };

  const closeCreationWizard = () => {
    setWizardStep('idle')
    setFormStationSk("")
    setFormLocation("")
    setFormProvince("")
    setFormCategoryType("")
    setFormDiscountValue("")
    setNewEntriesList([])
  }

  const handlePushUpdatesBatch = async (isImmediateAction: boolean) => {
    if (!isImmediateAction) {
      if (!scheduledEffectiveDate) {
        alert("Please select a date on the calendar.")
        return
      }
      if (isToday(scheduledEffectiveDate)) {
        alert("You cannot schedule updates for today. Please choose a future date or click 'Make Live Now' instead.")
        return
      }
    }

    const updatesPayload = []
    const deletionsPayload = []

    for (const row of data) {
      const key = getRowKey(row)
      const dataFootprint = {
        stationSk: row.Station_SK,
        location: row.Location,
        province: row.Province,
        type: row.Type,
        fuelGrade: row.Fuel_Grade
      }

      if (deletedRows[key]) {
        deletionsPayload.push(dataFootprint)
      } else if (editedRows[key] !== undefined) {
        updatesPayload.push({ ...dataFootprint, discounts: editedRows[key] })
      }
    }

    try {
      const res = await axios.put('/api/fuel-settings/station-discounts/batch', {
        updates: updatesPayload,
        deletions: deletionsPayload,
        isImmediate: isImmediateAction,
        scheduleEffectiveDate: isImmediateAction ? null : format(scheduledEffectiveDate!, "yyyy-MM-dd")
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Required-Permission': 'fuelSettings.stationDiscounts.edit'
        }
      })

      if (res.status === 200) {
        alert("Your changes have been saved successfully.")
        setIsScheduleConfirmOpen(false)
        setIsLiveConfirmOpen(false)
        await fetchStationDiscounts()
      }
    } catch (err) {
      alert("We couldn't save your updates. Please check your network and try again.")
    }
  }

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setIsRescheduling(false);
    setRescheduleDate(undefined);
  };

  const handleSaveNewScheduleDate = async () => {
    if (rescheduleDate === undefined || !activeDialogRow) return;

    if (isToday(rescheduleDate)) {
      alert("You cannot schedule updates for today. Please choose a future date or click 'Make Live Now' instead.")
      return
    }
    setIsSubmittingReschedule(true);
    try {
      const formattedDate = format(rescheduleDate, "yyyy-MM-dd");

      const res = await axios.put('/api/fuel-settings/station-discounts/reschedule-single', {
        stationSk: activeDialogRow.Station_SK,
        location: activeDialogRow.Location,
        province: activeDialogRow.Province,
        type: activeDialogRow.Type,
        fuelGrade: activeDialogRow.Fuel_Grade,
        newScheduleDate: formattedDate
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Required-Permission': 'fuelSettings.stationDiscounts.edit'
        }
      });

      if (res.status === 200) {
        await fetchStationDiscounts();
        handleCloseEditDialog();
      }
    } catch (err) {
      console.error("Error patching single schedule rule layout:", err);
      alert("Failed to change the schedule date. Please try again.");
    } finally {
      setIsSubmittingReschedule(false);
    }
  };

  const totalStagedCount = Object.keys(editedRows).length + Object.keys(deletedRows).length
  const hasPendingChanges = totalStagedCount > 0

  const selectStyles = {
    control: (base: any) => ({
      ...base,
      minHeight: '38px',
      borderRadius: '0.5rem',
      borderColor: '#e2e8f0',
      fontSize: '0.875rem'
    })
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6 bg-white">

      {/* HEADER ACTION CONTROL INTERFACE LAYOUT */}
      <div className="flex items-end justify-between w-full">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Station Discounts</h1>
          <p className="text-xs text-gray-500 mt-1">
            View and manage fuel discounts for your stations. {canEdit && "You can make changes take effect immediately, or schedule updates for a future date."}
          </p>
        </div>

        {/* CONTROLS CLUSTER */}
        {/* CONTROLS CLUSTER */}
        {canEdit && (
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {/* DYNAMIC LAYOUT WARNING ALERTS */}
            {Object.keys(deletedRows).length > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight text-red-800 bg-red-50/70 border border-red-200/50 px-2.5 py-1 rounded-md">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                <span>Deletion Mode Active: Edits are locked until you save or undo removals</span>
              </div>
            )}
            {Object.keys(editedRows).length > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight text-amber-800 bg-amber-50/70 border border-amber-200/50 px-2.5 py-1 rounded-md">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span>Edit Mode Active: Row deletions are locked until changes are cleared or saved</span>
              </div>
            )}
            {Object.keys(deletedRows).length === 0 && Object.keys(editedRows).length === 0 && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-md">
                <span>No pending adjustments staged</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => setWizardStep('warning')}
                // Lock out wizard creation if batch alterations exist
                disabled={Object.keys(deletedRows).length > 0 || Object.keys(editedRows).length > 0}
                className={`flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium shadow-xs transition-colors ${Object.keys(deletedRows).length > 0 || Object.keys(editedRows).length > 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                  }`}
              >
                <PlusCircle className="w-4 h-4" />
                Add New Discount
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
                Make Live Now ({totalStagedCount})
              </button>

              <button
                onClick={() => setIsScheduleConfirmOpen(true)}
                // Disable scheduling entirely if a delete operation is in the tracking map
                disabled={!hasPendingChanges || Object.keys(deletedRows).length > 0}
                title={Object.keys(deletedRows).length > 0 ? "Deletions cannot be scheduled for later" : "Schedule Updates"}
                className={`flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg shadow-xs transition-all ${hasPendingChanges && Object.keys(deletedRows).length === 0
                  ? 'bg-amber-600 text-white hover:bg-amber-700 cursor-pointer'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
              >
                <CalendarIcon className="w-4 h-4" />
                Save / Schedule Changes ({totalStagedCount})
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
          placeholder="Search by Station Number, Location Name or Province..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg bg-white placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-xs"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-400 hover:text-gray-600">Clear</button>
        )}
      </div>

      {/* DATA TABLE */}
      <div className="flex-1 overflow-auto border border-gray-200 rounded-xl shadow-sm">
        <table className="w-full text-left border-collapse bg-white">
          <thead className="bg-gray-50/70 text-gray-700 text-xs font-semibold uppercase tracking-wider sticky top-0 border-b z-10">
            <tr>
              <th className="p-4 bg-gray-50/90">Station Number</th>
              <th className="p-4 bg-gray-50/90">Location</th>
              <th className="p-4 bg-gray-50/90">Province</th>
              <th className="p-4 bg-gray-50/90">Fuel Type</th>
              <th className="p-4 bg-gray-50/90">Fuel Grade</th>
              <th className="p-3 text-right bg-emerald-50/40 text-emerald-900 border-x">Current Discount ($)</th>
              <th className="p-4">Last Updated Live</th>
              <th className="p-3 text-right bg-amber-50/40 text-amber-900 border-r">Upcoming Discount ($)</th>
              <th className="p-4">Schedule Last Saved</th>
              <th className="p-4 text-center">Status Checks</th>
              {canEdit && <th className="p-4 text-center w-24">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan={11} className="p-12 text-center text-gray-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" /> Loading fuel discounts...
                </td>
              </tr>
            ) : sortedAndFilteredData.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-sm text-gray-400 italic">No matching records found.</td>
              </tr>
            ) : (
              sortedAndFilteredData.map((row) => {
                const rowKey = getRowKey(row)
                const isStagedDeleted = !!deletedRows[rowKey]
                const hasUnsavedLocalEdit = editedRows[rowKey] !== undefined

                const isCommittedScheduleActive = row.Stg_Updated_At !== null && row.Schedule_Effective_From !== null

                const liveValue = row.Live_Discounts !== null ? row.Live_Discounts : 0
                const committedStagedValue = isCommittedScheduleActive ? row.Stg_Discounts : null

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
                    <td className="p-4 font-mono text-xs font-bold text-gray-900">{row.Station_SK}</td>
                    <td className="p-4 text-gray-600 max-w-[150px] truncate">{row.Location}</td>
                    <td className="p-4 font-bold text-gray-800">{row.Province}</td>
                    <td className="p-4 text-xs font-semibold">{row.Type || '—'}</td>
                    <td className="p-4 text-xs font-bold font-mono text-blue-600">{row.Fuel_Grade || '—'}</td>

                    {/* LIVE DISPLAY */}
                    <td className="p-3 text-right font-mono font-bold bg-emerald-50/10 text-emerald-700 border-x">
                      {row.Live_Discounts !== null ? row.Live_Discounts.toFixed(4) : '-'}
                    </td>
                    <td className="p-4 text-xs text-gray-400 font-medium">{formatToLocalTime(row.Live_Updated_At)}</td>

                    {/* FUTURE COMMITTED DISPLAY */}
                    <td className={`p-3 text-right font-mono font-bold bg-amber-50/10 border-r ${isCommittedScheduleActive ? 'text-blue-600' : 'text-gray-400'}`}>
                      {hasUnsavedLocalEdit ? editedRows[rowKey].toFixed(4) : (committedStagedValue !== null ? committedStagedValue.toFixed(4) : '-')}
                    </td>
                    <td className={`p-4 text-xs font-medium ${isCommittedScheduleActive ? 'text-blue-500' : 'text-gray-400'}`}>{formatToLocalTime(row.Stg_Updated_At)}</td>

                    {/* STATUS BADGES COLUMN */}
                    <td className="p-4 text-center whitespace-nowrap">
                      {isStagedDeleted && (
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-700 border border-red-200">
                          To Be Removed
                        </span>
                      )}
                      {hasUnsavedLocalEdit && !isStagedDeleted && (
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200 animate-pulse">
                          Unsaved: ({(committedStagedValue ?? liveValue).toFixed(4)} → {editedRows[rowKey].toFixed(4)})
                        </span>
                      )}
                      {!isStagedDeleted && !hasUnsavedLocalEdit && isCommittedScheduleActive && (
                        <span className="inline-flex flex-col px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700 border border-blue-200 text-left">
                          {/* <span>Effective From:</span> */}
                          <span className="font-mono text-xs tracking-normal font-black">
                            Effective From:
                            {(() => {
                              try {
                                // Strip out any pre-existing time zones or T-stamps if present to ensure clean parsing
                                const rawDateStr = String(row.Schedule_Effective_From).split('T')[0];
                                const parsedDate = new Date(rawDateStr + "T00:00:00");
                                if (isNaN(parsedDate.getTime())) throw new Error();
                                return format(parsedDate, "MMMM d, yyyy");
                              } catch {
                                return String(row.Schedule_Effective_From).split('T')[0];
                              }
                            })()}
                          </span>
                        </span>
                      )}
                      {!isStagedDeleted && !hasUnsavedLocalEdit && !isCommittedScheduleActive && <span className="text-gray-300 italic text-xs">-</span>}
                    </td>

                    {/* ITEM ROW CONTROLS */}
                    {/* ITEM ROW CONTROLS */}
                    {canEdit && (
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditDialog(row)}
                            // Disable editing if this row is deleted OR if ANY other row in the table has a pending deletion
                            disabled={isStagedDeleted || Object.keys(deletedRows).length > 0}
                            title={Object.keys(deletedRows).length > 0 ? "Cannot edit lines while you have pending deletions" : "Edit Discount"}
                            className={`p-1.5 rounded transition-all ${isStagedDeleted || Object.keys(deletedRows).length > 0
                              ? 'text-gray-200 cursor-not-allowed bg-transparent'
                              : 'text-blue-600 hover:bg-blue-50 cursor-pointer'
                              }`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => toggleRowDeletion(row)}
                            // Disable deleting if this row has local edits OR if ANY other row in the table has unsaved edits
                            disabled={hasUnsavedLocalEdit || Object.keys(editedRows).length > 0}
                            title={Object.keys(editedRows).length > 0 ? "Cannot delete lines while you have unsaved edits" : (isStagedDeleted ? "Undo Deletion" : "Delete Line")}
                            className={`p-1.5 rounded transition-all ${hasUnsavedLocalEdit || Object.keys(editedRows).length > 0
                              ? 'text-gray-200 cursor-not-allowed bg-transparent'
                              : isStagedDeleted
                                ? 'text-amber-600 hover:bg-amber-50 cursor-pointer'
                                : 'text-red-600 hover:bg-red-50 cursor-pointer'
                              }`}
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

      {/* DIALOG 1: PRICE CHANGE & RESCHEDULING MODAL */}
      {isEditDialogOpen && activeDialogRow && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white border rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <h3 className="font-bold text-gray-900 text-base">
                {isRescheduling ? "Change Scheduled Start Date" : "Edit Discount Value"}
              </h3>
              <button onClick={handleCloseEditDialog} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1 mb-6 bg-gray-50 p-4 rounded-lg text-xs text-gray-600 border font-medium">
              <div><span className="font-bold text-gray-400 uppercase">Station Info:</span> #{activeDialogRow.Station_SK} - {activeDialogRow.Location}</div>
              <div><span className="font-bold text-gray-400 uppercase">Fuel Mapping:</span> {activeDialogRow.Type || '—'} ({activeDialogRow.Fuel_Grade || '—'})</div>
              {activeDialogRow.Schedule_Effective_From && (
                <div className="text-blue-600 mt-1 pt-1 border-t border-gray-200/60">
                  <span className="font-bold uppercase text-[10px]">Currently Scheduled For:</span>{" "}
                  {(() => {
                    try {
                      // Strip out any pre-existing time zones or T-stamps if present to ensure clean parsing
                      const rawDateStr = String(activeDialogRow.Schedule_Effective_From).split('T')[0];
                      const parsedDate = new Date(rawDateStr + "T00:00:00");
                      if (isNaN(parsedDate.getTime())) throw new Error();
                      return format(parsedDate, "MMMM d, yyyy");
                    } catch {
                      return String(activeDialogRow.Schedule_Effective_From).split('T')[0];
                    }
                  })()}
                </div>
              )}
            </div>

            {!isRescheduling ? (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Discount Amount ($)</label>
                  <input
                    type="number" step="0.0001"
                    className="w-full p-2.5 border rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
                    value={dialogInputValue} onChange={(e) => setDialogInputValue(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-end gap-3">
                    <button onClick={handleCloseEditDialog} className="px-4 py-2 border text-gray-700 rounded-lg text-sm">
                      Cancel
                    </button>
                    <button onClick={saveDialogEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                      Keep Change
                    </button>
                  </div>

                  {activeDialogRow.Schedule_Effective_From !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          // Normalize the input down to raw date component to safely apply T00:00:00
                          const cleanDateStr = String(activeDialogRow.Schedule_Effective_From).split('T')[0];
                          const targetDate = new Date(cleanDateStr + "T00:00:00");

                          // Validate if parsing actually generated a real date object
                          if (isNaN(targetDate.getTime())) {
                            setRescheduleDate(new Date()); // Fallback to current system timestamp if parsing completely breaks
                          } else {
                            setRescheduleDate(targetDate);
                          }
                        } catch {
                          setRescheduleDate(new Date());
                        }
                        setIsRescheduling(true);
                      }}
                      className="mt-2 w-full py-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <CalendarIcon className="w-3.5 h-3.5" />
                      Change Date For Scheduled Setup
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="mb-6 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Select New Effective Date</label>
                  <div className="border p-2 rounded-lg bg-gray-50/50">
                    <DatePicker
                      // Ensure we never pass an invalid date into the child DatePicker
                      date={rescheduleDate && !isNaN(rescheduleDate.getTime()) ? rescheduleDate : new Date()}
                      setDate={setRescheduleDate}
                      disablePast={true}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center gap-3 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => setIsRescheduling(false)}
                    disabled={isSubmittingReschedule}
                    className="px-3 py-2 border text-gray-600 hover:bg-gray-50 rounded-lg text-xs font-semibold"
                  >
                    Back to Discount
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCloseEditDialog}
                      disabled={isSubmittingReschedule}
                      className="px-3 py-2 border text-gray-400 hover:text-gray-50 rounded-lg text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveNewScheduleDate}
                      disabled={!rescheduleDate || isNaN(rescheduleDate.getTime()) || isSubmittingReschedule}
                      className={`px-4 py-2 text-xs font-bold uppercase rounded-lg text-white shadow-xs transition-all ${rescheduleDate && !isNaN(rescheduleDate.getTime()) && !isSubmittingReschedule
                        ? 'bg-amber-600 hover:bg-amber-700 cursor-pointer'
                        : 'bg-gray-300 cursor-not-allowed'
                        }`}
                    >
                      {isSubmittingReschedule ? "Saving..." : "Change Date"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* DIALOG 2: WIZARD STEP 1 - ADVISORY */}
      {wizardStep === 'warning' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white border rounded-xl shadow-2xl w-full max-w-md p-6 border-amber-200">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <AlertTriangle className="w-8 h-8 shrink-0" />
              <h3 className="text-lg font-bold text-gray-900">Check Station Status First</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              Before creating a discount here, please ensure this station number has already been added to your primary Station Directory list.
            </p>
            <div className="flex justify-end gap-3 border-t pt-4">
              <button onClick={closeCreationWizard} className="px-4 py-2 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-lg text-sm font-medium">Go Back</button>
              <button onClick={() => setWizardStep('form')} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm">Yes, Station Exists</button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG 3: WIZARD STEP 2 - CREATION CONTAINER */}
      {wizardStep === 'form' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white border rounded-xl shadow-2xl w-full max-w-2xl p-6 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <h3 className="font-bold text-gray-900 text-base">Create Station Discount Rules</h3>
              <button onClick={closeCreationWizard} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-gray-50/70 p-4 border rounded-xl grid grid-cols-2 gap-4 mb-4 text-xs">
              <div>
                <label className="block font-bold text-gray-600 uppercase mb-1">Station CSO Code</label>
                <CreatableSelect
                  isClearable styles={selectStyles} placeholder="Select or type station cso code..."
                  options={uniqueStationSks.map(s => ({ value: s, label: s }))}
                  onChange={opt => setFormStationSk(opt?.value || '')}
                  onCreateOption={val => setFormStationSk(val.trim().toUpperCase())}
                  value={formStationSk ? { value: formStationSk, label: formStationSk } : null}
                />
              </div>

              <div>
                <label className="block font-bold text-gray-600 uppercase mb-1">Station Name</label>
                <CreatableSelect
                  isClearable styles={selectStyles} placeholder="Select or type name..."
                  options={uniqueLocations.map(l => ({ value: l, label: l }))}
                  onChange={opt => setFormLocation(opt?.value || '')}
                  onCreateOption={val => setFormLocation(val.trim())}
                  value={formLocation ? { value: formLocation, label: formLocation } : null}
                />
              </div>

              <div>
                <label className="block font-bold text-gray-600 uppercase mb-1">Province</label>
                <select
                  className="w-full p-2 border rounded-lg bg-white h-[38px] text-sm font-semibold"
                  value={formProvince} onChange={(e) => setFormProvince(e.target.value)}
                >
                  <option value="">-- Select Province --</option>
                  {canadianProvinces.map(prov => <option key={prov} value={prov}>{prov}</option>)}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-600 uppercase mb-1">Fuel Category</label>
                <select
                  className="w-full p-2 border rounded-lg bg-white h-[38px] text-sm font-semibold"
                  value={formCategoryType} onChange={(e) => setFormCategoryType(e.target.value)}
                >
                  <option value="">-- Choose Category --</option>
                  <option value="GAS">GAS (REG & PNL)</option>
                  <option value="DIESEL">DIESEL (DSL & DYED)</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block font-bold text-gray-600 uppercase mb-1">Discount Amount ($)</label>
                <div className="flex gap-2">
                  <input
                    type="number" step="0.0001" placeholder="0.0000"
                    className="w-full p-2 border rounded-lg bg-white font-mono h-[38px] text-sm"
                    value={formDiscountValue} onChange={(e) => setFormDiscountValue(e.target.value)}
                  />
                  <button
                    onClick={handleAddEntryToStagingList}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 shrink-0 h-[38px] text-xs uppercase tracking-wider"
                  >
                    Generate Entries Below
                  </button>
                </div>
              </div>
            </div>

            {/* PREVIEW CONTAINER STAGING WINDOW */}
            <div className="flex-1 overflow-auto border rounded-xl p-2 bg-gray-50/30 flex flex-col min-h-[150px] mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 px-2 py-1 flex items-center gap-1.5 mb-2">
                <FileText className="w-3.5 h-3.5" /> Discounts To Be Added ({newEntriesList.length})
              </span>

              {newEntriesList.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400 font-medium italic">No rows generated yet. Click the button above to add entries.</div>
              ) : (
                <div className="space-y-1.5">
                  {newEntriesList.map((entry, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white border rounded-lg px-3 py-2 text-xs font-medium text-gray-700 shadow-xs">
                      <div className="grid grid-cols-5 gap-2 flex-1 font-mono text-[11px]">
                        <span className="truncate font-bold text-gray-900">{entry.stationSk}</span>
                        <span className="truncate text-gray-500 font-sans">{entry.location}</span>
                        <span className="font-bold text-gray-700">{entry.province}</span>
                        <span className="text-blue-600 font-bold">{entry.type} ({entry.fuelGrade})</span>
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
                Save and Add Live ({newEntriesList.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG 4: CONFIRM BATCH SCHEDULING DATE PICKER */}
      {isScheduleConfirmOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white border rounded-xl shadow-2xl w-full max-w-md p-6 border-amber-200 space-y-4">

            {Object.keys(deletedRows).length > 0 ? (
              /* CONDITIONAL IF REMOVAL OPERATIONS ARE MIXED IN */
              <>
                <div className="flex items-center gap-3 text-red-600">
                  <AlertTriangle className="w-6 h-6 shrink-0" />
                  <h3 className="text-lg font-bold text-gray-900">Deletions Cannot Be Scheduled</h3>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Your pending changes include request lines marked for deletion.
                  <strong> Deletions always happen immediately live </strong> and cannot be set for a future date.
                </p>
                <div className="p-3 bg-red-50 rounded-lg border border-red-100 text-xs text-red-800">
                  Please use the <strong className="font-bold">"Make Live Now"</strong> control flow or reverse the delete items to proceed with choosing a scheduling target.
                </div>
                <div className="flex justify-end pt-2 border-t">
                  <button onClick={() => setIsScheduleConfirmOpen(false)} className="px-4 py-2 border text-gray-500 hover:bg-gray-50 rounded-lg text-xs font-semibold">Close Window</button>
                </div>
              </>
            ) : (
              /* REGULAR ROUTE: ONLY SYSTEM UPDATES ARE SELECTED */
              <>
                <div className="flex items-center gap-3 text-amber-500">
                  <CalendarIcon className="w-6 h-6 shrink-0" />
                  <h3 className="text-lg font-bold text-gray-900">Choose Scheduled Start Date</h3>
                </div>

                <p className="text-xs text-gray-500 leading-relaxed">
                  Select the day you want these discount updates to start. The system automatically turns them on at midnight on your selected date.
                </p>

                <div className="space-y-1.5 bg-gray-50 p-3 rounded-lg border">
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider">Start Discounts On:</label>
                  <DatePicker
                    date={scheduledEffectiveDate}
                    setDate={setScheduledEffectiveDate}
                    disablePast={true}
                  />
                </div>

                <div className="flex justify-end gap-3 border-t pt-4">
                  <button onClick={() => setIsScheduleConfirmOpen(false)} className="px-4 py-2 border text-gray-500 hover:bg-gray-50 rounded-lg text-xs font-semibold">Cancel</button>
                  <button
                    onClick={() => handlePushUpdatesBatch(false)}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    Confirm and Schedule
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* DIALOG 5: CONFIRM DIRECT RE-WRITE */}
      {isLiveConfirmOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white border rounded-xl shadow-2xl w-full max-w-md p-6 border-red-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <Zap className="w-8 h-8 shrink-0" />
              <h3 className="text-lg font-bold text-gray-900">Make Changes Live Now?</h3>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              You are pushing <strong className="text-gray-900">{totalStagedCount} adjustments</strong> directly into your live station profiles. This will change active pump pricing systems immediately.
            </p>

            <div className="flex justify-end gap-3 border-t pt-4">
              <button onClick={() => setIsLiveConfirmOpen(false)} className="px-4 py-2 border text-gray-500 hover:bg-gray-50 rounded-lg text-sm font-medium">Cancel</button>
              <button
                onClick={() => handlePushUpdatesBatch(true)}
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