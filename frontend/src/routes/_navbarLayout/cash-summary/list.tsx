// import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
// import { useEffect, useMemo, useState } from 'react'
// import { Trash2 } from 'lucide-react'
// import { SitePicker } from '@/components/custom/sitePicker'
// import { useSite } from '@/context/SiteContext'
// import { Button } from '@/components/ui/button'
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
// } from '@/components/ui/dialog'

// type CashSummarySearch = { site: string }

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
//   createdAt: string
//   updatedAt: string
// }

// export const Route = createFileRoute('/_navbarLayout/cash-summary/list')({
//   component: RouteComponent,
//   validateSearch: (search: Record<string, unknown>): CashSummarySearch => ({
//     site: (search.site as string) || '',
//   }),
//   loaderDeps: ({ search: { site } }) => ({ site }),
//   loader: async ({ deps: { site } }) => {
//     if (!site) return { summaries: [] as CashSummaryDoc[], accessDenied: false };

//     try {
//       const res = await fetch(`/api/cash-summary?site=${encodeURIComponent(site)}`, {
//         headers: {
//           Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
//           "X-Required-Permission": "accounting.cashSummary.list"
//         },
//       });

//       if (!res.ok) {
//         if (res.status === 403) {
//           return { summaries: [], accessDenied: true };
//         }
//         throw new Error('Failed to load cash summaries');
//       }

//       const data = await res.json();
//       return { summaries: data, accessDenied: false };

//     } catch {
//       return { summaries: [], accessDenied: false };
//     }
//   },
// });

// function RouteComponent() {
//   const { site } = Route.useSearch()
//   const navigate = useNavigate({ from: Route.fullPath })
//   const router = useRouter()
//   const { selectedSite } = useSite()

//   useEffect(() => {
//     if (!site && selectedSite) {
//       navigate({ search: (prev: CashSummarySearch) => ({ ...prev, site: selectedSite }), replace: true })
//     }
//   }, [selectedSite])
//   const { summaries, accessDenied } = Route.useLoaderData() as {
//     summaries: CashSummaryDoc[];
//     accessDenied: boolean;
//   };

//   const [pendingDelete, setPendingDelete] = useState<CashSummaryDoc | null>(null)
//   const [deleting, setDeleting] = useState(false)
//   const [deleteError, setDeleteError] = useState<string | null>(null)

//   useEffect(() => {
//     if (accessDenied) {
//       navigate({ to: "/no-access" });
//     }
//   }, [accessDenied, navigate]);

//   if (accessDenied) return null;

//   const onRowClick = (id: string) => {
//     navigate({ to: '/cash-summary/form', search: { site, id } })
//   }

//   const confirmDelete = async () => {
//     if (!pendingDelete) return
//     setDeleting(true)
//     setDeleteError(null)
//     try {
//       const res = await fetch(`/api/cash-summary/${pendingDelete._id}`, {
//         method: 'DELETE',
//         headers: {
//           Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
//           'X-Required-Permission': 'accounting.cashSummary.list',
//         },
//       })
//       if (!res.ok) {
//         throw new Error('Failed to delete entry')
//       }
//       setPendingDelete(null)
//       await router.invalidate()
//     } catch (err: any) {
//       setDeleteError(err?.message || 'Failed to delete entry')
//     } finally {
//       setDeleting(false)
//     }
//   }

//   const updateSite = (newSite: string) => {
//     navigate({ search: (prev: CashSummarySearch) => ({ ...prev, site: newSite }) })
//   }

//   const sorted = useMemo(
//     () =>
//       [...summaries].sort(
//         (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
//       ),
//     [summaries],
//   )

//   const duplicateShiftNumbers = useMemo(() => {
//     const counts = new Map<string, number>()
//     for (const row of summaries) {
//       const key = String(row.shift_number)
//       counts.set(key, (counts.get(key) || 0) + 1)
//     }
//     const dups = new Set<string>()
//     for (const [key, count] of counts) {
//       if (count > 1) dups.add(key)
//     }
//     return dups
//   }, [summaries])

//   const fmtNum = (n: number | undefined) =>
//     n == null ? '—' : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

//   const fmtDate = (iso: string) => {
//     const d = new Date(iso)
//     return isNaN(d.getTime()) ? '—' : d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
//   }

//   const fmtDateOnly = (iso: string) => {
//     if (!iso) return '—'
//     // Show exactly YYYY-MM-DD as stored, avoiding timezone shifts
//     const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})/)
//     return m ? m[1] : new Date(iso).toISOString().slice(0, 10)
//   }

