// import { createFileRoute, useNavigate } from '@tanstack/react-router'
// import { useEffect, useRef, useState } from 'react'
// import { SitePicker } from '@/components/custom/sitePicker'
// import { DatePicker } from '@/components/custom/datePicker'
// import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
// import { REGEXP_ONLY_DIGITS } from 'input-otp'
// import { ImagePlus, Image as ImageIcon, HelpCircle, X } from 'lucide-react'
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
//   chequesCashedOut?: number
//   debit?: number         
//   visa?: number          
//   mastercard?: number    
//   amex?: number          
//   chickenDelightTips?: number // 👈 Added Tips to interface
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

// // 💡 REUSABLE HELP DIALOG COMPONENT
// function FieldHelpDialog({ 
//   isOpen, 
//   onClose, 
//   title, 
//   description, 
//   imageSrc 
// }: { 
//   isOpen: boolean; 
//   onClose: () => void; 
//   title: string; 
//   description: React.ReactNode; // 🔥 Changed from string to React.ReactNode to allow JSX
//   imageSrc?: string 
// }) {
//   if (!isOpen) return null;

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
//       {/* Increased max-w-xl to comfortably fit the wide terminal image layouts */}
//       <div className="bg-background border rounded-lg max-w-xl w-full p-6 relative shadow-lg space-y-4 max-h-[90vh] overflow-y-auto">
//         <button 
//           onClick={onClose}
//           type="button"
//           className="absolute right-4 top-4 text-muted-foreground hover:text-foreground rounded p-1 outline-none focus-visible:ring-2 focus-visible:ring-primary"
//         >
//           <X className="w-4 h-4" />
//         </button>
//         <div>
//           <h3 className="text-lg font-bold pr-6">{title}</h3>
//           <div className="text-sm text-muted-foreground mt-2">{description}</div>
//         </div>
//         {imageSrc && (
//           <div className="border rounded-lg shadow-sm overflow-hidden bg-white w-full flex items-center justify-center">
//             <img 
//               src={imageSrc} 
//               alt={`${title} Reference`} 
//               className="w-full h-auto object-contain max-h-[45vh]" 
//             />
//           </div>
//         )}
//         <div className="flex justify-end pt-2">
//           <button
//             type="button"
//             onClick={onClose}
//             className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:opacity-90"
//           >
//             Got it
//           </button>
//         </div>
//       </div>
//     </div>
//   )
// }

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
//   const [chequesCashedOut, setChequesCashedOut] = useState('') 
  
//   const [debit, setDebit] = useState('')
//   const [visa, setVisa] = useState('')
//   const [mastercard, setMastercard] = useState('')
//   const [amex, setAmex] = useState('')
//   const [chickenDelightTips, setChickenDelightTips] = useState('') // 👈 State for Tips
  
//   const [pinpadPhoto, setPinpadPhoto] = useState<string | null>(null)
//   const [isChickenDelight, setIsChickenDelight] = useState(false)

//   // Dialog management configuration states
//   const [helpConfig, setHelpConfig] = useState<{ title: string; desc: string; img?: string } | null>(null)

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

//   const showChequesField = (site === 'Wavers East' || site === 'Wavers West') && !isChickenDelight

//   useEffect(() => {
//     if (!site) return
//     ;(async () => {
//       try {
//         const r = await fetch(`/api/locations?stationName=${encodeURIComponent(site)}`)
//         const loc = await r.json()
//         setShowCDCheckbox(!!loc?.chickenDelightSection)
//       } catch {
//         // silently ignore
//       }
//     })()
//   }, [site])

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
//     setChequesCashedOut(toStr(existing.chequesCashedOut)) 
    
//     const tendersArr = (existing as any).tenders || [];
//     const findTender = (k: string) => tendersArr.find((t: any) => t.key === k)?.value;

