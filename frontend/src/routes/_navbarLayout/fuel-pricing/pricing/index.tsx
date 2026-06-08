import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSite } from '@/context/SiteContext'
import { useAuth } from '@/context/AuthContext'
import { useFuelPricingContext } from '@/context/FuelPricingContext'
import { useQuery, useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { Coins, Loader2, AlertCircle, Save, ShieldAlert, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from '@/components/ui/button'
import { toast } from "sonner"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp"
// Import Dialog Primitives (Adjust paths according to your Shadcn layout structure)
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

export const Route = createFileRoute('/_navbarLayout/fuel-pricing/pricing/')({
  component: FuelPricingPanel,
})

const SORTED_DISPLAY_GRADES = [
  { id: 'REG', label: 'Regular', lookup: 'Regular' },
  { id: 'MID', label: 'Mid Grade', lookup: 'Mid Grade' },
  { id: 'PNL', label: 'Premium', lookup: 'Premium' },
  { id: 'DSL', label: 'Diesel', lookup: 'Diesel' },
  { id: 'DYED', label: 'Dyed Diesel', lookup: 'Dyed Diesel' }
]

export const getFormGradeTheme = (grade: string) => {
  switch (grade) {
    case "Regular": return "bg-green-500 text-white"
    case "Premium": return "bg-red-500 text-white"
    case "Mid Grade": return "bg-gradient-to-r from-green-500 to-red-500 text-white"
    case "Diesel": return "bg-amber-400 text-slate-900"
    case "Dyed Diesel": return "bg-red-800 text-white"
    default: return "bg-slate-600 text-white"
  }
}

const formatStationTimestamp = (dateString: string | undefined, timeZoneString: string | undefined) => {
  if (!dateString) return '';
  try {
    const dateObj = new Date(dateString);
    return dateObj.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timeZoneString || undefined
    }).replace(',', '');
  } catch (e) {
    return '';
  }
};