//   return (
//     <div className="pt-4 w-full flex flex-col items-center">
//       <div className="w-full max-w-7xl px-4 space-y-6">
//         <div className="flex items-end gap-4">
//           <SitePicker
//             value={site}
//             onValueChange={updateSite}
//             placeholder="Pick a site"
//             label="Site"
//             className="w-[220px]"
//           />
//         </div>

//         <div className="border rounded-md overflow-hidden">
//           <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/40">
//             <h2 className="text-sm font-semibold">Cash Summaries {site && `– ${site}`}</h2>
//             {!site && <span className="text-xs text-muted-foreground">Select a site to view entries</span>}
//           </div>

//           {site && sorted.length === 0 && (
//             <div className="p-4 text-sm text-muted-foreground">No summaries found for this site.</div>
//           )}

//           {site && sorted.length > 0 && (
//             <div className="overflow-x-auto">
//               <table className="min-w-full text-xs">
//                 <thead className="bg-muted">
//                   <tr className="text-left">
//                     <th className="px-3 py-2">Shift</th>
//                     <th className="px-3 py-2">Date</th>
//                     <th className="px-3 py-2">Canadian Cash</th>
//                     <th className="px-3 py-2">Item Sales</th>
//                     <th className="px-3 py-2">Cash Back</th>
//                     <th className="px-3 py-2">Loyalty</th>
//                     <th className="px-3 py-2">CPL Bulloch</th>
//                     <th className="px-3 py-2">Exempted Tax</th>
//                     <th className="px-3 py-2">Created</th>
//                     <th className="px-3 py-2 w-10"></th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {sorted.map((row) => (
//                     <tr
//                       key={row._id}
//                       role="button"
//                       tabIndex={0}
//                       onClick={() => onRowClick(row._id)}
//                       onKeyDown={(e) => {
//                         if (e.key === 'Enter' || e.key === ' ') {
//                           e.preventDefault()
//                           onRowClick(row._id)
//                         }
//                       }}
//                       className="cursor-pointer odd:bg-background even:bg-muted/30 hover:bg-primary/10 transition"
//                     >
//                       <td className="px-3 py-2 font-medium">{row.shift_number}</td>
//                       <td className="px-3 py-2">{fmtDateOnly(row.date)}</td>
//                       <td className="px-3 py-2">{fmtNum(row.canadian_cash_collected)}</td>
//                       <td className="px-3 py-2">{fmtNum(row.item_sales)}</td>
//                       <td className="px-3 py-2">{fmtNum(row.cash_back)}</td>
//                       <td className="px-3 py-2">{fmtNum(row.loyalty)}</td>
//                       <td className="px-3 py-2">{fmtNum(row.cpl_bulloch)}</td>
//                       <td className="px-3 py-2">{fmtNum(row.exempted_tax)}</td>
//                       <td className="px-3 py-2">{fmtDate(row.createdAt)}</td>
//                       <td className="px-3 py-2">
//                         {duplicateShiftNumbers.has(String(row.shift_number)) && (
//                           <Button
//                             type="button"
//                             variant="ghost"
//                             size="icon"
//                             className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
//                             aria-label={`Delete duplicate entry for shift ${row.shift_number}`}
//                             onClick={(e) => {
//                               e.stopPropagation()
//                               setDeleteError(null)
//                               setPendingDelete(row)
//                             }}
//                           >
//                             <Trash2 className="h-4 w-4" />
//                           </Button>
//                         )}
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </div>
//       </div>

//       <Dialog
//         open={!!pendingDelete}
//         onOpenChange={(open) => {
//           if (!open && !deleting) {
//             setPendingDelete(null)
//             setDeleteError(null)
//           }
//         }}
//       >
//         <DialogContent>
//           <DialogHeader>
//             <DialogTitle>Delete cash summary entry?</DialogTitle>
//             <DialogDescription>
//               {pendingDelete && (
//                 <>
//                   This will permanently delete the entry for shift{' '}
//                   <span className="font-semibold">{pendingDelete.shift_number}</span>
//                   {pendingDelete.date && <> on {fmtDateOnly(pendingDelete.date)}</>}
//                   . This action cannot be undone.
//                 </>
//               )}
//             </DialogDescription>
//           </DialogHeader>
//           {deleteError && (
//             <p className="text-sm text-destructive">{deleteError}</p>
//           )}
//           <DialogFooter>
//             <Button
//               type="button"
//               variant="outline"
//               onClick={() => {
//                 setPendingDelete(null)
//                 setDeleteError(null)
//               }}
//               disabled={deleting}
//             >
//               Cancel
//             </Button>
//             <Button
//               type="button"
//               variant="destructive"
//               onClick={confirmDelete}
//               disabled={deleting}
//             >
//               {deleting ? 'Deleting…' : 'Delete'}
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </div>
//   )
// }

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { SitePicker } from '@/components/custom/sitePicker'
import { DatePicker } from '@/components/custom/datePicker'
import { useSite } from '@/context/SiteContext'
import { CheckCircle2, AlertCircle, Calendar, ArrowRight, Lock } from 'lucide-react'