//     setDebit(toStr(findTender('debit')))
//     setVisa(toStr(findTender('visa')))
//     setMastercard(toStr(findTender('mastercard')))
//     setAmex(toStr(findTender('amex')))
//     setChickenDelightTips(toStr((existing as any).chickenDelightTips)) // 👈 Sync tips field
    
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
//               chequesCashedOut: existing.chequesCashedOut,
//               tenders: tendersArr, 
//               chickenDelightTips: (existing as any).chickenDelightTips
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
//         ? { 
//             tenders: [
//               { key: 'debit', value: num(debit) },
//               { key: 'visa', value: num(visa) },
//               { key: 'mastercard', value: num(mastercard) },
//               { key: 'amex', value: num(amex) }
//             ],
//             chickenDelightTips: num(chickenDelightTips), // 👈 Send tips payload data
//             pinpadPhoto: pinpadPhoto ?? undefined 
//           }
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
//     setChequesCashedOut('') 
//     setDebit('')
//     setVisa('')
//     setMastercard('')
//     setAmex('')
//     setChickenDelightTips('') // 👈 Clear out tips on new form initialization
//     setPinpadPhoto(null)
//     setIsChickenDelight(false)
//     setSuccess(null)
//     setError(null)
//   }

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

//       const { valid } = await res.json()
//       setError(valid ? '' : 'This shift number seems to be invalid, please check again.')
//     } catch (err: any) {
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

//             {/* 📝 REMOVED HELP CLICK FROM CANADIAN CASH COLLECTED */}
//             <Field label="Canadian Cash Collected">
//               <input
//                 value={canadianCashCollected}
//                 onChange={(e) => setCanadianCashCollected(e.target.value)}
//                 className="w-full border rounded px-3 py-2"
//                 inputMode="decimal"
//               />
//             </Field>

//             {showCDCheckbox && isChickenDelight ? (
//               <>
//                 <div className="sm:col-span-2 border rounded p-3 bg-muted/20 space-y-4">
//                   <div className="flex justify-between items-center">
//                     <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chicken Delight Transaction Metrics</span>
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
//                         onClick={() => window.open(`/cdn/download/${pinpadPhoto}`, '_blank')}
//                         onContextMenu={(e) => { e.preventDefault(); cameraInputRef.current?.click() }}
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
//                     {/* 💳 DEBIT FIELD WITH DYNAMIC INFO MODAL */}
//                     <Field 
//                       label="Debit"
//                       onHelpClick={() => setHelpConfig({
//                         title: 'Debit Reference',
//                         desc: '', // Uses global layout structure inside FieldHelpDialog below
//                         img: '/cd_images/debit.jpg'
//                       })}
//                     >
//                       <input
//                         value={debit}
//                         onChange={(e) => setDebit(e.target.value)}
//                         className="w-full border rounded px-3 py-1.5 text-sm"
//                         inputMode="decimal"
//                         placeholder="0.00"
//                       />
//                     </Field>

//                     {/* 💳 VISA FIELD WITH DYNAMIC INFO MODAL */}
//                     <Field 
//                       label="Visa"
//                       onHelpClick={() => setHelpConfig({
//                         title: 'Visa Reference',
//                         desc: '',
//                         img: '/cd_images/visa.jpg'
//                       })}
//                     >
//                       <input
//                         value={visa}
//                         onChange={(e) => setVisa(e.target.value)}
//                         className="w-full border rounded px-3 py-1.5 text-sm"
//                         inputMode="decimal"
//                         placeholder="0.00"
//                       />
//                     </Field>

//                     {/* 💳 MASTERCARD FIELD WITH DYNAMIC INFO MODAL */}
//                     <Field 
//                       label="Mastercard"
//                       onHelpClick={() => setHelpConfig({
//                         title: 'Mastercard Reference',
//                         desc: '',
//                         img: '/cd_images/mastercard.jpg'
//                       })}
//                     >
//                       <input
//                         value={mastercard}
//                         onChange={(e) => setMastercard(e.target.value)}
//                         className="w-full border rounded px-3 py-1.5 text-sm"
//                         inputMode="decimal"
//                         placeholder="0.00"
//                       />
//                     </Field>

//                     {/* 💳 AMEX FIELD WITH DYNAMIC INFO MODAL */}
//                     <Field 
//                       label="Amex"
//                       onHelpClick={() => setHelpConfig({
//                         title: 'Amex Reference',
//                         desc: '',
//                         img: '/cd_images/amex.jpg' // Falls back cleanly if amex image is not uniquely specified
//                       })}
//                     >
//                       <input
//                         value={amex}
//                         onChange={(e) => setAmex(e.target.value)}
//                         className="w-full border rounded px-3 py-1.5 text-sm"
//                         inputMode="decimal"
//                         placeholder="0.00"
//                       />
//                     </Field>

