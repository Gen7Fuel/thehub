import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { SitePicker } from '@/components/custom/sitePicker'
import { DatePicker } from '@/components/custom/datePicker'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { ImagePlus, Image as ImageIcon, HelpCircle, X } from 'lucide-react'
import { useSite } from '@/context/SiteContext'

type CashSummarySearch = { site: string; id?: string }

interface CashSummaryDoc {
  _id: string
  site?: string
  shift_number: string
  date: string
  canadian_cash_collected?: number
  item_sales?: number
  cash_back?: number
  loyalty?: number
  cpl_bulloch?: number
  exempted_tax?: number
  chequesCashedOut?: number
  debit?: number         
  visa?: number          
  mastercard?: number    
  amex?: number          
  chickenDelightTips?: number // 👈 Added Tips to interface
}

export const Route = createFileRoute('/_navbarLayout/cash-summary/form')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): CashSummarySearch => ({
    site: (search.site as string) || '',
    id: typeof search.id === 'string' ? search.id : undefined,
  }),
  loaderDeps: ({ search: { id } }) => ({ id }),
  loader: async ({ deps: { id } }) => {
    if (!id) return { existing: null as CashSummaryDoc | null, accessDenied: false };

    try {
      const res = await fetch(`/api/cash-summary/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          "X-Required-Permission": "accounting.cashSummary.form"
        },
      });

      if (!res.ok) {
        if (res.status === 403) {
          return { existing: null, accessDenied: true };
        }
        return { existing: null, accessDenied: false };
      }

      return {
        existing: (await res.json()) as CashSummaryDoc,
        accessDenied: false
      };

    } catch {
      return { existing: null, accessDenied: false };
    }
  },
});

// 💡 REUSABLE HELP DIALOG COMPONENT
function FieldHelpDialog({ 
  isOpen, 
  onClose, 
  title, 
  description, 
  imageSrc 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  description: React.ReactNode; // 🔥 Changed from string to React.ReactNode to allow JSX
  imageSrc?: string 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      {/* Increased max-w-xl to comfortably fit the wide terminal image layouts */}
      <div className="bg-background border rounded-lg max-w-xl w-full p-6 relative shadow-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <button 
          onClick={onClose}
          type="button"
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground rounded p-1 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="w-4 h-4" />
        </button>
        <div>
          <h3 className="text-lg font-bold pr-6">{title}</h3>
          <div className="text-sm text-muted-foreground mt-2">{description}</div>
        </div>
        {imageSrc && (
          <div className="border rounded-lg shadow-sm overflow-hidden bg-white w-full flex items-center justify-center">
            <img 
              src={imageSrc} 
              alt={`${title} Reference`} 
              className="w-full h-auto object-contain max-h-[45vh]" 
            />
          </div>
        )}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:opacity-90"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

function RouteComponent() {
  const { site, id } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { selectedSite } = useSite()

  useEffect(() => {
    if (!site && selectedSite) {
      navigate({ search: (prev: CashSummarySearch) => ({ ...prev, site: selectedSite }), replace: true })
    }
  }, [selectedSite])

  const { existing, accessDenied } = Route.useLoaderData() as {
    existing: CashSummaryDoc | null;
    accessDenied: boolean;
  };

  useEffect(() => {
    if (accessDenied) {
      navigate({ to: "/no-access" });
    }
  }, [accessDenied, navigate]);

  if (accessDenied) return null;

  const todayLocalMidnight = () => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
  }

  const [shiftNumber, setShiftNumber] = useState('')
  const [date, setDate] = useState<Date | undefined>(todayLocalMidnight())
  const [canadianCashCollected, setCanadianCashCollected] = useState('')
  const [itemSales, setItemSales] = useState('')
  const [cashBack, setCashBack] = useState('')
  const [loyalty, setLoyalty] = useState('')
  const [cplBulloch, setCplBulloch] = useState('')
  const [exemptedTax, setExemptedTax] = useState('')
  const [chequesCashedOut, setChequesCashedOut] = useState('') 
  
  const [debit, setDebit] = useState('')
  const [visa, setVisa] = useState('')
  const [mastercard, setMastercard] = useState('')
  const [amex, setAmex] = useState('')
  const [chickenDelightTips, setChickenDelightTips] = useState('') // 👈 State for Tips
  
  const [pinpadPhoto, setPinpadPhoto] = useState<string | null>(null)
  const [isChickenDelight, setIsChickenDelight] = useState(false)

  // Dialog management configuration states
  const [helpConfig, setHelpConfig] = useState<{ title: string; desc: string; img?: string } | null>(null)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleLongPressStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      cameraInputRef.current?.click()
      longPressTimerRef.current = null
    }, 500)
  }
  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleCameraUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/cdn/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      setPinpadPhoto(data.filename)
    } catch (err) {
      console.error(err)
      alert('Failed to upload image')
    }
    e.target.value = ''
  }
  const [showCDCheckbox, setShowCDCheckbox] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const showChequesField = (site === 'Wavers East' || site === 'Wavers West') && !isChickenDelight

  useEffect(() => {
    if (!site) return
    ;(async () => {
      try {
        const r = await fetch(`/api/locations?stationName=${encodeURIComponent(site)}`)
        const loc = await r.json()
        setShowCDCheckbox(!!loc?.chickenDelightSection)
      } catch {
        // silently ignore
      }
    })()
  }, [site])

  useEffect(() => {
    if (!existing) return

    setShiftNumber(existing.shift_number)
    const [yy, mm, dd] = existing.date.slice(0, 10).split('-').map(Number)
    setDate(new Date(yy, mm - 1, dd, 0, 0, 0, 0))
    setCanadianCashCollected(toStr(existing.canadian_cash_collected))
    setItemSales(toStr(existing.item_sales))
    setCashBack(toStr(existing.cash_back))
    setLoyalty(toStr(existing.loyalty))
    setCplBulloch(toStr(existing.cpl_bulloch))
    setExemptedTax(toStr(existing.exempted_tax))
    setChequesCashedOut(toStr(existing.chequesCashedOut)) 
    
    const tendersArr = (existing as any).tenders || [];
    const findTender = (k: string) => tendersArr.find((t: any) => t.key === k)?.value;

    setDebit(toStr(findTender('debit')))
    setVisa(toStr(findTender('visa')))
    setMastercard(toStr(findTender('mastercard')))
    setAmex(toStr(findTender('amex')))
    setChickenDelightTips(toStr((existing as any).chickenDelightTips)) // 👈 Sync tips field
    
    setPinpadPhoto((existing as any).pinpadPhoto ?? null)
    setIsChickenDelight((existing as any).isChickenDelight ?? false)
    setSuccess(null)
    setError(null)

    const shiftNum = existing.shift_number
    const dateStr = existing.date.slice(0, 10)

      ; (async () => {
        try {
          const qs = site ? `?site=${encodeURIComponent(site)}` : ''
          const checkRes = await fetch(`/api/sftp/check/${encodeURIComponent(shiftNum)}${qs}`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
              'X-Required-Permission': 'accounting.cashSummary.form',
            },
          })
          if (!checkRes.ok) return
          const { valid } = await checkRes.json()
          if (!valid) return

          const [yy, mm, dd] = dateStr.split('-').map(Number)
          const dateISO = new Date(yy, mm - 1, dd, 0, 0, 0, 0).toISOString()

          await fetch(`/api/cash-summary/${existing._id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
              'X-Required-Permission': 'accounting.cashSummary.form',
            },
            body: JSON.stringify({
              site: site || undefined,
              shift_number: shiftNum,
              date: dateISO,
              canadian_cash_collected: existing.canadian_cash_collected,
              exempted_tax: existing.exempted_tax,
              chequesCashedOut: existing.chequesCashedOut,
              tenders: tendersArr, 
              chickenDelightTips: (existing as any).chickenDelightTips
            }),
          })
        } catch {
          // silent — auto-sync is best-effort
        }
      })()
  }, [existing])

  const updateSite = (newSite: string) =>
    navigate({ search: (prev: CashSummarySearch) => ({ ...prev, site: newSite }) })

  const num = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(/,/g, '')))
  const toStr = (v: number | undefined) => (v == null ? '' : String(v))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    if (!shiftNumber.trim()) {
      setError('Shift number required')
      setSubmitting(false)
      return
    }
    if (!date) {
      setError('Date required')
      setSubmitting(false)
      return
    }
    if (showCDCheckbox && isChickenDelight && !pinpadPhoto) {
      setError('A pinpad receipt photo is required for Chicken Delight shifts')
      setSubmitting(false)
      return
    }

    const toLocalMidnightISO = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString()

    const payload = {
      site: site || undefined,
      shift_number: shiftNumber.trim(),
      date: toLocalMidnightISO(date),
      canadian_cash_collected: num(canadianCashCollected),
      item_sales: num(itemSales),
      cash_back: num(cashBack),
      loyalty: num(loyalty),
      cpl_bulloch: num(cplBulloch),
      chequesCashedOut: showChequesField ? num(chequesCashedOut) : undefined,
      ...(showCDCheckbox && isChickenDelight
        ? { 
            tenders: [
              { key: 'debit', value: num(debit) },
              { key: 'visa', value: num(visa) },
              { key: 'mastercard', value: num(mastercard) },
              { key: 'amex', value: num(amex) }
            ],
            chickenDelightTips: num(chickenDelightTips), // 👈 Send tips payload data
            pinpadPhoto: pinpadPhoto ?? undefined 
          }
        : { exempted_tax: num(exemptedTax) }),
      ...(showCDCheckbox ? { isChickenDelight } : {}),
    }

    try {
      const res = await fetch(id ? `/api/cash-summary/${id}` : '/api/cash-summary', {
        method: id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          "X-Required-Permission": "accounting.cashSummary.form"
        },
        body: JSON.stringify(payload),
      })
      if (res.status === 403) {
        navigate({ to: "/no-access" });
        return;
      }
      if (!res.ok) throw new Error(await res.text())

      await res.json()

      if (!id) {
        navigate({ to: '/cash-summary/list', search: { site } })
        return
      }

      setSuccess('Updated')
    } catch (err: any) {
      setError(err.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleNew = () => {
    navigate({ search: { site, id: undefined } })
    setShiftNumber('')
    setDate(todayLocalMidnight())
    setCanadianCashCollected('')
    setItemSales('')
    setCashBack('')
    setLoyalty('')
    setCplBulloch('')
    setExemptedTax('')
    setChequesCashedOut('') 
    setDebit('')
    setVisa('')
    setMastercard('')
    setAmex('')
    setChickenDelightTips('') // 👈 Clear out tips on new form initialization
    setPinpadPhoto(null)
    setIsChickenDelight(false)
    setSuccess(null)
    setError(null)
  }

  const checkShift = async (value: string) => {
    const v = value.trim()
    if (!v) return
    try {
      const qs = site ? `?site=${encodeURIComponent(site)}` : ''
      const res = await fetch(`/api/sftp/check/${encodeURIComponent(v)}${qs}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          "X-Required-Permission": "accounting.cashSummary.form"
        },
      })
      if (res.status === 403) {
        navigate({ to: "/no-access" });
        return;
      }
      if (!res.ok) throw new Error('Shift check failed')

      const { valid } = await res.json()
      setError(valid ? '' : 'This shift number seems to be invalid, please check again.')
    } catch (err: any) {
      setError('')
    }
  }

  return (
    <div className="pt-16 flex flex-col items-center w-full">
      <div className="w-full max-w-2xl space-y-6 p-4">
        <SitePicker
          value={site}
          onValueChange={updateSite}
          placeholder="Pick a site"
          label="Site"
          className="w-[220px]"
        />

        <form onSubmit={handleSubmit} className="space-y-5 border rounded-md p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold">
              {id ? `Edit Cash Summary (${shiftNumber || id})` : 'New Cash Summary'}
            </h2>
            <div className="flex items-center gap-2">
              {showCDCheckbox && (
                <button
                  type="button"
                  onClick={() => setIsChickenDelight(!isChickenDelight)}
                  title={isChickenDelight ? 'Marked as Chicken Delight shift — click to unmark' : 'Click to mark as Chicken Delight shift'}
                  className={`block rounded overflow-hidden transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                    isChickenDelight ? '' : 'grayscale opacity-50'
                  }`}
                >
                  <img
                    src="/assets/images/Chicken_Delight_Current_Logo.jpg"
                    alt="Chicken Delight"
                    className="h-7 w-auto"
                  />
                </button>
              )}
              {id && (
                <button
                  type="button"
                  onClick={handleNew}
                  className="text-xs px-2 py-1 border rounded hover:bg-muted"
                >
                  New
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Shift Number *">
              <InputOTP
                maxLength={5}
                pattern={REGEXP_ONLY_DIGITS}
                value={shiftNumber}
                onChange={setShiftNumber}
                onBlur={() => checkShift(shiftNumber)}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4].map(i => <InputOTPSlot key={i} index={i} />)}
                </InputOTPGroup>
              </InputOTP>
            </Field>
            
            <Field label="Date *">
              <DatePicker
                date={date}
                setDate={setDate}
                restrictToPast
              />
            </Field>

            {/* 📝 REMOVED HELP CLICK FROM CANADIAN CASH COLLECTED */}
            <Field label="Canadian Cash Collected">
              <input
                value={canadianCashCollected}
                onChange={(e) => setCanadianCashCollected(e.target.value)}
                className="w-full border rounded px-3 py-2"
                inputMode="decimal"
              />
            </Field>

            {showCDCheckbox && isChickenDelight ? (
              <>
                <div className="sm:col-span-2 border rounded p-3 bg-muted/20 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chicken Delight Transaction Metrics</span>
                    {!pinpadPhoto ? (
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        title="Upload pinpad receipt photo (required)"
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 border rounded border-amber-500 text-amber-600 bg-amber-50/50 hover:bg-amber-50"
                      >
                        <ImagePlus className="w-3.5 h-3.5" /> Upload Receipt *
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => window.open(`/cdn/download/${pinpadPhoto}`, '_blank')}
                        onContextMenu={(e) => { e.preventDefault(); cameraInputRef.current?.click() }}
                        onTouchStart={handleLongPressStart}
                        onTouchEnd={handleLongPressEnd}
                        onTouchMove={handleLongPressEnd}
                        title="View pinpad receipt photo (long press to replace)"
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white"
                      >
                        <ImageIcon className="w-3.5 h-3.5" /> View Receipt
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 grid-cols-2">
                    {/* 💳 DEBIT FIELD WITH DYNAMIC INFO MODAL */}
                    <Field 
                      label="Debit"
                      onHelpClick={() => setHelpConfig({
                        title: 'Debit Reference',
                        desc: '', // Uses global layout structure inside FieldHelpDialog below
                        img: '\\public\\cd_images\\debit.jpg'
                      })}
                    >
                      <input
                        value={debit}
                        onChange={(e) => setDebit(e.target.value)}
                        className="w-full border rounded px-3 py-1.5 text-sm"
                        inputMode="decimal"
                        placeholder="0.00"
                      />
                    </Field>

                    {/* 💳 VISA FIELD WITH DYNAMIC INFO MODAL */}
                    <Field 
                      label="Visa"
                      onHelpClick={() => setHelpConfig({
                        title: 'Visa Reference',
                        desc: '',
                        img: '\\public\\cd_images\\visa.jpg'
                      })}
                    >
                      <input
                        value={visa}
                        onChange={(e) => setVisa(e.target.value)}
                        className="w-full border rounded px-3 py-1.5 text-sm"
                        inputMode="decimal"
                        placeholder="0.00"
                      />
                    </Field>

                    {/* 💳 MASTERCARD FIELD WITH DYNAMIC INFO MODAL */}
                    <Field 
                      label="Mastercard"
                      onHelpClick={() => setHelpConfig({
                        title: 'Mastercard Reference',
                        desc: '',
                        img: '\\public\\cd_images\\mastercard.jpg'
                      })}
                    >
                      <input
                        value={mastercard}
                        onChange={(e) => setMastercard(e.target.value)}
                        className="w-full border rounded px-3 py-1.5 text-sm"
                        inputMode="decimal"
                        placeholder="0.00"
                      />
                    </Field>

                    {/* 💳 AMEX FIELD WITH DYNAMIC INFO MODAL */}
                    <Field 
                      label="Amex"
                      onHelpClick={() => setHelpConfig({
                        title: 'Amex Reference',
                        desc: '',
                        img: '\\public\\cd_images\\amex.jpg' // Falls back cleanly if amex image is not uniquely specified
                      })}
                    >
                      <input
                        value={amex}
                        onChange={(e) => setAmex(e.target.value)}
                        className="w-full border rounded px-3 py-1.5 text-sm"
                        inputMode="decimal"
                        placeholder="0.00"
                      />
                    </Field>

                    {/* 💵 CHICKEN DELIGHT TIPS FIELD WITH DYNAMIC INFO MODAL */}
                    <div className="col-span-2">
                      <Field 
                        label="Chicken Delight Tips"
                        onHelpClick={() => setHelpConfig({
                          title: 'Chicken Delight Tips Reference',
                          desc: '',
                          img: '\\public\\cd_images\\tips.jpg'
                        })}
                      >
                        <input
                          value={chickenDelightTips}
                          onChange={(e) => setChickenDelightTips(e.target.value)}
                          className="w-full border rounded px-3 py-1.5 text-sm bg-primary/5 border-primary/20"
                          inputMode="decimal"
                          placeholder="0.00"
                        />
                      </Field>
                    </div>
                  </div>
                  {!pinpadPhoto && (
                    <div className="text-xs text-amber-600">
                      * Photo attachment required to submit Chicken Delight shifts.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Field label="Infonet Exempted Tax">
                <input
                  value={exemptedTax}
                  onChange={(e) => setExemptedTax(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  inputMode="decimal"
                />
              </Field>
            )}

            {showChequesField && (
              <Field label="Cheques Cashed Out">
                <input
                  value={chequesCashedOut}
                  onChange={(e) => setChequesCashedOut(e.target.value)}
                  className="w-full border rounded px-3 py-2 bg-amber-50/30 border-amber-200 focus:border-amber-500"
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </Field>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50"
            >
              {submitting ? (id ? 'Updating…' : 'Saving…') : id ? 'Update' : 'Save'}
            </button>
            {error && <span className="text-red-600 text-sm">Error: {error}</span>}
            {success && <span className="text-green-600 text-sm">{success}</span>}
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCameraUpload}
          />
        </form>
      </div>

      {/* 🎯 CLEAN DYNAMIC HELP MODAL OVERLAY */}
      <FieldHelpDialog 
        isOpen={helpConfig !== null}
        onClose={() => setHelpConfig(null)}
        title={helpConfig?.title || ''}
        imageSrc={helpConfig?.img}
        description={
          <div className="space-y-3">
            <ul className="list-none space-y-2 mt-1">
              <li>
                <span className="text-red-600">●</span> <strong>Step 1:</strong> Locate the section marked by the <strong>Red Box</strong> on your terminal printout.
              </li>
              <li>
                <span className="text-green-600">●</span> <strong>Step 2:</strong> Enter the corresponding value found inside the <strong>Green Box</strong>.
              </li>
            </ul>
            <p className="text-xs font-normal opacity-70 italic text-center bg-slate-50 p-2 rounded border mt-2">
              Note: The images are for reference only and actual values may differ, but the highlighted sections will guide you to the correct values.
            </p>
          </div>
        }
      />
    </div>
  )
}

function Field({ 
  label, 
  children, 
  onHelpClick 
}: { 
  label: string; 
  children: React.ReactNode; 
  onHelpClick?: () => void 
}) {
  return (
    <div className="space-y-1 w-full">
      <div className="flex items-center gap-1.5">
        <label className="block text-sm font-medium text-foreground">{label}</label>
        {onHelpClick && (
          <button
            type="button"
            onClick={onHelpClick}
            className="text-muted-foreground hover:text-primary transition-colors rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            title="Click to view field helper guide"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

// import { createFileRoute, useNavigate } from "@tanstack/react-router";
// import { useEffect, useRef, useState } from "react";
// import { SitePicker } from "@/components/custom/sitePicker";
// import { DatePicker } from "@/components/custom/datePicker";
// import {
//   InputOTP,
//   InputOTPGroup,
//   InputOTPSlot,
// } from "@/components/ui/input-otp";
// import { REGEXP_ONLY_DIGITS } from "input-otp";
// import { ImagePlus, Image as ImageIcon } from "lucide-react";
// import { useSite } from "@/context/SiteContext";

// type CashSummarySearch = { site: string; id?: string };

// interface CashSummaryDoc {
//   _id: string;
//   site?: string;
//   shift_number: string;
//   date: string;
//   canadian_cash_collected?: number;
//   item_sales?: number;
//   cash_back?: number;
//   loyalty?: number;
//   cpl_bulloch?: number;
//   exempted_tax?: number;
//   chequesCashedOut?: number;
//   debit?: number; // 👈 Added split tender fields
//   visa?: number; // 👈
//   mastercard?: number; // 👈
//   amex?: number; // 👈
// }

// export const Route = createFileRoute("/_navbarLayout/cash-summary/form")({
//   component: RouteComponent,
//   validateSearch: (search: Record<string, unknown>): CashSummarySearch => ({
//     site: (search.site as string) || "",
//     id: typeof search.id === "string" ? search.id : undefined,
//   }),
//   loaderDeps: ({ search: { id } }) => ({ id }),
//   loader: async ({ deps: { id } }) => {
//     if (!id)
//       return { existing: null as CashSummaryDoc | null, accessDenied: false };

//     try {
//       const res = await fetch(`/api/cash-summary/${id}`, {
//         headers: {
//           Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
//           "X-Required-Permission": "accounting.cashSummary.form",
//         },
//       });

//       if (!res.ok) {
//         if (res.status === 403) {
//           return { existing: null, accessDenied: true };
//         }
//         return { existing: null, accessDenied: false };
//       }

//       return {
//         existing: (await res.json()) as CashSummaryDoc,
//         accessDenied: false,
//       };
//     } catch {
//       return { existing: null, accessDenied: false };
//     }
//   },
// });

// function RouteComponent() {
//   const { site, id } = Route.useSearch();
//   const navigate = useNavigate({ from: Route.fullPath });
//   const { selectedSite } = useSite();

//   useEffect(() => {
//     if (!site && selectedSite) {
//       navigate({
//         search: (prev: CashSummarySearch) => ({ ...prev, site: selectedSite }),
//         replace: true,
//       });
//     }
//   }, [selectedSite]);

//   const { existing, accessDenied } = Route.useLoaderData() as {
//     existing: CashSummaryDoc | null;
//     accessDenied: boolean;
//   };

//   useEffect(() => {
//     if (accessDenied) {
//       navigate({ to: "/no-access" });
//     }
//   }, [accessDenied, navigate]);

//   if (accessDenied) return null;

//   const todayLocalMidnight = () => {
//     const d = new Date();
//     return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
//   };

//   const [shiftNumber, setShiftNumber] = useState("");
//   const [date, setDate] = useState<Date | undefined>(todayLocalMidnight());
//   const [canadianCashCollected, setCanadianCashCollected] = useState("");
//   const [itemSales, setItemSales] = useState("");
//   const [cashBack, setCashBack] = useState("");
//   const [loyalty, setLoyalty] = useState("");
//   const [cplBulloch, setCplBulloch] = useState("");
//   const [exemptedTax, setExemptedTax] = useState("");
//   const [chequesCashedOut, setChequesCashedOut] = useState("");

//   // 👈 New Split Tender State Hooks
//   const [debit, setDebit] = useState("");
//   const [visa, setVisa] = useState("");
//   const [mastercard, setMastercard] = useState("");
//   const [amex, setAmex] = useState("");

//   const [pinpadPhoto, setPinpadPhoto] = useState<string | null>(null);
//   const [isChickenDelight, setIsChickenDelight] = useState(false);

//   const cameraInputRef = useRef<HTMLInputElement>(null);
//   const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

//   const handleLongPressStart = () => {
//     longPressTimerRef.current = setTimeout(() => {
//       cameraInputRef.current?.click();
//       longPressTimerRef.current = null;
//     }, 500);
//   };
//   const handleLongPressEnd = () => {
//     if (longPressTimerRef.current) {
//       clearTimeout(longPressTimerRef.current);
//       longPressTimerRef.current = null;
//     }
//   };

//   const handleCameraUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;
//     const formData = new FormData();
//     formData.append("file", file);
//     try {
//       const res = await fetch("/cdn/upload", {
//         method: "POST",
//         body: formData,
//       });
//       if (!res.ok) throw new Error("Upload failed");
//       const data = await res.json();
//       setPinpadPhoto(data.filename);
//     } catch (err) {
//       console.error(err);
//       alert("Failed to upload image");
//     }
//     e.target.value = "";
//   };
//   const [showCDCheckbox, setShowCDCheckbox] = useState(false);
//   const [submitting, setSubmitting] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [success, setSuccess] = useState<string | null>(null);

//   // Cheques Cashed Out shows for specific sites, but ONLY if it's NOT a Chicken Delight shift
//   const showChequesField =
//     (site === "Wavers East" || site === "Wavers West") && !isChickenDelight;

//   useEffect(() => {
//     if (!site) return;
//     (async () => {
//       try {
//         const r = await fetch(
//           `/api/locations?stationName=${encodeURIComponent(site)}`,
//         );
//         const loc = await r.json();
//         setShowCDCheckbox(!!loc?.chickenDelightSection);
//       } catch {
//         // silently ignore
//       }
//     })();
//   }, [site]);

//   // Populate form when existing record loads, then auto-sync from SFTP if shift is present
//   useEffect(() => {
//     if (!existing) return;

//     setShiftNumber(existing.shift_number);
//     const [yy, mm, dd] = existing.date.slice(0, 10).split("-").map(Number);
//     setDate(new Date(yy, mm - 1, dd, 0, 0, 0, 0));
//     setCanadianCashCollected(toStr(existing.canadian_cash_collected));
//     setItemSales(toStr(existing.item_sales));
//     setCashBack(toStr(existing.cash_back));
//     setLoyalty(toStr(existing.loyalty));
//     setCplBulloch(toStr(existing.cpl_bulloch));
//     setExemptedTax(toStr(existing.exempted_tax));
//     setChequesCashedOut(toStr(existing.chequesCashedOut));

//     // ✅ FIXED: Safely pull values out of the backend tenders array
//     const tendersArr = (existing as any).tenders || [];
//     const findTender = (k: string) =>
//       tendersArr.find((t: any) => t.key === k)?.value;

//     setDebit(toStr(findTender("debit")));
//     setVisa(toStr(findTender("visa")));
//     setMastercard(toStr(findTender("mastercard")));
//     setAmex(toStr(findTender("amex")));

//     setPinpadPhoto((existing as any).pinpadPhoto ?? null);
//     setIsChickenDelight((existing as any).isChickenDelight ?? false);
//     setSuccess(null);
//     setError(null);

//     const shiftNum = existing.shift_number;
//     const dateStr = existing.date.slice(0, 10);

//     (async () => {
//       try {
//         const qs = site ? `?site=${encodeURIComponent(site)}` : "";
//         const checkRes = await fetch(
//           `/api/sftp/check/${encodeURIComponent(shiftNum)}${qs}`,
//           {
//             headers: {
//               Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
//               "X-Required-Permission": "accounting.cashSummary.form",
//             },
//           },
//         );
//         if (!checkRes.ok) return;
//         const { valid } = await checkRes.json();
//         if (!valid) return;

//         const [yy, mm, dd] = dateStr.split("-").map(Number);
//         const dateISO = new Date(yy, mm - 1, dd, 0, 0, 0, 0).toISOString();

//         // ✅ FIXED: Mirror backend's nested format inside the background worker
//         await fetch(`/api/cash-summary/${existing._id}`, {
//           method: "PUT",
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
//             "X-Required-Permission": "accounting.cashSummary.form",
//           },
//           body: JSON.stringify({
//             site: site || undefined,
//             shift_number: shiftNum,
//             date: dateISO,
//             canadian_cash_collected: existing.canadian_cash_collected,
//             exempted_tax: existing.exempted_tax,
//             chequesCashedOut: existing.chequesCashedOut,
//             tenders: tendersArr, // Keep array context structural consistency
//           }),
//         });
//       } catch {
//         // silent — auto-sync is best-effort
//       }
//     })();
//   }, [existing]);

//   const updateSite = (newSite: string) =>
//     navigate({
//       search: (prev: CashSummarySearch) => ({ ...prev, site: newSite }),
//     });

//   const num = (v: string) =>
//     v.trim() === "" ? undefined : Number(v.replace(/,/g, ""));
//   const toStr = (v: number | undefined) => (v == null ? "" : String(v));

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setSubmitting(true);
//     setError(null);
//     setSuccess(null);

//     if (!shiftNumber.trim()) {
//       setError("Shift number required");
//       setSubmitting(false);
//       return;
//     }
//     if (!date) {
//       setError("Date required");
//       setSubmitting(false);
//       return;
//     }
//     if (showCDCheckbox && isChickenDelight && !pinpadPhoto) {
//       setError("A pinpad receipt photo is required for Chicken Delight shifts");
//       setSubmitting(false);
//       return;
//     }

//     // Inside your handleSubmit function...
//     const toLocalMidnightISO = (d: Date) =>
//       new Date(
//         d.getFullYear(),
//         d.getMonth(),
//         d.getDate(),
//         0,
//         0,
//         0,
//         0,
//       ).toISOString();

//     // ✅ FIXED: Map fields to array match the schema structure
//     const payload = {
//       site: site || undefined,
//       shift_number: shiftNumber.trim(),
//       date: toLocalMidnightISO(date),
//       canadian_cash_collected: num(canadianCashCollected),
//       item_sales: num(itemSales),
//       cash_back: num(cashBack),
//       loyalty: num(loyalty),
//       cpl_bulloch: num(cplBulloch),
//       chequesCashedOut: showChequesField ? num(chequesCashedOut) : undefined,
//       ...(showCDCheckbox && isChickenDelight
//         ? {
//             tenders: [
//               { key: "debit", value: num(debit) },
//               { key: "visa", value: num(visa) },
//               { key: "mastercard", value: num(mastercard) },
//               { key: "amex", value: num(amex) },
//             ],
//             pinpadPhoto: pinpadPhoto ?? undefined,
//           }
//         : {
//             exempted_tax: num(exemptedTax),
//             tenders: [], // clear out tenders if Chicken Delight is deactivated
//           }),
//       ...(showCDCheckbox ? { isChickenDelight } : {}),
//     };

//     try {
//       const res = await fetch(
//         id ? `/api/cash-summary/${id}` : "/api/cash-summary",
//         {
//           method: id ? "PUT" : "POST",
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
//             "X-Required-Permission": "accounting.cashSummary.form",
//           },
//           body: JSON.stringify(payload),
//         },
//       );
//       if (res.status === 403) {
//         navigate({ to: "/no-access" });
//         return;
//       }
//       if (!res.ok) throw new Error(await res.text());

//       await res.json();

//       if (!id) {
//         navigate({ to: "/cash-summary/list", search: { site } });
//         return;
//       }

//       setSuccess("Updated");
//     } catch (err: any) {
//       setError(err.message || "Save failed");
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const handleNew = () => {
//     navigate({ search: { site, id: undefined } });
//     setShiftNumber("");
//     setDate(todayLocalMidnight());
//     setCanadianCashCollected("");
//     setItemSales("");
//     setCashBack("");
//     setLoyalty("");
//     setCplBulloch("");
//     setExemptedTax("");
//     setChequesCashedOut("");
//     setDebit("");
//     setVisa("");
//     setMastercard("");
//     setAmex("");
//     setPinpadPhoto(null);
//     setIsChickenDelight(false);
//     setSuccess(null);
//     setError(null);
//   };

//   const checkShift = async (value: string) => {
//     const v = value.trim();
//     if (!v) return;
//     try {
//       const qs = site ? `?site=${encodeURIComponent(site)}` : "";
//       const res = await fetch(`/api/sftp/check/${encodeURIComponent(v)}${qs}`, {
//         headers: {
//           Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
//           "X-Required-Permission": "accounting.cashSummary.form",
//         },
//       });
//       if (res.status === 403) {
//         navigate({ to: "/no-access" });
//         return;
//       }
//       if (!res.ok) throw new Error("Shift check failed");

//       const { valid } = await res.json();
//       setError(
//         valid
//           ? ""
//           : "This shift number seems to be invalid, please check again.",
//       );
//     } catch (err: any) {
//       setError("");
//     }
//   };

//   return (
//     <div className="pt-16 flex flex-col items-center w-full">
//       <div className="w-full max-w-2xl space-y-6 p-4">
//         <SitePicker
//           value={site}
//           onValueChange={updateSite}
//           placeholder="Pick a site"
//           label="Site"
//           className="w-[220px]"
//         />

//         <form
//           onSubmit={handleSubmit}
//           className="space-y-5 border rounded-md p-4"
//         >
//           <div className="flex justify-between items-center mb-2">
//             <h2 className="text-sm font-semibold">
//               {id
//                 ? `Edit Cash Summary (${shiftNumber || id})`
//                 : "New Cash Summary"}
//             </h2>
//             <div className="flex items-center gap-2">
//               {showCDCheckbox && (
//                 <button
//                   type="button"
//                   onClick={() => setIsChickenDelight(!isChickenDelight)}
//                   title={
//                     isChickenDelight
//                       ? "Marked as Chicken Delight shift — click to unmark"
//                       : "Click to mark as Chicken Delight shift"
//                   }
//                   className={`block rounded overflow-hidden transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
//                     isChickenDelight ? "" : "grayscale opacity-50"
//                   }`}
//                 >
//                   <img
//                     src="/public/assets/images/Chicken_Delight_Current_Logo.jpg"
//                     alt="Chicken Delight"
//                     className="h-7 w-auto"
//                   />
//                 </button>
//               )}
//               {id && (
//                 <button
//                   type="button"
//                   onClick={handleNew}
//                   className="text-xs px-2 py-1 border rounded hover:bg-muted"
//                 >
//                   New
//                 </button>
//               )}
//             </div>
//           </div>

//           <div className="grid gap-4 sm:grid-cols-2">
//             <Field label="Shift Number *">
//               <InputOTP
//                 maxLength={5}
//                 pattern={REGEXP_ONLY_DIGITS}
//                 value={shiftNumber}
//                 onChange={setShiftNumber}
//                 onBlur={() => checkShift(shiftNumber)}
//               >
//                 <InputOTPGroup>
//                   {[0, 1, 2, 3, 4].map((i) => (
//                     <InputOTPSlot key={i} index={i} />
//                   ))}
//                 </InputOTPGroup>
//               </InputOTP>
//             </Field>
//             <Field label="Date *">
//               <DatePicker date={date} setDate={setDate} restrictToPast />
//             </Field>
//             <Field label="Canadian Cash Collected">
//               <input
//                 value={canadianCashCollected}
//                 onChange={(e) => setCanadianCashCollected(e.target.value)}
//                 className="w-full border rounded px-3 py-2"
//                 inputMode="decimal"
//               />
//             </Field>

//             {/* Conditionally swap Pinpad single total with individual split tenders */}
//             {showCDCheckbox && isChickenDelight ? (
//               <>
//                 <div className="sm:col-span-2 border rounded p-3 bg-muted/20 space-y-4">
//                   <div className="flex justify-between items-center">
//                     <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
//                       Chicken Delight Tender Split
//                     </span>
//                     {!pinpadPhoto ? (
//                       <button
//                         type="button"
//                         onClick={() => cameraInputRef.current?.click()}
//                         title="Upload pinpad receipt photo (required)"
//                         className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 border rounded border-amber-500 text-amber-600 bg-amber-50/50 hover:bg-amber-50"
//                       >
//                         <ImagePlus className="w-3.5 h-3.5" /> Upload Receipt *
//                       </button>
//                     ) : (
//                       <button
//                         type="button"
//                         onClick={() =>
//                           window.open(`/cdn/download/${pinpadPhoto}`, "_blank")
//                         }
//                         onContextMenu={(e) => {
//                           e.preventDefault();
//                           cameraInputRef.current?.click();
//                         }}
//                         onTouchStart={handleLongPressStart}
//                         onTouchEnd={handleLongPressEnd}
//                         onTouchMove={handleLongPressEnd}
//                         title="View pinpad receipt photo (long press to replace)"
//                         className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white"
//                       >
//                         <ImageIcon className="w-3.5 h-3.5" /> View Receipt
//                       </button>
//                     )}
//                   </div>

//                   <div className="grid gap-3 grid-cols-2">
//                     <Field label="Debit">
//                       <input
//                         value={debit}
//                         onChange={(e) => setDebit(e.target.value)}
//                         className="w-full border rounded px-3 py-1.5 text-sm"
//                         inputMode="decimal"
//                         placeholder="0.00"
//                       />
//                     </Field>
//                     <Field label="Visa">
//                       <input
//                         value={visa}
//                         onChange={(e) => setVisa(e.target.value)}
//                         className="w-full border rounded px-3 py-1.5 text-sm"
//                         inputMode="decimal"
//                         placeholder="0.00"
//                       />
//                     </Field>
//                     <Field label="Mastercard">
//                       <input
//                         value={mastercard}
//                         onChange={(e) => setMastercard(e.target.value)}
//                         className="w-full border rounded px-3 py-1.5 text-sm"
//                         inputMode="decimal"
//                         placeholder="0.00"
//                       />
//                     </Field>
//                     <Field label="Amex">
//                       <input
//                         value={amex}
//                         onChange={(e) => setAmex(e.target.value)}
//                         className="w-full border rounded px-3 py-1.5 text-sm"
//                         inputMode="decimal"
//                         placeholder="0.00"
//                       />
//                     </Field>
//                   </div>
//                   {!pinpadPhoto && (
//                     <div className="text-xs text-amber-600">
//                       * Photo attachment required to submit Chicken Delight
//                       shifts.
//                     </div>
//                   )}
//                 </div>
//               </>
//             ) : (
//               <Field label="Infonet Exempted Tax">
//                 <input
//                   value={exemptedTax}
//                   onChange={(e) => setExemptedTax(e.target.value)}
//                   className="w-full border rounded px-3 py-2"
//                   inputMode="decimal"
//                 />
//               </Field>
//             )}

//             {showChequesField && (
//               <Field label="Cheques Cashed Out">
//                 <input
//                   value={chequesCashedOut}
//                   onChange={(e) => setChequesCashedOut(e.target.value)}
//                   className="w-full border rounded px-3 py-2 bg-amber-50/30 border-amber-200 focus:border-amber-500"
//                   inputMode="decimal"
//                   placeholder="0.00"
//                 />
//               </Field>
//             )}
//           </div>

//           <div className="flex items-center gap-4">
//             <button
//               type="submit"
//               disabled={submitting}
//               className="px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50"
//             >
//               {submitting
//                 ? id
//                   ? "Updating…"
//                   : "Saving…"
//                 : id
//                   ? "Update"
//                   : "Save"}
//             </button>
//             {error && (
//               <span className="text-red-600 text-sm">Error: {error}</span>
//             )}
//             {success && (
//               <span className="text-green-600 text-sm">{success}</span>
//             )}
//           </div>

//           <input
//             ref={cameraInputRef}
//             type="file"
//             accept="image/*"
//             capture="environment"
//             className="hidden"
//             onChange={handleCameraUpload}
//           />
//         </form>
//       </div>
//     </div>
//   );
// }

// function Field({
//   label,
//   children,
// }: {
//   label: string;
//   children: React.ReactNode;
// }) {
//   return (
//     <div>
//       <label className="block text-sm mb-1">{label}</label>
//       {children}
//     </div>
//   );
// }



// import { createFileRoute, useNavigate } from '@tanstack/react-router'
// import { useEffect, useRef, useState } from 'react'
// import { SitePicker } from '@/components/custom/sitePicker'
// import { DatePicker } from '@/components/custom/datePicker'
// import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
// import { REGEXP_ONLY_DIGITS } from 'input-otp'
// import { ImagePlus, Image as ImageIcon } from 'lucide-react'
// import { useSite } from '@/context/SiteContext'

// type CashSummarySearch = { site: string; id?: string }

// interface CashSummaryDoc {
//   _id: string
//   site?: string
//   shift_number: string
//   date: string
//   canadian_cash_collected?: number
//   item_sales?: number
//   cash_back?: number
//   loyalty?: number
//   cpl_bulloch?: number
//   exempted_tax?: number
//   chequesCashedOut?: number // 👈 Added to interface
// }

// export const Route = createFileRoute('/_navbarLayout/cash-summary/form')({
//   component: RouteComponent,
//   validateSearch: (search: Record<string, unknown>): CashSummarySearch => ({
//     site: (search.site as string) || '',
//     id: typeof search.id === 'string' ? search.id : undefined,
//   }),
//   loaderDeps: ({ search: { id } }) => ({ id }),
//   loader: async ({ deps: { id } }) => {
//     if (!id) return { existing: null as CashSummaryDoc | null, accessDenied: false };

//     try {
//       const res = await fetch(`/api/cash-summary/${id}`, {
//         headers: {
//           Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
//           "X-Required-Permission": "accounting.cashSummary.form"
//         },
//       });

//       if (!res.ok) {
//         if (res.status === 403) {
//           return { existing: null, accessDenied: true };
//         }
//         return { existing: null, accessDenied: false };
//       }

//       return {
//         existing: (await res.json()) as CashSummaryDoc,
//         accessDenied: false
//       };

//     } catch {
//       return { existing: null, accessDenied: false };
//     }
//   },
// });

// function RouteComponent() {
//   const { site, id } = Route.useSearch()
//   const navigate = useNavigate({ from: Route.fullPath })
//   const { selectedSite } = useSite()

//   useEffect(() => {
//     if (!site && selectedSite) {
//       navigate({ search: (prev: CashSummarySearch) => ({ ...prev, site: selectedSite }), replace: true })
//     }
//   }, [selectedSite])

//   const { existing, accessDenied } = Route.useLoaderData() as {
//     existing: CashSummaryDoc | null;
//     accessDenied: boolean;
//   };

//   useEffect(() => {
//     if (accessDenied) {
//       navigate({ to: "/no-access" });
//     }
//   }, [accessDenied, navigate]);

//   if (accessDenied) return null;

//   const todayLocalMidnight = () => {
//     const d = new Date()
//     return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
//   }

//   const [shiftNumber, setShiftNumber] = useState('')
//   const [date, setDate] = useState<Date | undefined>(todayLocalMidnight())
//   const [canadianCashCollected, setCanadianCashCollected] = useState('')
//   const [itemSales, setItemSales] = useState('')
//   const [cashBack, setCashBack] = useState('')
//   const [loyalty, setLoyalty] = useState('')
//   const [cplBulloch, setCplBulloch] = useState('')
//   const [exemptedTax, setExemptedTax] = useState('')
//   const [chequesCashedOut, setChequesCashedOut] = useState('') // 👈 Added state hook
//   const [pinpadTotal, setPinpadTotal] = useState('')
//   const [pinpadPhoto, setPinpadPhoto] = useState<string | null>(null)
//   const [isChickenDelight, setIsChickenDelight] = useState(false)

//   const cameraInputRef = useRef<HTMLInputElement>(null)
//   const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

//   const handleLongPressStart = () => {
//     longPressTimerRef.current = setTimeout(() => {
//       cameraInputRef.current?.click()
//       longPressTimerRef.current = null
//     }, 500)
//   }
//   const handleLongPressEnd = () => {
//     if (longPressTimerRef.current) {
//       clearTimeout(longPressTimerRef.current)
//       longPressTimerRef.current = null
//     }
//   }

//   const handleCameraUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0]
//     if (!file) return
//     const formData = new FormData()
//     formData.append('file', file)
//     try {
//       const res = await fetch('/cdn/upload', { method: 'POST', body: formData })
//       if (!res.ok) throw new Error('Upload failed')
//       const data = await res.json()
//       setPinpadPhoto(data.filename)
//     } catch (err) {
//       console.error(err)
//       alert('Failed to upload image')
//     }
//     e.target.value = ''
//   }
//   const [showCDCheckbox, setShowCDCheckbox] = useState(false)
//   const [submitting, setSubmitting] = useState(false)
//   const [error, setError] = useState<string | null>(null)
//   const [success, setSuccess] = useState<string | null>(null)

//   // Determine if the selected site is allowed to see the Cheques Cashed Out field
//   const showChequesField = site === 'Wavers East' || site === 'Wavers West'

//   // Fetch location config when site changes to determine if CD checkbox should be shown
//   useEffect(() => {
//     if (!site) return
//     ;(async () => {
//       try {
//         const r = await fetch(`/api/locations?stationName=${encodeURIComponent(site)}`)
//         const loc = await r.json()
//         setShowCDCheckbox(!!loc?.chickenDelightSection)
//       } catch {
//         // silently ignore — checkbox stays hidden on fetch failure
//       }
//     })()
//   }, [site])

//   // Populate form when existing record loads, then auto-sync from SFTP if shift is present
//   useEffect(() => {
//     if (!existing) return

//     setShiftNumber(existing.shift_number)
//     const [yy, mm, dd] = existing.date.slice(0, 10).split('-').map(Number)
//     setDate(new Date(yy, mm - 1, dd, 0, 0, 0, 0))
//     setCanadianCashCollected(toStr(existing.canadian_cash_collected))
//     setItemSales(toStr(existing.item_sales))
//     setCashBack(toStr(existing.cash_back))
//     setLoyalty(toStr(existing.loyalty))
//     setCplBulloch(toStr(existing.cpl_bulloch))
//     setExemptedTax(toStr(existing.exempted_tax))
//     setChequesCashedOut(toStr(existing.chequesCashedOut)) // 👈 Sync existing data payload
//     setPinpadTotal(toStr((existing as any).pinpadTotal))
//     setPinpadPhoto((existing as any).pinpadPhoto ?? null)
//     setIsChickenDelight((existing as any).isChickenDelight ?? false)
//     setSuccess(null)
//     setError(null)

//     const shiftNum = existing.shift_number
//     const dateStr = existing.date.slice(0, 10)

//       ; (async () => {
//         try {
//           const qs = site ? `?site=${encodeURIComponent(site)}` : ''
//           const checkRes = await fetch(`/api/sftp/check/${encodeURIComponent(shiftNum)}${qs}`, {
//             headers: {
//               Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
//               'X-Required-Permission': 'accounting.cashSummary.form',
//             },
//           })
//           if (!checkRes.ok) return
//           const { valid } = await checkRes.json()
//           if (!valid) return

//           const [yy, mm, dd] = dateStr.split('-').map(Number)
//           const dateISO = new Date(yy, mm - 1, dd, 0, 0, 0, 0).toISOString()

//           await fetch(`/api/cash-summary/${existing._id}`, {
//             method: 'PUT',
//             headers: {
//               'Content-Type': 'application/json',
//               Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
//               'X-Required-Permission': 'accounting.cashSummary.form',
//             },
//             body: JSON.stringify({
//               site: site || undefined,
//               shift_number: shiftNum,
//               date: dateISO,
//               canadian_cash_collected: existing.canadian_cash_collected,
//               exempted_tax: existing.exempted_tax,
//               chequesCashedOut: existing.chequesCashedOut, // 👈 Sync inside background auto-saver
//             }),
//           })
//         } catch {
//           // silent — auto-sync is best-effort
//         }
//       })()
//   }, [existing])

//   const updateSite = (newSite: string) =>
//     navigate({ search: (prev: CashSummarySearch) => ({ ...prev, site: newSite }) })

//   const num = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(/,/g, '')))
//   const toStr = (v: number | undefined) => (v == null ? '' : String(v))

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault()
//     setSubmitting(true)
//     setError(null)
//     setSuccess(null)

//     if (!shiftNumber.trim()) {
//       setError('Shift number required')
//       setSubmitting(false)
//       return
//     }
//     if (!date) {
//       setError('Date required')
//       setSubmitting(false)
//       return
//     }
//     if (showCDCheckbox && isChickenDelight && !pinpadPhoto) {
//       setError('A pinpad receipt photo is required for Chicken Delight shifts')
//       setSubmitting(false)
//       return
//     }

//     const toLocalMidnightISO = (d: Date) =>
//       new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString()

//     const payload = {
//       site: site || undefined,
//       shift_number: shiftNumber.trim(),
//       date: toLocalMidnightISO(date),
//       canadian_cash_collected: num(canadianCashCollected),
//       item_sales: num(itemSales),
//       cash_back: num(cashBack),
//       loyalty: num(loyalty),
//       cpl_bulloch: num(cplBulloch),
//       chequesCashedOut: showChequesField ? num(chequesCashedOut) : undefined,
//       ...(showCDCheckbox && isChickenDelight
//         ? { pinpadTotal: num(pinpadTotal), pinpadPhoto: pinpadPhoto ?? undefined }
//         : { exempted_tax: num(exemptedTax) }),
//       ...(showCDCheckbox ? { isChickenDelight } : {}),
//     }

//     try {
//       const res = await fetch(id ? `/api/cash-summary/${id}` : '/api/cash-summary', {
//         method: id ? 'PUT' : 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
//           "X-Required-Permission": "accounting.cashSummary.form"
//         },
//         body: JSON.stringify(payload),
//       })
//       if (res.status === 403) {
//         navigate({ to: "/no-access" });
//         return;
//       }
//       if (!res.ok) throw new Error(await res.text())

//       await res.json()

//       if (!id) {
//         navigate({ to: '/cash-summary/list', search: { site } })
//         return
//       }

//       setSuccess('Updated')
//     } catch (err: any) {
//       setError(err.message || 'Save failed')
//     } finally {
//       setSubmitting(false)
//     }
//   }

//   const handleNew = () => {
//     navigate({ search: { site, id: undefined } })
//     setShiftNumber('')
//     setDate(todayLocalMidnight())
//     setCanadianCashCollected('')
//     setItemSales('')
//     setCashBack('')
//     setLoyalty('')
//     setCplBulloch('')
//     setExemptedTax('')
//     setChequesCashedOut('') // 👈 Clear down hook context
//     setPinpadTotal('')
//     setPinpadPhoto(null)
//     setIsChickenDelight(false)
//     setSuccess(null)
//     setError(null)
//   }

//   // Validate the shift number on blur via secured endpoint
//   const checkShift = async (value: string) => {
//     const v = value.trim()
//     if (!v) return
//     try {
//       const qs = site ? `?site=${encodeURIComponent(site)}` : ''
//       const res = await fetch(`/api/sftp/check/${encodeURIComponent(v)}${qs}`, {
//         headers: {
//           Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
//           "X-Required-Permission": "accounting.cashSummary.form"
//         },
//       })
//       if (res.status === 403) {
//         navigate({ to: "/no-access" });
//         return;
//       }
//       if (!res.ok) throw new Error('Shift check failed')

//       // ✅ FIXED: Changed checkRes to res
//       const { valid } = await res.json()
//       setError(valid ? '' : 'This shift number seems to be invalid, please check again.')
//     } catch (err: any) { // ✅ FIXED: Added explicit any type to error block
//       // On network/server error, do not block user
//       setError('')
//     }
//   }

//   return (
//     <div className="pt-16 flex flex-col items-center w-full">
//       <div className="w-full max-w-2xl space-y-6 p-4">
//         <SitePicker
//           value={site}
//           onValueChange={updateSite}
//           placeholder="Pick a site"
//           label="Site"
//           className="w-[220px]"
//         />

//         <form onSubmit={handleSubmit} className="space-y-5 border rounded-md p-4">
//           <div className="flex justify-between items-center mb-2">
//             <h2 className="text-sm font-semibold">
//               {id ? `Edit Cash Summary (${shiftNumber || id})` : 'New Cash Summary'}
//             </h2>
//             <div className="flex items-center gap-2">
//               {showCDCheckbox && (
//                 <button
//                   type="button"
//                   onClick={() => setIsChickenDelight(!isChickenDelight)}
//                   title={isChickenDelight ? 'Marked as Chicken Delight shift — click to unmark' : 'Click to mark as Chicken Delight shift'}
//                   className={`block rounded overflow-hidden transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
//                     isChickenDelight ? '' : 'grayscale opacity-50'
//                   }`}
//                 >
//                   <img
//                     src="/assets/images/Chicken_Delight_Current_Logo.jpg"
//                     alt="Chicken Delight"
//                     className="h-7 w-auto"
//                   />
//                 </button>
//               )}
//               {id && (
//                 <button
//                   type="button"
//                   onClick={handleNew}
//                   className="text-xs px-2 py-1 border rounded hover:bg-muted"
//                 >
//                   New
//                 </button>
//               )}
//             </div>
//           </div>

//           <div className="grid gap-4 sm:grid-cols-2">
//             <Field label="Shift Number *">
//               <InputOTP
//                 maxLength={5}
//                 pattern={REGEXP_ONLY_DIGITS}
//                 value={shiftNumber}
//                 onChange={setShiftNumber}
//                 onBlur={() => checkShift(shiftNumber)}
//               >
//                 <InputOTPGroup>
//                   {[0, 1, 2, 3, 4].map(i => <InputOTPSlot key={i} index={i} />)}
//                 </InputOTPGroup>
//               </InputOTP>
//             </Field>
//             <Field label="Date *">
//               <DatePicker
//                 date={date}
//                 setDate={setDate}
//                 restrictToPast
//               />
//             </Field>
//             <Field label="Canadian Cash Collected">
//               <input
//                 value={canadianCashCollected}
//                 onChange={(e) => setCanadianCashCollected(e.target.value)}
//                 className="w-full border rounded px-3 py-2"
//                 inputMode="decimal"
//               />
//             </Field>

//             {showCDCheckbox && isChickenDelight ? (
//               <Field label="Pinpad Total (photo required) *">
//                 <div className="flex items-center gap-2">
//                   <input
//                     value={pinpadTotal}
//                     onChange={(e) => setPinpadTotal(e.target.value)}
//                     className="flex-1 min-w-0 border rounded px-3 py-2"
//                     inputMode="decimal"
//                     placeholder="0.00"
//                   />
//                   {!pinpadPhoto ? (
//                     <button
//                       type="button"
//                       onClick={() => cameraInputRef.current?.click()}
//                       title="Upload pinpad receipt photo (required)"
//                       className="flex-shrink-0 flex items-center justify-center w-10 h-10 border rounded border-amber-500 text-amber-600 hover:bg-amber-50"
//                     >
//                       <ImagePlus className="w-4 h-4" />
//                     </button>
//                   ) : (
//                     <button
//                       type="button"
//                       onClick={() => window.open(`/cdn/download/${pinpadPhoto}`, '_blank')}
//                       onContextMenu={(e) => { e.preventDefault(); cameraInputRef.current?.click() }}
//                       onTouchStart={handleLongPressStart}
//                       onTouchEnd={handleLongPressEnd}
//                       onTouchMove={handleLongPressEnd}
//                       title="View pinpad receipt photo (long press to replace)"
//                       className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded bg-green-600 hover:bg-green-700 text-white"
//                     >
//                       <ImageIcon className="w-4 h-4" />
//                     </button>
//                   )}
//                 </div>
//                 {!pinpadPhoto && (
//                   <div className="mt-1 text-xs text-amber-600">
//                     Photo required — tap the icon to attach the pinpad receipt.
//                   </div>
//                 )}
//               </Field>
//             ) : (
//               <Field label="Infonet Exempted Tax">
//                 <input
//                   value={exemptedTax}
//                   onChange={(e) => setExemptedTax(e.target.value)}
//                   className="w-full border rounded px-3 py-2"
//                   inputMode="decimal"
//                 />
//               </Field>
//             )}

//             {showChequesField && (
//               <Field label="Cheques Cashed Out">
//                 <input
//                   value={chequesCashedOut}
//                   onChange={(e) => setChequesCashedOut(e.target.value)}
//                   className="w-full border rounded px-3 py-2 bg-amber-50/30 border-amber-200 focus:border-amber-500"
//                   inputMode="decimal"
//                   placeholder="0.00"
//                 />
//               </Field>
//             )}
//           </div>

//           <div className="flex items-center gap-4">
//             <button
//               type="submit"
//               disabled={submitting}
//               className="px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50"
//             >
//               {submitting ? (id ? 'Updating…' : 'Saving…') : id ? 'Update' : 'Save'}
//             </button>
//             {error && <span className="text-red-600 text-sm">Error: {error}</span>}
//             {success && <span className="text-green-600 text-sm">{success}</span>}
//           </div>

//           <input
//             ref={cameraInputRef}
//             type="file"
//             accept="image/*"
//             capture="environment"
//             className="hidden"
//             onChange={handleCameraUpload}
//           />
//         </form>
//       </div>
//     </div>
//   )
// }

// function Field({ label, children }: { label: string; children: React.ReactNode }) {
//   return (
//     <div>
//       <label className="block text-sm mb-1">{label}</label>
//       {children}
//     </div>
//   )
// }