type CashSummarySearch = {
  site?: string
  from?: string
  to?: string
}

interface GroupedDailySummary {
  date: string
  shift_numbers: string[]
  canadian_cash_collected: number
  item_sales: number
  cash_back: number
  loyalty: number
  cpl_bulloch: number
  exempted_tax: number
  allReviewed: boolean
  isSubmitted?: boolean
}

// Compute default ISO date strings (YYYY-MM-DD)
const getYesterdayDateString = (): string => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

const get30DaysPriorDateString = (baseDateStr: string): string => {
  const [yy, mm, dd] = baseDateStr.split('-').map(Number)
  const d = new Date(yy, mm - 1, dd)
  d.setDate(d.getDate() - 30)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dt = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dt}`
}

export const Route = createFileRoute('/_navbarLayout/cash-summary/list')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): CashSummarySearch => ({
    site: (search.site as string) || '',
    from: (search.from as string) || '',
    to: (search.to as string) || '',
  }),
  loaderDeps: ({ search: { site, from, to } }) => ({ site, from, to }),
  loader: async ({ deps: { site, from, to } }) => {
    if (!site) return { summaries: [] as GroupedDailySummary[], accessDenied: false }

    const defaultTo = to || getYesterdayDateString()
    const defaultFrom = from || get30DaysPriorDateString(defaultTo)

    try {
      const res = await fetch(
        `/api/cash-summary/by-range?site=${encodeURIComponent(site)}&from=${encodeURIComponent(defaultFrom)}&to=${encodeURIComponent(defaultTo)}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
            'X-Required-Permission': 'accounting.cashSummary.list',
          },
        }
      )

      if (!res.ok) {
        if (res.status === 403) return { summaries: [], accessDenied: true }
        throw new Error('Failed to load cash summaries')
      }

      const data = await res.json()
      return { summaries: data, accessDenied: false }
    } catch {
      return { summaries: [], accessDenied: false }
    }
  },
})

