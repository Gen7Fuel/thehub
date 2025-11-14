// import { createFileRoute, useNavigate } from '@tanstack/react-router'
// import { useEffect, useMemo, useRef, useState } from 'react'
// import { SitePicker } from '@/components/custom/sitePicker'
// import { Button } from '@/components/ui/button'

// type Entry = {
//   _id: string
//   date: string
//   description?: string
//   cashIn: number
//   cashExpenseOut: number
//   cashDepositBank: number
//   cashOnHandSafe?: number
//   createdAt?: string
//   updatedAt?: string
//   photo?: string | null 
// }

// type SafeSheet = {
//   _id: string
//   site: string
//   initialBalance: number
//   entries: Entry[]
//   createdAt?: string
//   updatedAt?: string
// }

// export const Route = createFileRoute('/_navbarLayout/safesheet')({
//   component: RouteComponent,
//   validateSearch: (search) =>
//     search as {
//       site: string
//     },
//   loaderDeps: ({ search: { site } }) => ({ site })
// })

// export default function RouteComponent() {
//   const { site } = Route.useSearch() as { site?: string }
//   const navigate = useNavigate({ from: Route.fullPath })

//   const updateSearch = (site: string) => {
//     navigate({ search: { site } })
//   }

//   const [sheet, setSheet] = useState<SafeSheet | null>(null)
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState<string | null>(null)

//   const descRef = useRef<HTMLInputElement>(null);
//   const cashInRef = useRef<HTMLInputElement>(null);
//   const cashExpenseRef = useRef<HTMLInputElement>(null);
//   const cashDepositRef = useRef<HTMLInputElement>(null);
//   const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
//   const cameraInputRef = useRef<HTMLInputElement>(null);
//   const [photoTargetEntry, setPhotoTargetEntry] = useState<string | null>(null);

//   const openCameraForEntry = (entryId: string) => {
//     setPhotoTargetEntry(entryId);
//     cameraInputRef.current?.click();
//   };



//   // Format numbers
//   const fmtNumber = (v?: number | null) => {
//     if (v === null || v === undefined || v === 0) return ''
//     return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
//   }

//   // Fetch sheet
//   useEffect(() => {
//     if (!site) {
//       setSheet(null)
//       setError(null)
//       return
//     }
//     let mounted = true
//     const fetchSheet = async () => {
//       setLoading(true)
//       setError(null)
//       try {
//         const res = await fetch(`/api/safesheets/site/${encodeURIComponent(site)}`, {
//           headers: {
//             Authorization: `Bearer ${localStorage.getItem('token')}`,
//             "X-Required-Permission": "safesheet",
//           },
//         })
//         if (res.status === 403) {
//           navigate({ to: '/no-access' })
//           return
//         }
//         if (!res.ok) {
//           const body = await res.json().catch(() => ({}))
//           throw new Error(body?.error || 'Failed to fetch safesheet')
//         }
//         const data: SafeSheet = await res.json()
//         if (mounted) setSheet(data)
//       } catch (err: any) {
//         console.error(err)
//         if (mounted) setError(err.message || 'Unknown error')
//       } finally {
//         if (mounted) setLoading(false)
//       }
//     }
//     fetchSheet()
//     return () => { mounted = false }
//   }, [site])

//   // Read numeric value from editable TD
//   const readEditableNumber = (el?: HTMLInputElement | null) => {
//     if (!el) return 0
//     const txt = el.value.replace(/,/g, '').trim()
//     const n = Number(txt)
//     return isNaN(n) ? 0 : n
//   }

//   // Recompute running balance
//   const recomputeCashOnHand = (entries: Entry[], initialBalance: number) => {
//     let balance = initialBalance
//     return entries.map((entry) => {
//       balance = balance + entry.cashIn - entry.cashExpenseOut - entry.cashDepositBank
//       return { ...entry, cashOnHandSafe: balance }
//     })
//   }

//   // Add entry
//   const handleAddEntry = async () => {
//     if (!site || !sheet) return

//     const entryBody = {
//       date: new Date().toISOString(),
//       description: descRef.current?.innerText.trim() || '',
//       cashIn: readEditableNumber(cashInRef.current),
//       cashExpenseOut: readEditableNumber(cashExpenseRef.current),
//       cashDepositBank: readEditableNumber(cashDepositRef.current),
//     }

//     if (!entryBody.cashIn && !entryBody.cashExpenseOut && !entryBody.cashDepositBank) {
//       setError('Please enter an amount in one of the fields')
//       return
//     }

//     try {
//       const res = await fetch(`/api/safesheets/site/${encodeURIComponent(site)}/entries`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${localStorage.getItem('token')}`,
//           "X-Required-Permission": "safesheet",
//         },
//         body: JSON.stringify(entryBody)
//       })

//       if (res.status === 403) {
//         navigate({ to: '/no-access' })
//         return
//       }

//       const body = await res.json().catch(() => null)
//       if (!res.ok) throw new Error(body?.error || 'Failed to add entry')

//       if (body?.entries) {
//         const updated = recomputeCashOnHand(body.entries, sheet.initialBalance)
//         setSheet(prev => prev ? { ...prev, entries: updated } : prev)
//       }

//       // Clear inline row
//       if (descRef.current) descRef.current.value = ''
//       if (cashInRef.current) cashInRef.current.value = ''
//       if (cashExpenseRef.current) cashExpenseRef.current.value = ''
//       if (cashDepositRef.current) cashDepositRef.current.value = ''
//       setError(null)
//     } catch (err: any) {
//       console.error(err)
//       setError(err.message || 'Add entry failed')
//     }
//   }