//                     {/* 💵 CHICKEN DELIGHT TIPS FIELD WITH DYNAMIC INFO MODAL */}
//                     <div className="col-span-2">
//                       <Field 
//                         label="Chicken Delight Tips"
//                         onHelpClick={() => setHelpConfig({
//                           title: 'Chicken Delight Tips Reference',
//                           desc: '',
//                           img: '/cd_images/tips.jpg'
//                         })}
//                       >
//                         <input
//                           value={chickenDelightTips}
//                           onChange={(e) => setChickenDelightTips(e.target.value)}
//                           className="w-full border rounded px-3 py-1.5 text-sm bg-primary/5 border-primary/20"
//                           inputMode="decimal"
//                           placeholder="0.00"
//                         />
//                       </Field>
//                     </div>
//                   </div>
//                   {!pinpadPhoto && (
//                     <div className="text-xs text-amber-600">
//                       * Photo attachment required to submit Chicken Delight shifts.
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

//       {/* 🎯 CLEAN DYNAMIC HELP MODAL OVERLAY */}
//       <FieldHelpDialog 
//         isOpen={helpConfig !== null}
//         onClose={() => setHelpConfig(null)}
//         title={helpConfig?.title || ''}
//         imageSrc={helpConfig?.img}
//         description={
//           <div className="space-y-3">
//             <ul className="list-none space-y-2 mt-1">
//               <li>
//                 <span className="text-red-600">●</span> <strong>Step 1:</strong> Locate the section marked by the <strong>Red Box</strong> on your terminal printout.
//               </li>
//               <li>
//                 <span className="text-green-600">●</span> <strong>Step 2:</strong> Enter the corresponding value found inside the <strong>Green Box</strong>.
//               </li>
//             </ul>
//             <p className="text-xs font-normal opacity-70 italic text-center bg-slate-50 p-2 rounded border mt-2">
//               Note: The images are for reference only and actual values may differ, but the highlighted sections will guide you to the correct values.
//             </p>
//           </div>
//         }
//       />
//     </div>
//   )
// }

// function Field({ 
//   label, 
//   children, 
//   onHelpClick 
// }: { 
//   label: string; 
//   children: React.ReactNode; 
//   onHelpClick?: () => void 
// }) {
//   return (
//     <div className="space-y-1 w-full">
//       <div className="flex items-center gap-1.5">
//         <label className="block text-sm font-medium text-foreground">{label}</label>
//         {onHelpClick && (
//           <button
//             type="button"
//             onClick={onHelpClick}
//             className="text-muted-foreground hover:text-primary transition-colors rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
//             title="Click to view field helper guide"
//           >
//             <HelpCircle className="w-3.5 h-3.5" />
//           </button>
//         )}
//       </div>
//       {children}
//     </div>
//   )
// }
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SitePicker } from '@/components/custom/sitePicker'
import { DatePicker } from '@/components/custom/datePicker'
import { ImagePlus, Image as ImageIcon, HelpCircle, X, CheckCircle2 } from 'lucide-react'
import { useSite } from '@/context/SiteContext'

type CashSummarySearch = {
  site: string
  date?: string
}

interface ShiftDoc {
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
  reviewed?: boolean
  isChickenDelight?: boolean
  tenders?: { key: string; value: number }[]
  chickenDelightTips?: number
  pinpadPhoto?: string
}

interface ShiftFormState {
  canadian_cash_collected: string
  exempted_tax: string
  chequesCashedOut: string
  debit: string
  visa: string
  mastercard: string
  amex: string
  chickenDelightTips: string
  pinpadPhoto: string | null
  isChickenDelight: boolean
}

// Get Yesterday local midnight ISO String (YYYY-MM-DD)
const getYesterdayDateString = (): string => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export const Route = createFileRoute('/_navbarLayout/cash-summary/form')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): CashSummarySearch => ({
    site: (search.site as string) || '',
    date: (search.date as string) || '',
  }),
})