function RouteComponent() {
  const { site, from: queryFrom, to: queryTo } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { selectedSite } = useSite()

  const currentSite = site || selectedSite || ''

  // Active string representations from search parameters or computed defaults
  const activeToStr = queryTo || getYesterdayDateString()
  const activeFromStr = queryFrom || get30DaysPriorDateString(activeToStr)

  // Derive Date objects for DatePickers directly from search parameters
  const fromDate = useMemo(() => {
    if (!activeFromStr) return undefined
    const [yy, mm, dd] = activeFromStr.split('-').map(Number)
    return new Date(yy, mm - 1, dd, 0, 0, 0, 0)
  }, [activeFromStr])

  const toDate = useMemo(() => {
    if (!activeToStr) return undefined
    const [yy, mm, dd] = activeToStr.split('-').map(Number)
    return new Date(yy, mm - 1, dd, 0, 0, 0, 0)
  }, [activeToStr])

  const { summaries, accessDenied } = Route.useLoaderData() as {
    summaries: GroupedDailySummary[]
    accessDenied: boolean
  }

  // Redirect if permission denied
  useEffect(() => {
    if (accessDenied) {
      navigate({ to: '/no-access' })
    }
  }, [accessDenied, navigate])

  // Sync default search params to URL if missing
  useEffect(() => {
    if (!site || !queryFrom || !queryTo) {
      navigate({
        search: (prev: any) => ({
          site: prev.site || selectedSite || '',
          from: prev.from || activeFromStr,
          to: prev.to || activeToStr,
        }),
        replace: true,
      })
    }
  }, [site, queryFrom, queryTo, selectedSite, activeFromStr, activeToStr, navigate])

  const handleUpdateSite = (newSite: string) => {
    navigate({
      search: (prev: any) => ({ ...prev, site: newSite }),
      replace: true,
    })
  }

  // Match Dispatch<SetStateAction<Date | undefined>> to correctly handle direct values and function updaters
  const handleFromDateChange: React.Dispatch<React.SetStateAction<Date | undefined>> = (value) => {
    const d = typeof value === 'function' ? value(fromDate) : value
    if (!d) return
    const yy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const formattedFrom = `${yy}-${mm}-${dd}`

    navigate({
      search: (prev: any) => ({ ...prev, from: formattedFrom }),
      replace: true,
    })
  }

  const handleToDateChange: React.Dispatch<React.SetStateAction<Date | undefined>> = (value) => {
    const d = typeof value === 'function' ? value(toDate) : value
    if (!d) return
    const yy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const formattedTo = `${yy}-${mm}-${dd}`

    navigate({
      search: (prev: any) => ({ ...prev, to: formattedTo }),
      replace: true,
    })
  }

  const onRowClick = (dateStr: string, isSubmitted?: boolean) => {
    if (isSubmitted) return
    navigate({
      to: '/cash-summary/form',
      search: { site: currentSite, date: dateStr },
    })
  }

  const fmtNum = (n: number) =>
    n === 0
      ? '—'
      : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  if (accessDenied) return null

  return (
    <div className="pt-6 w-full flex flex-col items-center">
      <div className="w-full max-w-7xl px-4 space-y-6">
        {/* Filter Controls Header */}
        <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-wrap items-end gap-4">
          <div className="w-[220px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Site</label>
            <SitePicker
              value={currentSite}
              onValueChange={handleUpdateSite}
              placeholder="Pick a site"
              label="Site"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">From Date</label>
            <DatePicker
              date={fromDate}
              setDate={handleFromDateChange}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">To Date</label>
            <DatePicker
              date={toDate}
              setDate={handleToDateChange}
            />
          </div>
        </div>

        {/* Financial Accounting Table */}
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/20">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Daily Cash Summaries {currentSite && `— ${currentSite}`}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click any unlocked daily row to inspect or edit individual shift forms.
              </p>
            </div>
            {summaries.length > 0 && (
              <span className="text-xs font-medium px-2.5 py-1 bg-primary/10 text-primary rounded-full">
                {summaries.length} {summaries.length === 1 ? 'Day' : 'Days'} Records
              </span>
            )}
          </div>

          {!currentSite ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Please select a site above to display cash summaries.
            </div>
          ) : summaries.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No entries found for the selected date range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Shifts</th>
                    <th className="px-4 py-3 text-right">Canadian Cash</th>
                    <th className="px-4 py-3 text-right">Item Sales</th>
                    <th className="px-4 py-3 text-right">Cash Back</th>
                    <th className="px-4 py-3 text-right">Loyalty</th>
                    <th className="px-4 py-3 text-right">CPL Bulloch</th>
                    <th className="px-4 py-3 text-right">Exempted Tax</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-3 py-3 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {summaries.map((row) => {
                    const isReviewed = row.allReviewed
                    const isSubmitted = !!row.isSubmitted

                    return (
                      <tr
                        key={row.date}
                        onClick={() => onRowClick(row.date, isSubmitted)}
                        className={`group transition-colors ${
                          isSubmitted
                            ? 'bg-muted/30 cursor-not-allowed opacity-80'
                            : isReviewed
                            ? 'cursor-pointer bg-emerald-50/40 hover:bg-emerald-100/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30'
                            : 'cursor-pointer bg-rose-50/50 hover:bg-rose-100/70 dark:bg-rose-950/20 dark:hover:bg-rose-900/30'
                        }`}
                      >
                        <td className="px-4 py-3.5 font-semibold text-foreground whitespace-nowrap flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          {row.date}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {row.shift_numbers.map((num) => (
                              <span
                                key={num}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-background/80 border text-foreground"
                              >
                                #{num}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-medium">{fmtNum(row.canadian_cash_collected)}</td>
                        <td className="px-4 py-3.5 text-right font-mono text-muted-foreground">{fmtNum(row.item_sales)}</td>
                        <td className="px-4 py-3.5 text-right font-mono text-muted-foreground">{fmtNum(row.cash_back)}</td>
                        <td className="px-4 py-3.5 text-right font-mono text-muted-foreground">{fmtNum(row.loyalty)}</td>
                        <td className="px-4 py-3.5 text-right font-mono text-muted-foreground">{fmtNum(row.cpl_bulloch)}</td>
                        <td className="px-4 py-3.5 text-right font-mono text-muted-foreground">{fmtNum(row.exempted_tax)}</td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          {isSubmitted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                              <Lock className="w-3.5 h-3.5" /> Locked & Submitted
                            </span>
                          ) : isReviewed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Reviewed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                              <AlertCircle className="w-3.5 h-3.5" /> Pending Attention
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 text-muted-foreground">
                          {isSubmitted ? (
                            <Lock className="w-4 h-4 text-amber-600/80" />
                          ) : (
                            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}