function FuelPricingPanel() {
  const { user } = useAuth()
  const access = user?.access || {}
  const { selectedSite } = useSite()
  const { recommendedPrices } = useFuelPricingContext()
  const [prices, setPrices] = useState<Record<string, string>>({})

  // Track visibility state of the preview/confirmation dialog layer
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const navigate = useNavigate()
  const canUpdateFuelPricing = access?.fuelPricing?.setFuelPrice;

  const authHeader = {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
      "X-Required-Permission": "fuelPricing.setFuelPrice"
    }
  };

  const handleAxiosErrorCheck = (err: any) => {
    if (axios.isAxiosError(err) && err.response?.status === 403) {
      navigate({ to: '/no-access' });
      return true;
    }
    return false;
  };

  const { data: dbLocation, isLoading: loadingMongo, isError: mongoError } = useQuery({
    queryKey: ['location-by-name', selectedSite],
    queryFn: async () => {
      if (!selectedSite) return null
      try {
        const res = await axios.get(`/api/locations/name/${encodeURIComponent(selectedSite)}`, authHeader)
        return res.data
      } catch (err) {
        if (handleAxiosErrorCheck(err)) return null;
        throw err;
      }
    },
    enabled: !!selectedSite
  })

  const locationMongoId = dbLocation?._id;
  const stationTimeZone = dbLocation?.timezone;

  const { data: activePostgresPrices, isLoading: loadingPostgres, refetch: reloadPostgres } = useQuery({
    queryKey: ['postgres-current-prices', locationMongoId],
    queryFn: async () => {
      if (!locationMongoId) return null
      try {
        const res = await axios.get(`/api/fuel-pricing/current/${locationMongoId}`, authHeader)
        return res.data
      } catch (err) {
        if (handleAxiosErrorCheck(err)) return null;
        throw err;
      }
    },
    enabled: !!locationMongoId && !!canUpdateFuelPricing
  })

  useEffect(() => {
    if (activePostgresPrices) {
      const initialFormValues: Record<string, string> = {}
      SORTED_DISPLAY_GRADES.forEach(g => {
        const rawRecord = activePostgresPrices[g.id]
        const val = rawRecord?.price !== undefined ? rawRecord.price : rawRecord;
        initialFormValues[g.id] = val ? String(val).replace('.', '') : ''
      })
      setPrices(initialFormValues)
    } else {
      setPrices({})
    }
  }, [activePostgresPrices])

  const submitPricesMutation = useMutation({
    mutationFn: async (payload: any) => {
      return (await axios.post('/api/fuel-pricing/upsert-retail', payload, authHeader)).data
    },
    onSuccess: () => {
      toast.success("Retail Fuel Prices Dispatched")
      setIsConfirmOpen(false) // Shut the modal overlay context on success
      reloadPostgres()
    },
    onError: (err: any) => {
      if (handleAxiosErrorCheck(err)) return;
      toast.error("Transmission Pipeline Failed")
    }
  })

  const handlePriceValueChange = (gradeId: string, inputString: string) => {
    setPrices(prev => ({ ...prev, [gradeId]: inputString }))
  }

  // Intercept open trigger to run basic payload validation rules first
  const handleOpenConfirmationDialog = () => {
    if (!locationMongoId) return toast.error("MongoDB context identification failed.")

    // Ensure there is at least one completed 4-digit input sequence before staging changes
    const dynamicEntries = Object.values(prices).filter(val => val && val.length === 4);
    if (dynamicEntries.length === 0) {
      return toast.error("Please provide at least one complete 4-digit grade rate.")
    }

    setIsConfirmOpen(true)
  }

  // Fires only when the user commits to the change within the modal interface
  const handleExecuteConfirmedSubmission = () => {
    const parsedPricePayload: Record<string, number> = {}
    Object.entries(prices).forEach(([gradeId, rawString]) => {
      if (rawString && rawString.length === 4) {
        parsedPricePayload[gradeId] = parseFloat(`${rawString.slice(0, 1)}.${rawString.slice(1)}`)
      }
    })

    submitPricesMutation.mutate({
      locationId: locationMongoId,
      stationName: selectedSite,
      prices: parsedPricePayload
    })
  }

  const globalLoadingState = loadingMongo || (loadingPostgres && canUpdateFuelPricing)

  return (
    <div className="h-full w-full bg-slate-50/50 p-3 flex flex-col overflow-hidden select-none">

      {/* HEADLINE ROW */}
      <div className="pb-2 border-b border-slate-200/60 shrink-0">
        <h2 className="text-xs font-black tracking-wide text-slate-700 uppercase flex items-center gap-1.5 truncate">
          <Coins className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>Set Fuel Prices for</span>
          <span className="text-sky-600 text-md font-black normal-case tracking-normal uppercase truncate">
            {selectedSite || "None Selected"}
          </span>
        </h2>
      </div>

      {globalLoadingState && (
        <div className="p-4 text-center text-[11px] font-semibold text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" />
          Consolidating fuel pricing sheets...
        </div>
      )}

      {mongoError && (
        <div className="m-2 p-2.5 rounded-xl border border-rose-200 bg-rose-50 text-[11px] font-medium text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          Could not sync details for "{selectedSite}".
        </div>
      )}

      {/* REJECTION SCREEN IF USER DOES NOT HAVE SET EXPLICIT PERMISSION */}
      {!globalLoadingState && !canUpdateFuelPricing && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 mt-2 rounded-2xl border border-dashed border-slate-200 bg-white/50 max-h-[calc(100vh-100px)]">
          <div className="p-3 bg-rose-50 rounded-full border border-rose-100 mb-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
          </div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Access Restrictions Enforced</h3>
          <p className="text-[11px] text-slate-400 font-medium max-w-xs mt-1 leading-relaxed">
            You do not have access to set new fuel prices. Please consult internal coordination leads to extend account operational access settings.
          </p>
        </div>
      )}

      {/* MAIN LAYOUT BLOCK */}
      {!globalLoadingState && canUpdateFuelPricing && dbLocation && (
        <div className="flex-1 min-h-0 mt-2">
          <div className="h-full overflow-y-auto pr-0.5 space-y-1.5 max-h-[calc(100vh-100px)] scrollbar-thin pb-2">
            {SORTED_DISPLAY_GRADES.map((grade) => {
              const isSellsGrade = dbLocation.availableGrades?.includes(grade.lookup)
              if (!isSellsGrade) return null

              const suggestedPriceValue = recommendedPrices[grade.id]
              const liveDataRecord = activePostgresPrices?.[grade.id]
              const livePostgresVal = liveDataRecord?.price !== undefined ? liveDataRecord.price : liveDataRecord
              const rawTimestamp = liveDataRecord?.updatedAt

              const localFormattedTime = formatStationTimestamp(rawTimestamp, stationTimeZone)

              const cleanInputString = prices[grade.id] || ""
              const formattedLiveCompareString = livePostgresVal ? String(livePostgresVal).replace('.', '') : ""
              const isUnchangedValue = cleanInputString !== "" && cleanInputString === formattedLiveCompareString

              return (
                <Card key={grade.id} className="border border-slate-200 shadow-sm bg-white overflow-hidden rounded-xl">
                  <CardContent className="py-1.5 px-2.5 space-y-1.5">

                    {/* TOP LINE METRICS */}
                    <div className="flex items-center justify-between gap-1 w-full text-slate-700">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded tracking-wide uppercase shrink-0 ${getFormGradeTheme(grade.lookup)}`}>
                        {grade.label}
                      </span>

                      <div className="flex items-center gap-3.5 pr-0.5 text-right">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mr-1">Cur:</span>
                          <span className="text-sm font-black text-slate-800">
                            {livePostgresVal ? `$${Number(livePostgresVal).toFixed(3)}` : '—'}
                          </span>
                          {localFormattedTime && (
                            <span className="text-[10px] font-bold text-slate-400 ml-1.5 tabular-nums">
                              ({localFormattedTime})
                            </span>
                          )}
                        </div>
                        <div className="border-l border-slate-200 pl-2.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mr-1">Rec:</span>
                          <span className="text-sm font-black text-blue-600">
                            {suggestedPriceValue ? `$${Number(suggestedPriceValue).toFixed(3)}` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* BOTTOM FORM ACTION ROW */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 gap-2">
                      <div className="flex items-center gap-1.5 pl-0.5">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                          Target Input
                        </span>
                        {isUnchangedValue && (
                          <span className="text-[10px] font-bold text-amber-500 normal-case tracking-normal">
                            (unchanged)
                          </span>
                        )}
                      </div>

                      <InputOTP
                        maxLength={4}
                        value={cleanInputString}
                        onChange={(val) => handlePriceValueChange(grade.id, val)}
                      >
                        <InputOTPGroup className="bg-white scale-90 origin-right">
                          <InputOTPSlot index={0} className="w-8 h-8 text-xs font-black border-slate-200 focus:border-blue-500 rounded-l-lg" />
                        </InputOTPGroup>
                        <InputOTPSeparator className="text-slate-400 font-bold text-sm mx-0.5 scale-90" />
                        <InputOTPGroup className="bg-white scale-90 origin-right">
                          <InputOTPSlot index={1} className="w-8 h-8 text-xs font-bold border-slate-200" />
                          <InputOTPSlot index={2} className="w-8 h-8 text-xs font-bold border-slate-200" />
                          <InputOTPSlot index={3} className="w-8 h-8 text-xs font-bold border-slate-200 rounded-r-lg" />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>

                  </CardContent>
                </Card>
              )
            })}

            {/* TRIGGER MODAL INSTEAD OF FIRING MUTATION DIRECTLY */}
            {dbLocation.availableGrades?.length > 0 && (
              <Button
                onClick={handleOpenConfirmationDialog}
                className="w-full h-9 bg-slate-900 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-all shadow-md shrink-0 gap-1.5 !mt-3"
              >
                <Save className="h-3.5 w-3.5" />
                Publish Price Updates
              </Button>
            )}

          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG PORTAL CONTAINER */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-4 border border-slate-200 shadow-xl gap-3">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xs font-black tracking-wide text-slate-800 uppercase">
              Publishing Price for <span className="text-sky-600 normal-case uppercase">{selectedSite}</span>
            </DialogTitle>
            <DialogDescription className="text-[11px] text-slate-400 font-medium">
              Review current state transitions before final dispatch to production ledger tables.
            </DialogDescription>
          </DialogHeader>

          {/* DELTA RECONCILIATION OVERVIEW */}
          <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50 p-1.5 space-y-1.5">
            {dbLocation && SORTED_DISPLAY_GRADES.map((grade) => {
              const isSellsGrade = dbLocation.availableGrades?.includes(grade.lookup)
              if (!isSellsGrade) return null

              const liveDataRecord = activePostgresPrices?.[grade.id]
              const livePostgresVal = liveDataRecord?.price !== undefined ? liveDataRecord.price : liveDataRecord

              const cleanInputString = prices[grade.id] || ""
              const formattedLiveCompareString = livePostgresVal ? String(livePostgresVal).replace('.', '') : ""
              const isUnchangedValue = cleanInputString !== "" && cleanInputString === formattedLiveCompareString

              // Parse display rate string for preview line
              let displayPrice = "—"
              if (cleanInputString.length === 4) {
                displayPrice = `$${cleanInputString.slice(0, 1)}.${cleanInputString.slice(1)}`
              }

              return (
                <div
                  key={grade.id}
                  className="flex items-center justify-between py-1.5 px-2 text-[11px] bg-white rounded-xl border border-slate-200/60 shadow-sm"
                >
                  {/* GRADE IDENTIFICATION BADGE */}
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded tracking-wide uppercase shrink-0 ${getFormGradeTheme(grade.lookup)}`}>
                    {grade.label}
                  </span>

                  {/* PRICE TRANSITION STATE */}
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mr-1">Cur:</span>
                      <span className="text-xs font-bold text-slate-500">
                        {livePostgresVal ? `$${Number(livePostgresVal).toFixed(3)}` : '—'}
                      </span>
                    </div>

                    <div className="border-l border-slate-200 pl-2.5 flex items-center gap-1.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">New:</span>
                      <span className={`text-xs font-black tracking-tight ${isUnchangedValue ? 'text-amber-600' : 'text-slate-800'}`}>
                        {displayPrice}
                      </span>

                      {isUnchangedValue && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wide uppercase bg-amber-50 text-amber-600 border border-amber-200/60 fallback-font">
                          unchanged
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* PERSISTENCE WARNING FOOTER */}
          <div className="p-2.5 rounded-xl border border-rose-100 bg-rose-50/60 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
            <span className="text-[10px] font-bold text-rose-700 leading-normal">
              WARNING: Once confirmed, changes will be published live and posted to the site for update.
            </span>
          </div>

          {/* INTERACTION ROW */}
          <DialogFooter className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              disabled={submitPricesMutation.isPending}
              onClick={() => setIsConfirmOpen(false)}
              className="h-8 border-slate-200 text-slate-600 font-bold text-[11px] px-3.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submitPricesMutation.isPending}
              onClick={handleExecuteConfirmedSubmission}
              className="h-8 bg-slate-900 hover:bg-blue-600 text-white font-bold text-[11px] px-3.5 rounded-lg transition-colors gap-1.5 shadow"
            >
              {submitPricesMutation.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Syncing...
                </>
              ) : (
                "Confirm & Publish"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}