function FieldHelpDialog({
  isOpen,
  onClose,
  title,
  description,
  imageSrc
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  description: React.ReactNode
  imageSrc?: string
}) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
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
            <img src={imageSrc} alt={`${title} Reference`} className="w-full h-auto object-contain max-h-[45vh]" />
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
  const { site, date: searchDate } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { selectedSite } = useSite()

  // Ensure default date falls back to yesterday if omitted
  const activeDateString = searchDate || getYesterdayDateString()

  // Derive Date object for DatePicker from active search param string
  const pickerDate = useMemo(() => {
    if (!activeDateString) return undefined
    const [yy, mm, dd] = activeDateString.split('-').map(Number)
    return new Date(yy, mm - 1, dd, 0, 0, 0, 0)
  }, [activeDateString])

  const updateSite = (newSite: string) =>
    navigate({ search: (prev:any) => ({ ...prev, site: newSite }), replace: true })

  const updateDate = (newDate: string) =>
    navigate({ search: (prev:any) => ({ ...prev, date: newDate }), replace: true })

  // Match standard Dispatch<SetStateAction<Date | undefined>> signature
  const handleDateChange: React.Dispatch<React.SetStateAction<Date | undefined>> = (value) => {
    const d = typeof value === 'function' ? value(pickerDate) : value
    if (!d) return
    const yy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd2 = String(d.getDate()).padStart(2, '0')
    updateDate(`${yy}-${mm}-${dd2}`)
  }

  // Auto-set site/date defaults in URL search params if missing
  useEffect(() => {
    if (!site || !searchDate) {
      navigate({
        search: (prev: any) => ({
          site: prev.site || selectedSite || '',
          date: prev.date || activeDateString,
        }),
        replace: true,
      })
    }
  }, [site, searchDate, selectedSite, activeDateString, navigate])

  const [shifts, setShifts] = useState<ShiftDoc[]>([])
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null)
  const [formsState, setFormsState] = useState<Record<string, ShiftFormState>>({})
  
  const [fetchingShifts, setFetchingShifts] = useState(false)
  const [showCDCheckbox, setShowCDCheckbox] = useState(false)
  
  // Lottery Routing States
  const [sellsLottery, setSellsLottery] = useState(false)
  const [hasSavedLottery, setHasSavedLottery] = useState(false)
  
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [helpConfig, setHelpConfig] = useState<{ title: string; desc: string; img?: string } | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const showChequesField = (site === 'Wavers East' || site === 'Wavers West')

  // Check Location Capabilities & Lottery Completion Status
  useEffect(() => {
    if (!site || !pickerDate) return
    ;(async () => {
      try {
        const locRes = await fetch(`/api/locations?stationName=${encodeURIComponent(site)}`)
        const loc = await locRes.json()
        const lottoSite = !!loc?.sellsLottery
        setShowCDCheckbox(!!loc?.chickenDelightSection)
        setSellsLottery(lottoSite)

        if (lottoSite) {
          const formattedDate = activeDateString
          const lottoRes = await fetch(
            `/api/cash-summary/lottery?site=${encodeURIComponent(site)}&date=${encodeURIComponent(formattedDate)}`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
              }
            }
          )
          if (lottoRes.ok) {
            const lottoData = await lottoRes.json()
            setHasSavedLottery(!!lottoData?.lottery)
          } else {
            setHasSavedLottery(false)
          }
        } else {
          setHasSavedLottery(false)
        }
      } catch (err) {
        console.warn('Failed checking site capabilities / lottery status', err)
      }
    })()
  }, [site, pickerDate, activeDateString])

  // Fetch pre-registered shifts for selected Date and Site
  useEffect(() => {
    if (!site || !pickerDate) return
    ;(async () => {
      setFetchingShifts(true)
      setError(null)
      try {
        const dateISO = pickerDate.toISOString()
        const res = await fetch(`/api/cash-summary/by-date?site=${encodeURIComponent(site)}&date=${encodeURIComponent(dateISO)}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
            "X-Required-Permission": "accounting.cashSummary.form"
          }
        })
        if (!res.ok) throw new Error('Failed to fetch shifts')
        const data: ShiftDoc[] = await res.json()
        setShifts(data)

        const initialFormDict: Record<string, ShiftFormState> = {}
        data.forEach(s => {
          const tenders = s.tenders || []
          const getTender = (k: string) => tenders.find(t => t.key === k)?.value

          initialFormDict[s._id] = {
            canadian_cash_collected: s.canadian_cash_collected != null ? String(s.canadian_cash_collected) : '',
            exempted_tax: s.exempted_tax != null ? String(s.exempted_tax) : '',
            chequesCashedOut: s.chequesCashedOut != null ? String(s.chequesCashedOut) : '',
            debit: getTender('debit') != null ? String(getTender('debit')) : '',
            visa: getTender('visa') != null ? String(getTender('visa')) : '',
            mastercard: getTender('mastercard') != null ? String(getTender('mastercard')) : '',
            amex: getTender('amex') != null ? String(getTender('amex')) : '',
            chickenDelightTips: s.chickenDelightTips != null ? String(s.chickenDelightTips) : '',
            pinpadPhoto: s.pinpadPhoto || null,
            isChickenDelight: !!s.isChickenDelight
          }
        })

        setFormsState(initialFormDict)
        if (data.length > 0) {
          setActiveShiftId(data[0]._id)
        } else {
          setActiveShiftId(null)
        }
      } catch (err: any) {
        setError(err.message || 'Error fetching shifts for date')
      } finally {
        setFetchingShifts(false)
      }
    })()
  }, [site, pickerDate])

  const activeShift = shifts.find(s => s._id === activeShiftId)
  const activeForm = activeShiftId ? formsState[activeShiftId] : null

  const updateActiveFormField = (field: keyof ShiftFormState, value: any) => {
    if (!activeShiftId) return
    setFormsState(prev => ({
      ...prev,
      [activeShiftId]: {
        ...prev[activeShiftId],
        [field]: value
      }
    }))
  }

  const handleCameraUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeShiftId) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/cdn/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      updateActiveFormField('pinpadPhoto', data.filename)
    } catch {
      alert('Failed to upload image')
    }
    e.target.value = ''
  }

  const num = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(/,/g, '')))

  const handleSubmitAll = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    for (const s of shifts) {
      const f = formsState[s._id]
      if (!f) continue
      if (f.canadian_cash_collected.trim() === '') {
        setError(`Shift #${s.shift_number}: Cash collected is required (enter 0 if none).`)
        setSubmitting(false)
        return
      }
      if (showCDCheckbox && f.isChickenDelight && !f.pinpadPhoto) {
        setError(`Shift #${s.shift_number}: Pinpad receipt photo required for Chicken Delight.`)
        setSubmitting(false)
        return
      }
    }

    const payloadItems = shifts.map(s => {
      const f = formsState[s._id]
      const isCD = showCDCheckbox && f.isChickenDelight

      return {
        _id: s._id,
        shift_number: s.shift_number,
        canadian_cash_collected: num(f.canadian_cash_collected),
        chequesCashedOut: showChequesField && !isCD ? num(f.chequesCashedOut) : undefined,
        isChickenDelight: isCD,
        ...(isCD
          ? {
              tenders: [
                { key: 'debit', value: num(f.debit) },
                { key: 'visa', value: num(f.visa) },
                { key: 'mastercard', value: num(f.mastercard) },
                { key: 'amex', value: num(f.amex) }
              ],
              chickenDelightTips: num(f.chickenDelightTips),
              pinpadPhoto: f.pinpadPhoto ?? undefined
            }
          : { exempted_tax: num(f.exempted_tax) })
      }
    })

    try {
      const res = await fetch('/api/cash-summary/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          "X-Required-Permission": "accounting.cashSummary.form"
        },
        body: JSON.stringify({ items: payloadItems }),
      })

      if (!res.ok) throw new Error(await res.text())
      setSuccess('All shifts updated and marked as reviewed successfully!')

      const searchParams = { site, date: activeDateString }

      if (sellsLottery && !hasSavedLottery) {
        navigate({
          to: '/cash-summary/lottery',
          search: searchParams
        })
      } else {
        navigate({
          to: '/cash-summary/report',
          search: searchParams
        })
      }
    } catch (err: any) {
      setError(err.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const isLotteryPending = sellsLottery && !hasSavedLottery
  const buttonLabel = submitting
    ? 'Submitting...'
    : isLotteryPending
    ? 'Save Shifts & Continue to Lottery'
    : 'Save All Shifts Data'

  return (
    <div className="pt-16 flex flex-col items-center w-full">
      <div className="w-full max-w-2xl space-y-6 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div className="space-y-1 w-full">
            <label className="block text-sm font-medium">Site *</label>
            <SitePicker
              value={site}
              onValueChange={updateSite}
              placeholder="Pick a site"
              label="Site"
              className="w-full"
            />
          </div>

          <div className="space-y-1 w-full">
            <label className="block text-sm font-medium">Select Date *</label>
            <DatePicker
              date={pickerDate}
              setDate={handleDateChange}
              restrictToPast
            />
          </div>
        </div>

        {fetchingShifts ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading shifts...</div>
        ) : shifts.length === 0 ? (
          <div className="border rounded-md p-6 text-center text-muted-foreground text-sm bg-muted/10">
            No pre-registered shifts found for this site on selected date.
          </div>
        ) : (
          <form onSubmit={handleSubmitAll} className="space-y-6 border rounded-md p-5 bg-card">
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Select Shift to Fill
              </label>
              <div className="flex flex-wrap gap-2">
                {shifts.map(s => {
                  const isSelected = s._id === activeShiftId
                  const f = formsState[s._id]
                  const isFilled = f && f.canadian_cash_collected.trim() !== ''

                  let buttonStyles = 'bg-muted hover:bg-muted/80 text-foreground'
                  if (isFilled) {
                    buttonStyles = 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  } else if (isSelected) {
                    buttonStyles = 'bg-primary text-primary-foreground shadow'
                  }

                  const activeRingStyle = isSelected ? 'ring-2 ring-offset-2 ring-foreground' : ''

                  return (
                    <button
                      key={s._id}
                      type="button"
                      onClick={() => setActiveShiftId(s._id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${buttonStyles} ${activeRingStyle}`}
                    >
                      <span>Shift #{s.shift_number}</span>
                      {isFilled && <CheckCircle2 className="w-3.5 h-3.5 text-white fill-emerald-800/30" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {activeShift && activeForm && (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold">
                    Editing Details: Shift #{activeShift.shift_number}
                  </h3>

                  {showCDCheckbox && (
                    <div
                      title={activeForm.isChickenDelight ? 'Chicken Delight Shift Active' : 'Not a Chicken Delight Shift'}
                      className={`block rounded overflow-hidden transition-all duration-200 pointer-events-none cursor-default ${
                        activeForm.isChickenDelight ? '' : 'grayscale opacity-40'
                      }`}
                    >
                      <img src="/assets/images/Chicken_Delight_Current_Logo.jpg" alt="Chicken Delight" className="h-7 w-auto" />
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Canadian Cash Collected *">
                    <input
                      value={activeForm.canadian_cash_collected}
                      onChange={(e) => updateActiveFormField('canadian_cash_collected', e.target.value)}
                      className="w-full border rounded px-3 py-2"
                      inputMode="decimal"
                      placeholder="0.00"
                    />
                  </Field>

                  {showCDCheckbox && activeForm.isChickenDelight ? (
                    <div className="sm:col-span-2 border rounded p-3 bg-muted/20 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Chicken Delight Metrics
                        </span>
                        {!activeForm.pinpadPhoto ? (
                          <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 border rounded border-amber-500 text-amber-600 bg-amber-50/50 hover:bg-amber-50"
                          >
                            <ImagePlus className="w-3.5 h-3.5" /> Upload Receipt *
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => window.open(`/cdn/download/${activeForm.pinpadPhoto}`, '_blank')}
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white"
                          >
                            <ImageIcon className="w-3.5 h-3.5" /> View Receipt
                          </button>
                        )}
                      </div>

                      <div className="grid gap-3 grid-cols-2">
                        <Field
                          label="Debit"
                          onHelpClick={() => setHelpConfig({ title: 'Debit Ref', desc: '', img: '/cd_images/debit.jpg' })}
                        >
                          <input
                            value={activeForm.debit}
                            onChange={(e) => updateActiveFormField('debit', e.target.value)}
                            className="w-full border rounded px-3 py-1.5 text-sm"
                            inputMode="decimal"
                            placeholder="0.00"
                          />
                        </Field>

                        <Field
                          label="Visa"
                          onHelpClick={() => setHelpConfig({ title: 'Visa Ref', desc: '', img: '/cd_images/visa.jpg' })}
                        >
                          <input
                            value={activeForm.visa}
                            onChange={(e) => updateActiveFormField('visa', e.target.value)}
                            className="w-full border rounded px-3 py-1.5 text-sm"
                            inputMode="decimal"
                            placeholder="0.00"
                          />
                        </Field>

                        <Field
                          label="Mastercard"
                          onHelpClick={() => setHelpConfig({ title: 'Mastercard Ref', desc: '', img: '/cd_images/mastercard.jpg' })}
                        >
                          <input
                            value={activeForm.mastercard}
                            onChange={(e) => updateActiveFormField('mastercard', e.target.value)}
                            className="w-full border rounded px-3 py-1.5 text-sm"
                            inputMode="decimal"
                            placeholder="0.00"
                          />
                        </Field>

                        <Field
                          label="Amex"
                          onHelpClick={() => setHelpConfig({ title: 'Amex Ref', desc: '', img: '/cd_images/amex.jpg' })}
                        >
                          <input
                            value={activeForm.amex}
                            onChange={(e) => updateActiveFormField('amex', e.target.value)}
                            className="w-full border rounded px-3 py-1.5 text-sm"
                            inputMode="decimal"
                            placeholder="0.00"
                          />
                        </Field>

                        <div className="col-span-2">
                          <Field
                            label="Chicken Delight Tips"
                            onHelpClick={() => setHelpConfig({ title: 'Tips Ref', desc: '', img: '/cd_images/tips.jpg' })}
                          >
                            <input
                              value={activeForm.chickenDelightTips}
                              onChange={(e) => updateActiveFormField('chickenDelightTips', e.target.value)}
                              className="w-full border rounded px-3 py-1.5 text-sm bg-primary/5 border-primary/20"
                              inputMode="decimal"
                              placeholder="0.00"
                            />
                          </Field>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Field label="Infonet Exempted Tax">
                      <input
                        value={activeForm.exempted_tax}
                        onChange={(e) => updateActiveFormField('exempted_tax', e.target.value)}
                        className="w-full border rounded px-3 py-2"
                        inputMode="decimal"
                        placeholder="0.00"
                      />
                    </Field>
                  )}

                  {showChequesField && !activeForm.isChickenDelight && (
                    <Field label="Cheques Cashed Out">
                      <input
                        value={activeForm.chequesCashedOut}
                        onChange={(e) => updateActiveFormField('chequesCashedOut', e.target.value)}
                        className="w-full border rounded px-3 py-2 bg-amber-50/30 border-amber-200"
                        inputMode="decimal"
                        placeholder="0.00"
                      />
                    </Field>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2 border-t">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded bg-primary text-primary-foreground font-semibold disabled:opacity-50 hover:opacity-95 transition-opacity"
              >
                {buttonLabel}
              </button>
              {error && <div className="text-red-600 text-sm font-medium">{error}</div>}
              {success && <div className="text-green-600 text-sm font-medium">{success}</div>}
            </div>
          </form>
        )}
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraUpload}
      />

      <FieldHelpDialog
        isOpen={helpConfig !== null}
        onClose={() => setHelpConfig(null)}
        title={helpConfig?.title || ''}
        imageSrc={helpConfig?.img}
        description={
          <div className="space-y-3">
            <ul className="list-none space-y-2 mt-1">
              <li><span className="text-red-600">●</span> <strong>Step 1:</strong> Locate the section marked by the <strong>Red Box</strong> on your terminal printout.</li>
              <li><span className="text-green-600">●</span> <strong>Step 2:</strong> Enter the corresponding value found inside the <strong>Green Box</strong>.</li>
            </ul>
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
  label: string
  children: React.ReactNode
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
            className="text-muted-foreground hover:text-primary transition-colors rounded-full focus:outline-none"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {children}
    </div>
  )
}