//   // Update a single entry and recompute balances
//   const updateEntry = async (entryId: string, field: string, value: any) => {
//     if (!site || !sheet) return
//     try {
//       const res = await fetch(`/api/safesheets/site/${encodeURIComponent(site)}/entries/${entryId}`, {
//         method: 'PUT',
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${localStorage.getItem('token')}`,
//           "X-Required-Permission": "safesheet",
//         },
//         body: JSON.stringify({ [field]: value }),
//       })
//       if (res.status === 403) {
//         navigate({ to: '/no-access' })
//         return
//       }
//       const body = await res.json().catch(() => null)
//       if (!res.ok) throw new Error(body?.error || 'Failed to update entry')

//       if (body?.entries) {
//         const updated = recomputeCashOnHand(body.entries, sheet.initialBalance)
//         setSheet(prev => prev ? { ...prev, entries: updated } : prev)
//       }
//     } catch (err: any) {
//       console.error(err)
//       setError(err.message || 'Update failed')
//     }
//   }

//   const handleKeyDown = (ev: React.KeyboardEvent<HTMLElement>) => {
//     if (ev.key === 'Enter') {
//       ev.preventDefault();

//       // If inside an input, commit the value first
//       if (ev.currentTarget instanceof HTMLInputElement) {
//         ev.currentTarget.blur(); // trigger onBlur
//       }

//       // Move focus to the next editable cell
//       let nextCell: HTMLElement | null = null;

//       if (ev.currentTarget instanceof HTMLInputElement) {
//         nextCell = ev.currentTarget.closest('td')?.nextElementSibling as HTMLElement | null;
//       } else {
//         nextCell = ev.currentTarget.nextElementSibling as HTMLElement | null;
//       }

//       if (!nextCell) {
//         // move to first editable cell in next row
//         const nextRow = ev.currentTarget.closest('tr')?.nextElementSibling;
//         if (nextRow) nextCell = nextRow.querySelector('td span, td input') as HTMLElement;
//       }

//       nextCell?.focus();
//     }
//   };


//   // Memoized entries for display
//   const formattedEntries = useMemo(() => {
//     if (!sheet) return []
//     return sheet.entries.map(e => ({
//       ...e,
//       // dateDisplay: new Date(e.date).toLocaleDateString(),
//       dateDisplay: new Date(e.date).toLocaleDateString(),
//       cashInDisplay: fmtNumber(e.cashIn),
//       cashExpenseOutDisplay: fmtNumber(e.cashExpenseOut),
//       cashDepositBankDisplay: fmtNumber(e.cashDepositBank),
//       cashOnHandSafeDisplay: fmtNumber(e.cashOnHandSafe ?? null)
//     }))
//   }, [sheet])

//   // Add these states and helpers at the top of your component
//   const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
//   const [editValue, setEditValue] = useState("");

//   const isEditing = (id: string, field: string) =>
//     editingCell?.id === id && editingCell.field === field;

//   const startEdit = (entryId: string, field: string, initialValue: string) => {
//     setEditingCell({ id: entryId, field });
//     setEditValue(initialValue ?? '');
//   };

//   const finishEdit = async (
//     entryId: string,
//     field: 'description' | 'cashIn' | 'cashExpenseOut' | 'cashDepositBank'
//   ) => {
//     let value: string | number = editValue.trim();

//     // Convert to number if numeric field
//     if (field !== 'description') {
//       value = value === '' ? 0 : Number(value.replace(/,/g, ''));
//     }

//     // Update state & backend
//     setSheet(prev => {
//       if (!prev) return prev;
//       const updatedEntries = prev.entries.map(entry =>
//         entry._id === entryId ? { ...entry, [field]: value } : entry
//       );
//       const recomputed = recomputeCashOnHand(updatedEntries, prev.initialBalance);
//       return { ...prev, entries: recomputed };
//     });

//     await updateEntry(entryId, field, value);
//     setEditingCell(null);
//   };

//   const handleCameraUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
//     if (!photoTargetEntry) return;

//     const file = e.target.files?.[0];
//     if (!file) return;

//     // Upload to CDN
//     const formData = new FormData();
//     formData.append("file", file);

//     try {
//       const res = await fetch("/cdn/upload", {
//         method: "POST",
//         body: formData,
//       });

//       if (!res.ok) throw new Error("Image upload failed");

//       const data = await res.json(); // => { filename }
//       const filename = data.filename;

//       // Update entry with photo filename
//       await updateEntry(photoTargetEntry, "photo", filename);

//       // Update local state to show button "View Image"
//       setSheet(prev => {
//         if (!prev) return prev;
//         return {
//           ...prev,
//           entries: prev.entries.map(ent =>
//             ent._id === photoTargetEntry ? { ...ent, photo: filename } : ent
//           )
//         };
//       });
//     } catch (err) {
//       console.error(err);
//       alert("Failed to upload image");
//     }

//     // Cleanup
//     e.target.value = ""; // allow re-upload
//     setPhotoTargetEntry(null);
//   };




//   return (
//     <div className="pt-14 flex flex-col items-center">
//       <div className="my-4 flex flex-col items-center gap-4">
//         <SitePicker
//           value={site}
//           onValueChange={updateSearch}
//           placeholder="Pick a site"
//           label="Site"
//           className="w-[220px]"
//         />
//       </div>

//       {!site && (
//         <p className="text-sm text-muted-foreground text-center">
//           Please select a site to view the safesheet.
//         </p>
//       )}

//       {site && (
//         <div className="w-full max-w-5xl px-2 sm:px-4">
//           {loading && <p className="text-center">Loading...</p>}
//           {error && <p className="text-red-600 text-center">{error}</p>}

//           {!loading && !error && sheet && (
//             <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-sm bg-white">
//               <table className="min-w-full text-sm border-collapse table-fixed">
//                 <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10">
//                   <tr>
//                     <th className="px-2 py-1 text-left font-medium border-b border-slate-300 w-24 whitespace-nowrap">Date</th>
//                     <th className="px-2 py-1 text-left font-medium border-b border-slate-300 w-50 whitespace-nowrap">Description</th>
//                     <th className="px-2 py-1 text-right font-medium border-b border-slate-300 w-42 whitespace-nowrap">Cash In</th>
//                     <th className="px-2 py-1 text-right font-medium border-b border-slate-300 w-42 whitespace-nowrap">Cash Expense Out</th>
//                     <th className="px-2 py-1 text-right font-medium border-b border-slate-300 w-42 whitespace-nowrap">Cash Deposit Bank</th>
//                     <th className="px-2 py-1 text-right font-medium border-b border-slate-300 w-42 whitespace-nowrap">Cash On Hand</th>
//                     <th className="px-2 py-1 text-center font-medium border-b border-slate-300 w-32">
//                       Actions
//                     </th>
//                   </tr>

//                 </thead>

//                 <tbody>
//                   {formattedEntries.map((e) => {
//                     const isToday = (() => {
//                       const entry = new Date(e.date)
//                       const now = new Date()
//                       return entry.getUTCFullYear() === now.getUTCFullYear() &&
//                         entry.getUTCMonth() === now.getUTCMonth() &&
//                         entry.getUTCDate() === now.getUTCDate()
//                     })();

//                     return (
//                       <tr key={e._id} className="odd:bg-white even:bg-slate-50 hover:bg-blue-50 transition-colors">
//                         {/* Date */}
//                         <td className="px-3 py-1.5 border-b border-slate-200 whitespace-nowrap text-gray-700">
//                           {e.dateDisplay}
//                         </td>

//                         {/* Description */}
//                         <td className="px-3 py-1.5 border-b border-slate-200 text-gray-700">
//                           {isEditing(e._id, 'description') ? (
//                             <input
//                               autoFocus
//                               type="text"
//                               value={editValue}
//                               onChange={(ev) => setEditValue(ev.target.value)}
//                               onBlur={() => finishEdit(e._id, 'description')}
//                               onKeyDown={handleKeyDown}
//                               className="w-full bg-transparent border-none outline-none p-0 m-0"
//                             />
//                           ) : (
//                             <span
//                               className="block w-full cursor-text min-h-[1rem]" // ensures empty span still has height
//                               onDoubleClick={() => isToday && startEdit(e._id, 'description', e.description || '')} // empty string fallback
//                             >
//                               {e.description || '\u00A0'} {/* non-breaking space to render empty span */}
//                             </span>
//                           )}
//                         </td>
//                         {/* Cash In */}
//                         <td className="px-3 py-1.5 border-b border-slate-200 text-right text-gray-700">
//                           {isEditing(e._id, 'cashIn') ? (
//                             <input
//                               autoFocus
//                               type="number"
//                               inputMode="numeric"
//                               value={editValue}
//                               onChange={(ev) => setEditValue(ev.target.value)}
//                               onBlur={() => finishEdit(e._id, 'cashIn')}
//                               onKeyDown={handleKeyDown}
//                               className="w-full text-right bg-transparent border-none outline-none p-0 m-0"
//                             />
//                           ) : (
//                             <span
//                               className="block w-full cursor-text"
//                               onDoubleClick={() =>
//                                 isToday && startEdit(
//                                   e._id,
//                                   'cashIn',
//                                   e.cashIn != null ? e.cashIn.toString() : '' // show empty string if cell has no value
//                                 )
//                               }
//                             >
//                               {e.cashInDisplay || '\u00A0'}
//                             </span>
//                           )}
//                         </td>

//                         {/* Cash Expense Out */}
//                         <td className="px-3 py-1.5 border-b border-slate-200 text-right text-gray-700">
//                           {isEditing(e._id, 'cashExpenseOut') ? (
//                             <input
//                               autoFocus
//                               type="number"
//                               inputMode="numeric"
//                               value={editValue}
//                               onChange={(ev) => setEditValue(ev.target.value)}
//                               onBlur={() => finishEdit(e._id, 'cashExpenseOut')}
//                               onKeyDown={handleKeyDown}
//                               className="w-full text-right bg-transparent border-none outline-none p-0 m-0"
//                             />
//                           ) : (
//                             <span
//                               className="block w-full cursor-text"
//                               onDoubleClick={() =>
//                                 isToday && startEdit(e._id, 'cashExpenseOut', e.cashExpenseOut != null ? e.cashExpenseOut.toString() : '')
//                               }
//                             >
//                               {e.cashExpenseOutDisplay || '\u00A0'}
//                             </span>
//                           )}
//                         </td>

//                         {/* Cash Deposit Bank */}
//                         <td className="px-3 py-1.5 border-b border-slate-200 text-right text-gray-700">
//                           {isEditing(e._id, 'cashDepositBank') ? (
//                             <input
//                               autoFocus
//                               type="number"
//                               inputMode="numeric"
//                               value={editValue}
//                               onChange={(ev) => setEditValue(ev.target.value)}
//                               onBlur={() => finishEdit(e._id, 'cashDepositBank')}
//                               onKeyDown={handleKeyDown}
//                               className="w-full text-right bg-transparent border-none outline-none p-0 m-0"
//                             />
//                           ) : (
//                             <span
//                               className="block w-full cursor-text"
//                               onDoubleClick={() =>
//                                 isToday && startEdit(e._id, 'cashDepositBank', e.cashDepositBank != null ? e.cashDepositBank.toString() : '')
//                               }
//                             >
//                               {e.cashDepositBankDisplay || '\u00A0'}
//                             </span>
//                           )}
//                         </td>

//                         {/* Cash On Hand (readonly) */}
//                         <td className="px-3 py-1.5 border-b border-slate-200 text-right font-medium text-gray-800">
//                           {e.cashOnHandSafeDisplay}
//                         </td>
//                         <td className="px-3 py-1.5 border-b border-slate-200 text-center">
//                           {e.cashDepositBank > 0 && (
//                             !e.photo ? (
//                               // SHOW CAMERA BUTTON
//                               <Button
//                                 size="sm"
//                                 onClick={() => openCameraForEntry(e._id)}
//                                 className="text-xs px-2 py-1"
//                               >
//                                 📷 Upload
//                               </Button>
//                             ) : (
//                               // SHOW "VIEW IMAGE" BUTTON
//                               <Button
//                                 size="sm"
//                                 variant="secondary"
//                                 onClick={() => window.open(`/cdn/download/${e.photo}`, "_blank")}
//                                 className="text-xs px-2 py-1"
//                               >
//                                 View Image
//                               </Button>
//                             )
//                           )}
//                         </td>


//                       </tr>
//                     );
//                   })}
//                   <tr className="bg-slate-50">
//                     {/* Date */}
//                     <td className="px-3 py-2 text-gray-400 border-t border-slate-300 text-sm whitespace-nowrap">
//                       {new Date().toLocaleDateString()}
//                     </td>

//                     {/* Description input */}
//                     <td className="px-3 py-2 border-t border-slate-300 text-sm bg-white">
//                       <input
//                         ref={descRef}
//                         type="text"
//                         placeholder="Description"
//                         className="w-full px-3 py-2 border-t border-slate-300 text-sm text-slate-800 bg-white min-w-[120px] focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm"
//                         onKeyDown={handleKeyDown}
//                       />
//                     </td>

//                     {/* Cash In input */}
//                     <td className="px-3 py-2 border-t border-slate-300 text-right text-sm bg-white">
//                       <input
//                         ref={cashInRef}
//                         type="number"
//                         inputMode="numeric"
//                         placeholder="0.00"
//                         className="w-full x-3 py-2 border-t border-slate-300 text-right text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm"
//                         onKeyDown={handleKeyDown}
//                       />
//                     </td>

//                     {/* Cash Expense Out input */}
//                     <td className="px-3 py-2 border-t border-slate-300 text-right text-sm bg-white">
//                       <input
//                         ref={cashExpenseRef}
//                         type="number"
//                         inputMode="numeric"
//                         placeholder="0.00"
//                         className="w-full x-3 py-2 border-t border-slate-300 text-right text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm"
//                         onKeyDown={handleKeyDown}
//                       />
//                     </td>

//                     {/* Cash Deposit Bank input */}
//                     <td className="px-3 py-2 border-t border-slate-300 text-right text-sm bg-white">
//                       <input
//                         ref={cashDepositRef}
//                         type="number"
//                         inputMode="numeric"
//                         placeholder="0.00"
//                         className="w-full x-3 py-2 border-t border-slate-300 text-right text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm"
//                         onKeyDown={handleKeyDown}
//                       />
//                     </td>

//                     {/* Add button */}
//                     <td className="px-3 py-2 border-t border-slate-300 text-right">
//                       <Button size="sm" onClick={handleAddEntry} className="text-sm h-8 px-3">
//                         Add
//                       </Button>
//                     </td>
//                   </tr>

//                 </tbody>
//               </table>
//             </div>
//           )}

//           {!loading && !error && sheet && sheet.entries.length === 0 && (
//             <p className="text-sm text-muted-foreground mt-4 text-center">
//               No entries found for this site.
//             </p>
//           )}
//         </div>
//       )}

//       {uploadDialogOpen && activeEntry && (
//         <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
//           <div className="bg-white p-6 rounded-lg shadow-lg w-80">
//             <h2 className="text-lg font-semibold mb-3">Upload Deposit Slip</h2>

//             <input
//               type="file"
//               accept="image/*"
//               onChange={handleUploadDepositSlip}
//               className="mb-4"
//             />

//             <div className="flex justify-end gap-2">
//               <Button
//                 variant="outline"
//                 onClick={() => setUploadDialogOpen(false)}
//               >
//                 Cancel
//               </Button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
// return (
//   <div className="pt-14 flex flex-col items-center">
//     <div className="my-4 flex flex-col items-center gap-4">
//       <SitePicker
//         value={site}
//         onValueChange={updateSearch}
//         placeholder="Pick a site"
//         label="Site"
//         className="w-[220px]"
//       />
//     </div>

//     {!site && (
//       <p className="text-sm text-muted-foreground text-center">
//         Please select a site to view the safesheet.
//       </p>
//     )}

//     {site && (
//       <div className="w-full max-w-5xl px-2 sm:px-4">
//         {loading && <p className="text-center">Loading...</p>}
//         {error && <p className="text-red-600 text-center">{error}</p>}

//         {!loading && !error && sheet && (
//           <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-sm bg-white">
//             <table className="min-w-full text-sm border-collapse table-fixed">
//               <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10">
//                 <tr>
//                   <th className="px-2 py-1 text-left font-medium border-b border-slate-300 w-24">Date</th>
//                   <th className="px-2 py-1 text-left font-medium border-b border-slate-300 w-64">Description</th>
//                   <th className="px-2 py-1 text-right font-medium border-b border-slate-300 w-32">Cash In</th>
//                   <th className="px-2 py-1 text-right font-medium border-b border-slate-300 w-32">Cash Expense Out</th>
//                   <th className="px-2 py-1 text-right font-medium border-b border-slate-300 w-32">Cash Deposit Bank</th>
//                   <th className="px-2 py-1 text-right font-medium border-b border-slate-300 w-32">Cash On Hand</th>
//                 </tr>
//               </thead>

//               <tbody>
//                 {formattedEntries.map((e) => {
//                   const isToday = (() => {
//                     const entry = new Date(e.date)
//                     const now = new Date()
//                     return entry.getUTCFullYear() === now.getUTCFullYear() &&
//                       entry.getUTCMonth() === now.getUTCMonth() &&
//                       entry.getUTCDate() === now.getUTCDate()
//                   })()

//                   const handleCellBlur = (field: 'description' | 'cashIn' | 'cashExpenseOut' | 'cashDepositBank') =>
//                     async (ev: React.FocusEvent<HTMLTableCellElement>) => {
//                       ev.currentTarget.contentEditable = 'false'
//                       if (!isToday) return

//                       let value: string | number = ev.currentTarget.innerText.trim()
//                       if (field !== 'description') value = Number(value.replace(/,/g, '')) || 0

//                       // Update local state immediately
//                       setSheet(prev => {
//                         if (!prev) return prev
//                         const updatedEntries = prev.entries.map(entry =>
//                           entry._id === e._id ? { ...entry, [field]: value } : entry
//                         )
//                         const recomputed = recomputeCashOnHand(updatedEntries, prev.initialBalance)
//                         return { ...prev, entries: recomputed }
//                       })

//                       // Update backend
//                       await updateEntry(e._id, field, value)
//                     }

//                   const handleCellDoubleClick = (ev: React.MouseEvent<HTMLTableCellElement>) => {
//                     if (isToday) {
//                       ev.currentTarget.contentEditable = 'true'
//                       ev.currentTarget.focus()
//                     }
//                   }

//                   return (
//                     <tr key={e._id} className="odd:bg-white even:bg-slate-50 hover:bg-blue-50 transition-colors">
//                       <td className="px-3 py-1.5 border-b border-slate-200 whitespace-nowrap text-gray-700">{e.dateDisplay}</td>
//                       <td className="px-3 py-1.5 border-b border-slate-200 text-gray-700"
//                         onDoubleClick={handleCellDoubleClick}
//                         onKeyDown={handleKeyDown}
//                         onBlur={handleCellBlur('description')}>
//                         {e.description || ''}
//                       </td>
//                       <td className="px-3 py-1.5 border-b border-slate-200 text-right text-gray-700"
//                         onDoubleClick={handleCellDoubleClick}
//                         onKeyDown={handleKeyDown}
//                         onBlur={handleCellBlur('cashIn')}>
//                         {e.cashInDisplay}
//                       </td>
//                       <td className="px-3 py-1.5 border-b border-slate-200 text-right text-gray-700"
//                         onDoubleClick={handleCellDoubleClick}
//                         onKeyDown={handleKeyDown}
//                         onBlur={handleCellBlur('cashExpenseOut')}>
//                         {e.cashExpenseOutDisplay}
//                       </td>
//                       <td className="px-3 py-1.5 border-b border-slate-200 text-right text-gray-700"
//                         onDoubleClick={handleCellDoubleClick}
//                         onKeyDown={handleKeyDown}
//                         onBlur={handleCellBlur('cashDepositBank')}>
//                         {e.cashDepositBankDisplay}
//                       </td>
//                       <td className="px-3 py-1.5 border-b border-slate-200 text-right font-medium text-gray-800">{e.cashOnHandSafeDisplay}</td>
//                     </tr>
//                   )
//                 })}

//                 {/* Inline add row */}
//                 <tr className="bg-slate-50">
//                   <td className="px-3 py-2 text-gray-400 border-t border-slate-300 text-sm whitespace-nowrap">
//                     {new Date().toLocaleDateString()}
//                   </td>
//                   <td ref={descRef} onKeyDown={handleKeyDown} contentEditable suppressContentEditableWarning data-placeholder="Description"
//                     className="px-3 py-2 border-t border-slate-300 text-sm text-slate-800 bg-white min-w-[120px] focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm" />
//                   <td ref={cashInRef} onKeyDown={handleKeyDown} contentEditable suppressContentEditableWarning data-placeholder="0.00"
//                     className="px-3 py-2 border-t border-slate-300 text-right text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm" />
//                   <td ref={cashExpenseRef} onKeyDown={handleKeyDown} contentEditable suppressContentEditableWarning data-placeholder="0.00"
//                     className="px-3 py-2 border-t border-slate-300 text-right text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm" />
//                   <td ref={cashDepositRef} onKeyDown={handleKeyDown} contentEditable suppressContentEditableWarning data-placeholder="0.00"
//                     className="px-3 py-2 border-t border-slate-300 text-right text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm" />
//                   <td className="px-3 py-2 border-t border-slate-300 text-right">
//                     <Button size="sm" onClick={handleAddEntry} className="text-sm h-8 px-3">Add</Button>
//                   </td>
//                 </tr>
//               </tbody>
//             </table>
//           </div>
//         )}

//         {!loading && !error && sheet && sheet.entries.length === 0 && (
//           <p className="text-sm text-muted-foreground mt-4 text-center">
//             No entries found for this site.
//           </p>
//         )}
//       </div>
//     )}
//   </div>
// )

// import { createFileRoute, useNavigate } from '@tanstack/react-router'
// import { useEffect, useMemo, useRef, useState } from 'react'
// import { SitePicker } from '@/components/custom/sitePicker'
// import { Button } from '@/components/ui/button'

// type Entry = {
//   _id: string
//   date: string
//   description?: string
//   cashIn: number
//   cashExpenseOut: number
//   cashDepositBank: number
//   cashOnHandSafe?: number
//   createdAt?: string
//   updatedAt?: string
// }

// type SafeSheet = {
//   _id: string
//   site: string
//   initialBalance: number
//   entries: Entry[]
//   createdAt?: string
//   updatedAt?: string
// }

// export const Route = createFileRoute('/_navbarLayout/safesheet')({
//   component: RouteComponent,
//   validateSearch: (search) =>
//     search as {
//       site: string
//     },
//   loaderDeps: ({ search: { site } }) => ({ site })
// })

// export default function RouteComponent() {
//   const { site } = Route.useSearch() as { site?: string }
//   const navigate = useNavigate({ from: Route.fullPath })

//   const updateSearch = (site: string) => {
//     navigate({ search: { site } })
//   }

//   const [sheet, setSheet] = useState<SafeSheet | null>(null)
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState<string | null>(null)

//   const descRef = useRef<HTMLInputElement | null>(null)
//   const cashInRef = useRef<HTMLInputElement | null>(null)
//   const cashExpenseRef = useRef<HTMLInputElement | null>(null)
//   const cashDepositRef = useRef<HTMLInputElement | null>(null)

//   // Format numbers
//   const fmtNumber = (v?: number | null) => {
//     if (v === null || v === undefined || v === 0) return ''
//     return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
//   }

//   // Fetch sheet
//   useEffect(() => {
//     if (!site) {
//       setSheet(null)
//       setError(null)
//       return
//     }
//     let mounted = true
//     const fetchSheet = async () => {
//       setLoading(true)
//       setError(null)
//       try {
//         const res = await fetch(`/api/safesheets/site/${encodeURIComponent(site)}`, {
//           headers: {
//             Authorization: `Bearer ${localStorage.getItem('token')}`,
//             "X-Required-Permission": "safesheet",
//           },
//         })
//         if (res.status === 403) {
//           navigate({ to: '/no-access' })
//           return
//         }
//         if (!res.ok) {
//           const body = await res.json().catch(() => ({}))
//           throw new Error(body?.error || 'Failed to fetch safesheet')
//         }
//         const data: SafeSheet = await res.json()
//         if (mounted) setSheet(data)
//       } catch (err: any) {
//         console.error(err)
//         if (mounted) setError(err.message || 'Unknown error')
//       } finally {
//         if (mounted) setLoading(false)
//       }
//     }
//     fetchSheet()
//     return () => { mounted = false }
//   }, [site])

//   // Read numeric value from input
//   const readEditableNumber = (el?: HTMLInputElement | null) => {
//     if (!el) return 0
//     const txt = el.value.replace(/,/g, '').trim()
//     const n = Number(txt)
//     return isNaN(n) ? 0 : n
//   }

//   // Recompute running balance
//   const recomputeCashOnHand = (entries: Entry[], initialBalance: number) => {
//     let balance = initialBalance
//     return entries.map((entry) => {
//       balance = balance + entry.cashIn - entry.cashExpenseOut - entry.cashDepositBank
//       return { ...entry, cashOnHandSafe: balance }
//     })
//   }

//   // Add entry
//   const handleAddEntry = async () => {
//     if (!site || !sheet) return

//     const entryBody = {
//       date: new Date().toISOString(),
//       description: descRef.current?.value.trim() || '',
//       cashIn: readEditableNumber(cashInRef.current),
//       cashExpenseOut: readEditableNumber(cashExpenseRef.current),
//       cashDepositBank: readEditableNumber(cashDepositRef.current),
//     }

//     if (!entryBody.cashIn && !entryBody.cashExpenseOut && !entryBody.cashDepositBank) {
//       setError('Please enter an amount in one of the fields')
//       return
//     }

//     try {
//       const res = await fetch(`/api/safesheets/site/${encodeURIComponent(site)}/entries`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${localStorage.getItem('token')}`,
//           "X-Required-Permission": "safesheet",
//         },
//         body: JSON.stringify(entryBody)
//       })

//       if (res.status === 403) {
//         navigate({ to: '/no-access' })
//         return
//       }

//       const body = await res.json().catch(() => null)
//       if (!res.ok) throw new Error(body?.error || 'Failed to add entry')

//       if (body?.entries) {
//         const updated = recomputeCashOnHand(body.entries, sheet.initialBalance)
//         setSheet(prev => prev ? { ...prev, entries: updated } : prev)
//       }

//       // Clear inline row
//       if (descRef.current) descRef.current.value = ''
//       if (cashInRef.current) cashInRef.current.value = ''
//       if (cashExpenseRef.current) cashExpenseRef.current.value = ''
//       if (cashDepositRef.current) cashDepositRef.current.value = ''
//       setError(null)
//     } catch (err: any) {
//       console.error(err)
//       setError(err.message || 'Add entry failed')
//     }
//   }

//   // Update a single entry and recompute balances
//   const updateEntry = async (entryId: string, field: string, value: any) => {
//     if (!site || !sheet) return
//     try {
//       const res = await fetch(`/api/safesheets/site/${encodeURIComponent(site)}/entries/${entryId}`, {
//         method: 'PUT',
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${localStorage.getItem('token')}`,
//           "X-Required-Permission": "safesheet",
//         },
//         body: JSON.stringify({ [field]: value }),
//       })
//       if (res.status === 403) {
//         navigate({ to: '/no-access' })
//         return
//       }
//       const body = await res.json().catch(() => null)
//       if (!res.ok) throw new Error(body?.error || 'Failed to update entry')

//       if (body?.entries) {
//         const updated = recomputeCashOnHand(body.entries, sheet.initialBalance)
//         setSheet(prev => prev ? { ...prev, entries: updated } : prev)
//       }
//     } catch (err: any) {
//       console.error(err)
//       setError(err.message || 'Update failed')
//     }
//   }

//   //handle enter key
//   const handleKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
//     if (ev.key === 'Enter') {
//       ev.preventDefault()
//       const form = ev.currentTarget.form
//       if (!form) return

//       const elements = Array.from(form.elements) as HTMLElement[]
//       const index = elements.indexOf(ev.currentTarget)
//       const next = elements[index + 1]
//       next?.focus()
//     }
//   }


//   // Memoized entries for display
//   const formattedEntries = useMemo(() => {
//     if (!sheet) return []
//     return sheet.entries.map(e => ({
//       ...e,
//       dateDisplay: new Date(e.date).toLocaleDateString(),
//       cashInDisplay: fmtNumber(e.cashIn),
//       cashExpenseOutDisplay: fmtNumber(e.cashExpenseOut),
//       cashDepositBankDisplay: fmtNumber(e.cashDepositBank),
//       cashOnHandSafeDisplay: fmtNumber(e.cashOnHandSafe ?? null)
//     }))
//   }, [sheet])

//   const [editing, setEditing] = useState<{ id: string, field: string } | null>(null)
//   const [tempValue, setTempValue] = useState<string>('')

//   return (
//     <div className="pt-14 flex flex-col items-center">
//       <div className="my-4 flex flex-col items-center gap-4">
//         <SitePicker
//           value={site}
//           onValueChange={updateSearch}
//           placeholder="Pick a site"
//           label="Site"
//           className="w-[220px]"
//         />
//       </div>

//       {!site && (
//         <p className="text-sm text-muted-foreground text-center">
//           Please select a site to view the safesheet.
//         </p>
//       )}

//       {site && (
//         <div className="w-full max-w-5xl px-2 sm:px-4">
//           {loading && <p className="text-center">Loading...</p>}
//           {error && <p className="text-red-600 text-center">{error}</p>}

//           {!loading && !error && sheet && (
//             <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-sm bg-white">
//               <table className="min-w-full text-sm border-collapse table-fixed">
//                 <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10">
//                   <tr>
//                     <th className="px-2 py-1 text-left font-medium border-b border-slate-300 w-24">Date</th>
//                     <th className="px-2 py-1 text-left font-medium border-b border-slate-300 w-64">Description</th>
//                     <th className="px-2 py-1 text-right font-medium border-b border-slate-300 w-32">Cash In</th>
//                     <th className="px-2 py-1 text-right font-medium border-b border-slate-300 w-32">Cash Expense Out</th>
//                     <th className="px-2 py-1 text-right font-medium border-b border-slate-300 w-32">Cash Deposit Bank</th>
//                     <th className="px-2 py-1 text-right font-medium border-b border-slate-300 w-32">Cash On Hand</th>
//                   </tr>
//                 </thead>

//                 <tbody>
//                   {formattedEntries.map((e) => {
//                     const isToday = (() => {
//                       const entry = new Date(e.date)
//                       const now = new Date()
//                       return entry.getUTCFullYear() === now.getUTCFullYear() &&
//                         entry.getUTCMonth() === now.getUTCMonth() &&
//                         entry.getUTCDate() === now.getUTCDate()
//                     })()

//                     const handleEdit = (field: string, val: string) => {
//                       setEditing({ id: e._id, field })
//                       setTempValue(val)
//                     }

//                     const handleBlur = async (field: 'description' | 'cashIn' | 'cashExpenseOut' | 'cashDepositBank') => {
//                       if (!isToday) {
//                         setEditing(null)
//                         return
//                       }

//                       let value: string | number = tempValue.trim()
//                       if (field !== 'description') value = Number(value.replace(/,/g, '')) || 0

//                       // Update local state immediately
//                       setSheet(prev => {
//                         if (!prev) return prev
//                         const updatedEntries = prev.entries.map(entry =>
//                           entry._id === e._id ? { ...entry, [field]: value } : entry
//                         )
//                         const recomputed = recomputeCashOnHand(updatedEntries, prev.initialBalance)
//                         return { ...prev, entries: recomputed }
//                       })

//                       // Update backend
//                       await updateEntry(e._id, field, value)
//                       setEditing(null)
//                     }

//                     const renderCell = (
//                       field: 'description' | 'cashIn' | 'cashExpenseOut' | 'cashDepositBank',
//                       displayValue: any
//                     ) => {
//                       const isEditing = editing?.id === e._id && editing?.field === field
//                       if (isEditing) {
//                         const inputType = field === 'description' ? 'text' : 'number'
//                         return (
//                           <input
//                             type={inputType}
//                             value={tempValue}
//                             autoFocus
//                             onChange={(ev) => setTempValue(ev.target.value)}
//                             onBlur={() => handleBlur(field)}
//                             onKeyDown={(ev) => ev.key === 'Enter' && ev.currentTarget.blur()}
//                             className={`w-full bg-white border border-blue-400 rounded px-1 py-0.5 focus:outline-none ${field === 'description' ? 'text-left' : 'text-right'}`}
//                           />
//                         )
//                       }
//                       return (
//                         <span
//                           onDoubleClick={() => handleEdit(field, String(e[field] ?? ''))}
//                           className="block w-full cursor-text"
//                         >
//                           {displayValue || ''}
//                         </span>
//                       )
//                     }

//                     return (
//                       <tr key={e._id} className="odd:bg-white even:bg-slate-50 hover:bg-blue-50 transition-colors">
//                         <td className="px-3 py-1.5 border-b border-slate-200 whitespace-nowrap text-gray-700">{e.dateDisplay}</td>
//                         <td className="px-3 py-1.5 border-b border-slate-200 text-gray-700">
//                           {renderCell('description', e.description)}
//                         </td>
//                         <td className="px-3 py-1.5 border-b border-slate-200 text-right text-gray-700">
//                           {renderCell('cashIn', e.cashInDisplay)}
//                         </td>
//                         <td className="px-3 py-1.5 border-b border-slate-200 text-right text-gray-700">
//                           {renderCell('cashExpenseOut', e.cashExpenseOutDisplay)}
//                         </td>
//                         <td className="px-3 py-1.5 border-b border-slate-200 text-right text-gray-700">
//                           {renderCell('cashDepositBank', e.cashDepositBankDisplay)}
//                         </td>
//                         <td className="px-3 py-1.5 border-b border-slate-200 text-right font-medium text-gray-800">
//                           {e.cashOnHandSafeDisplay}
//                         </td>
//                       </tr>
//                     )
//                   })}

//                   {/* Inline add row */}
//                   <tr className="bg-slate-50">
//                     <td className="px-3 py-2 text-gray-400 border-t border-slate-300 text-sm whitespace-nowrap">
//                       {new Date().toLocaleDateString()}
//                     </td>
//                     <td className="px-3 py-2 border-t border-slate-300 text-sm">
//                       <input ref={descRef} onKeyDown={handleKeyDown} placeholder="Description" className="w-full border rounded px-2 py-1 text-left" />
//                     </td>
//                     <td className="px-3 py-2 border-t border-slate-300 text-sm text-right">
//                       <input ref={cashInRef} onKeyDown={handleKeyDown} placeholder="0.00" type="number" className="w-full border rounded px-2 py-1 text-right" />
//                     </td>
//                     <td className="px-3 py-2 border-t border-slate-300 text-sm text-right">
//                       <input ref={cashExpenseRef} onKeyDown={handleKeyDown} placeholder="0.00" type="number" className="w-full border rounded px-2 py-1 text-right" />
//                     </td>
//                     <td className="px-3 py-2 border-t border-slate-300 text-sm text-right">
//                       <input ref={cashDepositRef} onKeyDown={handleKeyDown} placeholder="0.00" type="number" className="w-full border rounded px-2 py-1 text-right" />
//                     </td>
//                     <td className="px-3 py-2 border-t border-slate-300 text-right">
//                       <Button size="sm" onClick={handleAddEntry} className="text-sm h-8 px-3">Add</Button>
//                     </td>
//                   </tr>
//                 </tbody>
//               </table>
//             </div>
//           )}

//           {!loading && !error && sheet && sheet.entries.length === 0 && (
//             <p className="text-sm text-muted-foreground mt-4 text-center">
//               No entries found for this site.
//             </p>
//           )}
//         </div>
//       )}
//     </div>
//   )
// }
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SitePicker } from '@/components/custom/sitePicker'
import { Button } from '@/components/ui/button'
import { ImagePlus, Image as ImageIcon } from "lucide-react";

type Entry = {
  _id: string
  date: string
  description?: string
  cashIn: number
  cashExpenseOut: number
  cashDepositBank: number
  cashOnHandSafe?: number
  createdAt?: string
  updatedAt?: string
  photo?: string | null
}

type SafeSheet = {
  _id: string
  site: string
  initialBalance: number
  entries: Entry[]
  createdAt?: string
  updatedAt?: string
}

export const Route = createFileRoute('/_navbarLayout/safesheet')({
  component: RouteComponent,
  validateSearch: (search) =>
    search as {
      site: string
    },
  loaderDeps: ({ search: { site } }) => ({ site })
})

export default function RouteComponent() {
  const { site } = Route.useSearch() as { site?: string }
  const navigate = useNavigate({ from: Route.fullPath })

  const updateSearch = (site: string) => {
    navigate({ search: { site } })
  }

  const [sheet, setSheet] = useState<SafeSheet | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // refs for inputs
  const descRef = useRef<HTMLInputElement>(null)
  const cashInRef = useRef<HTMLInputElement>(null)
  const cashExpenseRef = useRef<HTMLInputElement>(null)
  const cashDepositRef = useRef<HTMLInputElement>(null)

  // camera upload
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [photoTargetEntry, setPhotoTargetEntry] = useState<string | null>(null)

  const openCameraForEntry = (entryId: string) => {
    setPhotoTargetEntry(entryId)
    cameraInputRef.current?.click()
  }

  // number formatter
  const fmtNumber = (v?: number | null) => {
    if (v === null || v === undefined || v === 0) return ''
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v)
  }

  // fetch sheet
  useEffect(() => {
    if (!site) {
      setSheet(null)
      setError(null)
      return
    }
    let mounted = true
    const fetchSheet = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/safesheets/site/${encodeURIComponent(site)}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'X-Required-Permission': 'safesheet',
          },
        })

        if (res.status === 403) {
          navigate({ to: '/no-access' })
          return
        }

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error || 'Failed to fetch safesheet')
        }

        const data: SafeSheet = await res.json()
        if (mounted) setSheet(data)
      } catch (err: any) {
        console.error(err)
        if (mounted) setError(err.message || 'Unknown error')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchSheet()
    return () => {
      mounted = false
    }
  }, [site])

  // read numeric value
  const readEditableNumber = (el?: HTMLInputElement | null) => {
    if (!el) return 0
    const txt = el.value.replace(/,/g, '').trim()
    const n = Number(txt)
    return isNaN(n) ? 0 : n
  }

  // recompute running cash
  const recomputeCashOnHand = (entries: Entry[], initialBalance: number) => {
    let balance = initialBalance
    return entries.map((entry) => {
      balance = balance + entry.cashIn - entry.cashExpenseOut - entry.cashDepositBank
      return { ...entry, cashOnHandSafe: balance }
    })
  }

  // ADD ENTRY
  const handleAddEntry = async () => {
    if (!site || !sheet) return

    const entryBody = {
      date: new Date().toISOString(),
      description: descRef.current?.value.trim() || '',
      cashIn: readEditableNumber(cashInRef.current),
      cashExpenseOut: readEditableNumber(cashExpenseRef.current),
      cashDepositBank: readEditableNumber(cashDepositRef.current),
    }

    if (!entryBody.cashIn && !entryBody.cashExpenseOut && !entryBody.cashDepositBank) {
      setError('Please enter an amount in one of the fields')
      return
    }

    try {
      const res = await fetch(`/api/safesheets/site/${encodeURIComponent(site)}/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Required-Permission': 'safesheet',
        },
        body: JSON.stringify(entryBody),
      })

      if (res.status === 403) {
        navigate({ to: '/no-access' })
        return
      }

      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || 'Failed to add entry')

      if (body?.entries) {
        const updated = recomputeCashOnHand(body.entries, sheet.initialBalance)
        setSheet((prev) => (prev ? { ...prev, entries: updated } : prev))
      }

      // clear inputs
      if (descRef.current) descRef.current.value = ''
      if (cashInRef.current) cashInRef.current.value = ''
      if (cashExpenseRef.current) cashExpenseRef.current.value = ''
      if (cashDepositRef.current) cashDepositRef.current.value = ''
      setError(null)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Add entry failed')
    }
  }

  // UPDATE ENTRY
  const updateEntry = async (
    entryId: string,
    field: 'description' | 'cashIn' | 'cashExpenseOut' | 'cashDepositBank' | 'photo',
    value: any,
  ) => {
    if (!site) return

    try {
      const res = await fetch(
        `/api/safesheets/site/${encodeURIComponent(site)}/entries/${entryId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'X-Required-Permission': 'safesheet',
          },
          body: JSON.stringify({ [field]: value }),
        },
      )

      if (res.status === 403) {
        navigate({ to: '/no-access' })
        return
      }

      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || 'Failed to update entry')

      // 🔥 Use backend entries to avoid losing fields like photo
      if (body?.entries) {
        setSheet((prev) =>
          prev
            ? {
                ...prev,
                entries: recomputeCashOnHand(body.entries, prev.initialBalance),
              }
            : prev,
        )
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Update failed')
    }
  }

  // cell editing
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  const isEditing = (id: string, field: string) =>
    editingCell?.id === id && editingCell.field === field

  const startEdit = (entryId: string, field: string, initialValue: string) => {
    setEditingCell({ id: entryId, field })
    setEditValue(initialValue ?? '')
  }

  const finishEdit = async (
    entryId: string,
    field: 'description' | 'cashIn' | 'cashExpenseOut' | 'cashDepositBank',
  ) => {
    let value: string | number = editValue.trim()

    if (field !== 'description') {
      value = value === '' ? 0 : Number(value.replace(/,/g, ''))
    }

    // optimistic UI
    setSheet((prev) => {
      if (!prev) return prev
      const updatedEntries = prev.entries.map((entry) =>
        entry._id === entryId ? { ...entry, [field]: value } : entry,
      )
      const recomputed = recomputeCashOnHand(updatedEntries, prev.initialBalance)
      return { ...prev, entries: recomputed }
    })

    await updateEntry(entryId, field, value)
    setEditingCell(null)
  }

  const handleKeyDown = (ev: React.KeyboardEvent<HTMLElement>) => {
    if (ev.key === 'Enter') {
      ev.preventDefault()
      ev.currentTarget instanceof HTMLInputElement && ev.currentTarget.blur()
    }
  }

  // camera upload handler
  const handleCameraUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!photoTargetEntry) return

    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/cdn/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Image upload failed')

      const data = await res.json()
      const filename = data.filename

      // Update backend entry
      await updateEntry(photoTargetEntry, 'photo', filename)
    } catch (err) {
      console.error(err)
      alert('Failed to upload image')
    }

    e.target.value = ''
    setPhotoTargetEntry(null)
  }

  // format display entries
  const formattedEntries = useMemo(() => {
    if (!sheet) return []
    return sheet.entries.map((e) => ({
      ...e,
      dateDisplay: new Date(e.date).toLocaleDateString(),
      cashInDisplay: fmtNumber(e.cashIn),
      cashExpenseOutDisplay: fmtNumber(e.cashExpenseOut),
      cashDepositBankDisplay: fmtNumber(e.cashDepositBank),
      cashOnHandSafeDisplay: fmtNumber(e.cashOnHandSafe ?? null),
    }))
  }, [sheet])

  return (
    <div className="pt-14 flex flex-col items-center">
      <div className="my-4 flex flex-col items-center gap-4">
        <SitePicker
          value={site}
          onValueChange={updateSearch}
          placeholder="Pick a site"
          label="Site"
          className="w-[220px]"
        />
      </div>

      {!site && (
        <p className="text-sm text-muted-foreground text-center">
          Please select a site to view the safesheet.
        </p>
      )}

      {site && (
        <div className="w-full max-w-5xl px-2 sm:px-4">
          {loading && <p className="text-center">Loading...</p>}
          {error && <p className="text-red-600 text-center">{error}</p>}

          {!loading && !error && sheet && (
            <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-sm bg-white">
              <table className="min-w-full text-sm border-collapse table-fixed">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium border-b border-slate-300 w-24">
                      Date
                    </th>
                    <th className="px-2 py-1 text-left font-medium border-b border-slate-300 w-50">
                      Description
                    </th>
                    <th className="px-2 py-1 text-right font-medium border-b border-slate-300 w-42">
                      Cash In
                    </th>
                    <th className="px-2 py-1 text-right font-medium border-b border-slate-300 w-42">
                      Cash Expense Out
                    </th>
                    <th className="px-2 py-1 text-right font-medium border-b border-slate-300 w-42">
                      Cash Deposit Bank
                    </th>
                    <th className="px-2 py-1 text-right font-medium border-b border-slate-300 w-42">
                      Cash On Hand
                    </th>
                    <th className="px-2 py-1 text-center font-medium border-b border-slate-300 w-32">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {formattedEntries.map((e) => {
                    const isToday = (() => {
                      const entry = new Date(e.date)
                      const now = new Date()
                      return (
                        entry.getUTCFullYear() === now.getUTCFullYear() &&
                        entry.getUTCMonth() === now.getUTCMonth() &&
                        entry.getUTCDate() === now.getUTCDate()
                      )
                    })()

                    return (
                      <tr
                        key={e._id}
                        className="odd:bg-white even:bg-slate-50 hover:bg-blue-50 transition-colors"
                      >
                        <td className="px-3 py-1.5 border-b border-slate-200 text-gray-700">
                          {e.dateDisplay}
                        </td>

                        {/* Description */}
                        <td className="px-3 py-1.5 border-b border-slate-200 text-gray-700">
                          {isEditing(e._id, 'description') ? (
                            <input
                              autoFocus
                              type="text"
                              value={editValue}
                              onChange={(ev) => setEditValue(ev.target.value)}
                              onBlur={() => finishEdit(e._id, 'description')}
                              onKeyDown={handleKeyDown}
                              className="w-full bg-transparent border-none outline-none p-0 m-0"
                            />
                          ) : (
                            <span
                              className="block w-full cursor-text min-h-[1rem]"
                              onDoubleClick={() =>
                                isToday &&
                                startEdit(e._id, 'description', e.description || '')
                              }
                            >
                              {e.description || '\u00A0'}
                            </span>
                          )}
                        </td>

                        {/* Cash In */}
                        <td className="px-3 py-1.5 border-b border-slate-200 text-right text-gray-700">
                          {isEditing(e._id, 'cashIn') ? (
                            <input
                              autoFocus
                              type="number"
                              value={editValue}
                              onChange={(ev) => setEditValue(ev.target.value)}
                              onBlur={() => finishEdit(e._id, 'cashIn')}
                              onKeyDown={handleKeyDown}
                              className="w-full text-right bg-transparent border-none outline-none p-0 m-0"
                            />
                          ) : (
                            <span
                              className="block w-full cursor-text"
                              onDoubleClick={() =>
                                isToday &&
                                startEdit(
                                  e._id,
                                  'cashIn',
                                  e.cashIn != null ? e.cashIn.toString() : '',
                                )
                              }
                            >
                              {e.cashInDisplay || '\u00A0'}
                            </span>
                          )}
                        </td>

                        {/* Cash Expense Out */}
                        <td className="px-3 py-1.5 border-b border-slate-200 text-right text-gray-700">
                          {isEditing(e._id, 'cashExpenseOut') ? (
                            <input
                              autoFocus
                              type="number"
                              value={editValue}
                              onChange={(ev) => setEditValue(ev.target.value)}
                              onBlur={() => finishEdit(e._id, 'cashExpenseOut')}
                              onKeyDown={handleKeyDown}
                              className="w-full text-right bg-transparent border-none outline-none p-0 m-0"
                            />
                          ) : (
                            <span
                              className="block w-full cursor-text"
                              onDoubleClick={() =>
                                isToday &&
                                startEdit(
                                  e._id,
                                  'cashExpenseOut',
                                  e.cashExpenseOut != null
                                    ? e.cashExpenseOut.toString()
                                    : '',
                                )
                              }
                            >
                              {e.cashExpenseOutDisplay || '\u00A0'}
                            </span>
                          )}
                        </td>

                        {/* Cash Deposit Bank */}
                        <td className="px-3 py-1.5 border-b border-slate-200 text-right text-gray-700">
                          {isEditing(e._id, 'cashDepositBank') ? (
                            <input
                              autoFocus
                              type="number"
                              value={editValue}
                              onChange={(ev) => setEditValue(ev.target.value)}
                              onBlur={() => finishEdit(e._id, 'cashDepositBank')}
                              onKeyDown={handleKeyDown}
                              className="w-full text-right bg-transparent border-none outline-none p-0 m-0"
                            />
                          ) : (
                            <span
                              className="block w-full cursor-text"
                              onDoubleClick={() =>
                                isToday &&
                                startEdit(
                                  e._id,
                                  'cashDepositBank',
                                  e.cashDepositBank != null
                                    ? e.cashDepositBank.toString()
                                    : '',
                                )
                              }
                            >
                              {e.cashDepositBankDisplay || '\u00A0'}
                            </span>
                          )}
                        </td>

                        {/* Cash On Hand */}
                        <td className="px-3 py-1.5 border-b border-slate-200 text-right font-medium text-gray-800">
                          {e.cashOnHandSafeDisplay}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-1.5 border-b border-slate-200 text-center">
                          <div className="flex justify-center">
                          {e.cashDepositBank > 0 &&
                            (!e.photo ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openCameraForEntry(e._id)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-md border-blue-500 text-blue-600 hover:bg-blue-50"
                              >
                                <ImagePlus className="w-4 h-4" />
                                {/* <span className="text-xs font-medium">Add Photo</span> */}
                              </Button>
                            ) : (
                              // Photo exists → Show "View Photo"
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => window.open(`/cdn/download/${e.photo}`, '_blank')}
                                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md"
                              >
                                <ImageIcon className="w-4 h-4" />
                                {/* <span className="text-xs font-medium">View</span> */}
                              </Button>
                            ))}</div>
                        </td>
                      </tr>
                    )
                  })}

                  {/* ADD NEW ROW */}
                  <tr className="bg-slate-50">
                    <td className="px-3 py-2 text-gray-400 border-t border-slate-300">
                      {new Date().toLocaleDateString()}
                    </td>

                    <td className="px-3 py-2 border-t border-slate-300 bg-white">
                      <input
                        ref={descRef}
                        type="text"
                        placeholder="Description"
                        className="w-full px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm"
                        onKeyDown={handleKeyDown}
                      />
                    </td>

                    <td className="px-3 py-2 border-t border-slate-300 text-right bg-white">
                      <input
                        ref={cashInRef}
                        type="number"
                        placeholder="0.00"
                        className="w-full px-3 py-2 text-right bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm"
                        onKeyDown={handleKeyDown}
                      />
                    </td>

                    <td className="px-3 py-2 border-t border-slate-300 text-right bg-white">
                      <input
                        ref={cashExpenseRef}
                        type="number"
                        placeholder="0.00"
                        className="w-full px-3 py-2 text-right bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm"
                        onKeyDown={handleKeyDown}
                      />
                    </td>

                    <td className="px-3 py-2 border-t border-slate-300 text-right bg-white">
                      <input
                        ref={cashDepositRef}
                        type="number"
                        placeholder="0.00"
                        className="w-full px-3 py-2 text-right bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm"
                        onKeyDown={handleKeyDown}
                      />
                    </td>
                    <td></td>

                    <td className="px-3 py-2 border-t border-slate-300 text-right">
                      <Button size="sm" onClick={handleAddEntry} className="text-sm h-8 px-3">
                        Add
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* HIDDEN CAMERA INPUT */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraUpload}
      />
    </div>
  )
}