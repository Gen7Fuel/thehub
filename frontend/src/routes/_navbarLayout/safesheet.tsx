import { Calendar } from '@/components/ui/calendar';
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SitePicker } from '@/components/custom/sitePicker'
import { Button } from '@/components/ui/button'
import { ImagePlus, Image as ImageIcon, CalendarDaysIcon } from "lucide-react";
import { DatePickerWithRange } from '@/components/custom/datePickerWithRange'
import type { DateRange } from 'react-day-picker'
import { getStartAndEndOfToday } from '@/lib/utils'
import { PasswordProtection } from "@/components/custom/PasswordProtection";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch';

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
  assignedDate?: string
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
  ({
    site: (search as any).site ?? '',
    from: (search as any).from ?? '',
    to: (search as any).to ?? '',
  } as {
    site: string
    from: string
    to: string
  }),
  loaderDeps: ({ search: { site, from, to } }) => ({ site, from, to }),
})
// export const Route = createFileRoute('/_navbarLayout/safesheet')({
//   component: RouteComponent,
//   validateSearch: (search) =>
//     search as {
//       site: string
//     },
//   loaderDeps: ({ search: { site } }) => ({ site })
// })

// Helpers for YYYY-MM-DD
const pad = (n: number) => String(n).padStart(2, '0')
const ymdFixed = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseYmd = (s?: string) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

export default function RouteComponent() {
  // State for calendar modal
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarModalEntryId, setCalendarModalEntryId] = useState<string | null>(null);
  // const { site } = Route.useSearch() as { site?: string }
  const { user } = useAuth();
  const { site, from, to } = Route.useSearch() as { site?: string; from?: string; to?: string }
  const navigate = useNavigate({ from: Route.fullPath })

  const setSearch = (next: Partial<{ site: string; from: string; to: string }>) => {
    navigate({ search: (prev: any) => ({ ...prev, ...next }) })
  }

  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  useEffect(() => {
    setShowPasswordDialog(true);
  }, []);

  const handlePasswordSuccess = () => {
    setHasAccess(true);
    setShowPasswordDialog(false);
  };

  const handlePasswordCancel = () => {
    setShowPasswordDialog(false)
    // Navigate back to cycle-count main page
    navigate({ to: '/' })
  }

  // Initialize defaults in URL if missing
  useEffect(() => {
    if (!from || !to) {
      const { start, end } = getStartAndEndOfToday()
      setSearch({ from: start.toISOString(), to: end.toISOString() })
    }
  }, [from, to])

  // Ensure URL has a 7-day YYYY-MM-DD range if missing/invalid
  useEffect(() => {
    const valid = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
    if (!valid(from) || !valid(to)) {
      const today = new Date()
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0)
      const start = new Date(end); start.setDate(end.getDate() - 6)
      setSearch({ from: ymd(start), to: ymd(end) })
    }
  }, [from, to])

  // Convert URL YYYY-MM-DD to DateRange for the picker
  const date: DateRange | undefined =
    parseYmd(from) && parseYmd(to) ? { from: parseYmd(from), to: parseYmd(to) } : undefined

  // // Convert URL params to DateRange for the picker
  // const date: DateRange | undefined =
  //   from && to ? { from: new Date(from), to: new Date(to) } : undefined

  // // Update URL on date change (no local state)
  // const onDateChange = (next?: DateRange) => {
  //   if (!next?.from || !next?.to) return
  //   setSearch({ from: next.from.toISOString(), to: next.to.toISOString() })
  // }

  // const updateSearch = (site: string) => {
  //   navigate({ search: { site } })
  // }

  const [sheet, setSheet] = useState<SafeSheet | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Add Cash In dialog state
  const [showAddCashIn, setShowAddCashIn] = useState(false)
  const [addCashInAmount, setAddCashInAmount] = useState<string>('')
  const [addCashInDesc, setAddCashInDesc] = useState('')
  const [addCashInLoading, setAddCashInLoading] = useState(false)
  const [addCashInError, setAddCashInError] = useState<string | null>(null)

  // Switch state for UI extensibility
  const [switchValue, setSwitchValue] = useState(false);

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

  // dedicated formatter that shows zero (for Cash On Hand only)
  const fmtNumberShowZero = (v?: number | null) => {
    if (v === null || v === undefined) return ''
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v)
  }

  // fetch sheet
  useEffect(() => {
    if (!site || !from || !to) {
      setSheet(null);
      setError(null);
      return;
    }
    let mounted = true;
    const fetchSheet = async () => {
      setLoading(true);
      setError(null);
      try {
        const sortAssigned = switchValue ? 'true' : 'false';
        const res = await fetch(
          `/api/safesheets/site/${encodeURIComponent(site)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&sortAssigned=${sortAssigned}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
              'X-Required-Permission': 'accounting.safesheet',
            },
          }
        );
        if (res.status === 403) {
          navigate({ to: '/no-access' });
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || 'Failed to fetch safesheet');
        }
        const data: SafeSheet = await res.json();
        if (mounted) setSheet(data);
      } catch (err: any) {
        console.error(err);
        if (mounted) setError(err.message || 'Unknown error');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchSheet();
    return () => {
      mounted = false;
    };
  }, [site, from, to, switchValue]);

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

  // Add Cash In via dialog
  const submitAddCashIn = async () => {
    setAddCashInError(null)
    if (!site) {
      setAddCashInError('Select a site first')
      return
    }

    const amount = Number(addCashInAmount.replace(/,/g, '').trim())
    if (!isFinite(amount) || amount <= 0) {
      setAddCashInError('Enter a positive amount')
      return
    }

    // Use the current timestamp to avoid timezone drift from YYYY-MM-DD parsing
    const entryBody = {
      date: new Date().toISOString(),
      description: addCashInDesc.trim(),
      cashIn: amount,
      cashExpenseOut: 0,
      cashDepositBank: 0,
    }

    try {
      setAddCashInLoading(true)
      const res = await fetch(`/api/safesheets/site/${encodeURIComponent(site)}/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Required-Permission': 'accounting.safesheet',
        },
        body: JSON.stringify(entryBody),
      })

      if (res.status === 403) {
        navigate({ to: '/no-access' })
        return
      }

      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || 'Failed to add entry')

      // Refresh safesheet for the current range to avoid showing out-of-range entries
      if (site && from && to) {
        try {
          const ref = await fetch(
            `/api/safesheets/site/${encodeURIComponent(site)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`,
                'X-Required-Permission': 'accounting.safesheet',
              },
            },
          )
          if (!ref.ok) throw new Error('Failed to refresh safesheet')
          const refreshed: SafeSheet = await ref.json()
          setSheet(refreshed)
        } catch (refreshErr) {
          console.error(refreshErr)
        }
      }

      // close and reset dialog
      setShowAddCashIn(false)
      setAddCashInAmount('')
      setAddCashInDesc('')
    } catch (err: any) {
      console.error(err)
      setAddCashInError(err.message || 'Add entry failed')
    } finally {
      setAddCashInLoading(false)
    }
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
          'X-Required-Permission': 'accounting.safesheet',
        },
        body: JSON.stringify(entryBody),
      })

      if (res.status === 403) {
        navigate({ to: '/no-access' })
        return
      }

      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || 'Failed to add entry')

      // Refresh safesheet for the current range to avoid showing out-of-range entries
      if (site && from && to) {
        try {
          const ref = await fetch(
            `/api/safesheets/site/${encodeURIComponent(site)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`,
                'X-Required-Permission': 'accounting.safesheet',
              },
            },
          )
          if (!ref.ok) throw new Error('Failed to refresh safesheet')
          const refreshed: SafeSheet = await ref.json()
          setSheet(refreshed)
        } catch (refreshErr) {
          console.error(refreshErr)
        }
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
            'X-Required-Permission': 'accounting.safesheet',
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

      // Refresh safesheet for the current range to keep entries scoped
      if (site && from && to) {
        try {
          const ref = await fetch(
            `/api/safesheets/site/${encodeURIComponent(site)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`,
                'X-Required-Permission': 'accounting.safesheet',
              },
            },
          )
          if (!ref.ok) throw new Error('Failed to refresh safesheet')
          const refreshed: SafeSheet = await ref.json()
          setSheet(refreshed)
        } catch (refreshErr) {
          console.error(refreshErr)
        }
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

  // format and sort display entries
  const formattedEntries = useMemo(() => {
    if (!sheet) return [];
    const entries = sheet.entries.map((e, idx) => {
      const d = new Date(e.date);
      return {
        ...e,
        _originalIndex: idx,
        dateDisplay: ymdFixed(d),
        cashInDisplay: fmtNumber(e.cashIn),
        cashExpenseOutDisplay: fmtNumber(e.cashExpenseOut),
        cashDepositBankDisplay: fmtNumber(e.cashDepositBank),
        cashOnHandSafeDisplay: fmtNumberShowZero(e.cashOnHandSafe ?? 0),
      };
    });

    if (!switchValue) return entries;

    // Helper: get sort key
    const getSortKey = (entry: { _originalIndex?: number; dateDisplay?: string; cashInDisplay?: string; cashExpenseOutDisplay?: string; cashDepositBankDisplay?: string; cashOnHandSafeDisplay?: string; _id?: string; date: any; description?: string | undefined; cashIn?: number; cashExpenseOut?: number; cashDepositBank?: number; cashOnHandSafe?: number | undefined; createdAt?: string | undefined; updatedAt?: string | undefined; photo?: string | null | undefined; assignedDate?: string; }) => {
      if (entry.assignedDate && /^\d{4}-\d{2}-\d{2}$/.test(entry.assignedDate)) {
        return entry.assignedDate;
      }
      // fallback to date
      const x = new Date(entry.date);
      const y = x.getFullYear();
      const m = String(x.getMonth() + 1).padStart(2, '0');
      const day = String(x.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    // Helper: type rank
    const typeRank = (e: { _originalIndex?: number; dateDisplay?: string; cashInDisplay?: string; cashExpenseOutDisplay?: string; cashDepositBankDisplay?: string; cashOnHandSafeDisplay?: string; _id?: string; date?: string; description?: string | undefined; cashIn: any; cashExpenseOut: any; cashDepositBank: any; cashOnHandSafe?: number | undefined; createdAt?: string | undefined; updatedAt?: string | undefined; photo?: string | null | undefined; assignedDate?: string | undefined; }) => {
      const ci = Number(e.cashIn || 0);
      const ce = Number(e.cashExpenseOut || 0);
      const cb = Number(e.cashDepositBank || 0);
      if (ci > 0) return 0;
      if (ce > 0) return 1;
      if (cb > 0) return 2;
      return 3;
    };

    // Sort by sort key, then by type rank, then by original index
    return [...entries].sort((a, b) => {
      const ka = getSortKey(a);
      const kb = getSortKey(b);
      if (ka !== kb) return ka.localeCompare(kb);
      const ra = typeRank(a);
      const rb = typeRank(b);
      if (ra !== rb) return ra - rb;
      return a._originalIndex - b._originalIndex;
    });
  }, [sheet, switchValue]);

  return (
    <>
      {!hasAccess && (
        <PasswordProtection
          isOpen={showPasswordDialog}
          onSuccess={handlePasswordSuccess}
          onCancel={handlePasswordCancel}
          userLocation={user?.location || "Rankin"}
        />
      )}

      {hasAccess && (
        <div className="pt-5 flex flex-col items-center">
          <div className="my-4 flex flex-row items-center gap-4 w-full max-w-5xl px-2 sm:px-4">
            <SitePicker
              value={site}
              onValueChange={(v) => setSearch({ site: v })}
              placeholder="Pick a site"
              label="Site"
              className="w-[220px]"
            />
            <DatePickerWithRange
              date={date}
              setDate={(val) => {
                const next = typeof val === 'function' ? val(date) : val
                if (!next?.from || !next?.to) return
                setSearch({ from: ymd(next.from), to: ymd(next.to) })
              }}
            />
            {/* Switch for UI extensibility */}
            <div className="flex items-center ml-auto mr-2">
              <span className="mr-2 text-sm text-gray-700">Sort</span>
              {/* Import Switch from shadcn/ui if not already */}
              <Switch checked={switchValue} onCheckedChange={setSwitchValue} />
            </div>
            <Button
              size="sm"
              onClick={() => {
                setAddCashInError(null)
                setShowAddCashIn(true)
              }}
              disabled={!site}
            >
              Add Cash In
            </Button>
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
                              <div className="flex justify-center gap-2">
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
                                  ))}

                                  {e.cashDepositBank > 0 && (
                                    e.assignedDate ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setCalendarModalEntryId(e._id);
                                          setShowCalendarModal(true);
                                        }}
                                        className="flex items-center justify-center rounded-md border-blue-500 text-blue-600"
                                        style={{ width: 38, height: 33, minWidth: 38, minHeight: 33, padding: 0 }}
                                      >
                                        {(() => {
                                          // Parse YYYY-MM-DD as local date
                                          const parseLocalYMD = (s: string) => {
                                            if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
                                            const [y, m, d] = s.split('-').map(Number);
                                            return new Date(y, m - 1, d);
                                          };
                                          const d = parseLocalYMD(e.assignedDate);
                                          const day = d ? d.getDate() : '';
                                          const month = d ? d.toLocaleString('en-US', { month: 'short' }).toUpperCase() : '';
                                          return (
                                            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                                              <span style={{ fontSize: '0.5em', fontWeight: 500 }}>{month}</span>
                                              <span style={{ fontSize: '1em', fontWeight: 700 }}>{day}</span>
                                            </span>
                                          );
                                        })()}
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setCalendarModalEntryId(e._id);
                                          setShowCalendarModal(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-md border-blue-500 text-blue-600 hover:bg-blue-50"
                                      >
                                        <CalendarDaysIcon className="w-4 h-4" />
                                      </Button>
                                    )
                                  )}
                                    {/* Calendar Modal */}
                                    <Dialog
                                      open={showCalendarModal}
                                      onOpenChange={(open) => {
                                        setShowCalendarModal(open);
                                        if (!open) setCalendarModalEntryId(null);
                                      }}
                                    >
                                      <DialogContent className="sm:max-w-xs">
                                        <Calendar
                                          mode="single"
                                          onSelect={async (date) => {
                                            if (!date || !calendarModalEntryId) return;
                                            // Format as YYYY-MM-DD (local date only)
                                            const d = new Date(date);
                                            const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                                            try {
                                              const body = { assignedDate: dateStr };
                                              const res = await fetch(`/api/safesheets/site/${site}/entries/${calendarModalEntryId}`, {
                                                method: 'PUT',
                                                headers: {
                                                  'Content-Type': 'application/json',
                                                  Authorization: `Bearer ${localStorage.getItem('token')}`,
                                                  'X-Required-Permission': 'accounting.safesheet',
                                                },
                                                body: JSON.stringify(body),
                                              });
                                              if (res.ok) {
                                                setSheet((prev) => {
                                                  if (!prev) return prev;
                                                  return {
                                                    ...prev,
                                                    entries: prev.entries.map(entry =>
                                                      entry._id === calendarModalEntryId
                                                        ? { ...entry, assignedDate: dateStr }
                                                        : entry
                                                    )
                                                  };
                                                });
                                              }
                                            } catch (err) {
                                              console.error('Failed to update assigned date', err);
                                            }
                                            setShowCalendarModal(false);
                                            setCalendarModalEntryId(null);
                                        }}
                                        />
                                      </DialogContent>
                                    </Dialog>
                              </div>
                            </td>
                          </tr>
                        )
                      })}

                      {/* ADD NEW ROW */}
                      <tr className="bg-slate-50">
                        <td className="px-3 py-2 text-gray-400 border-t border-slate-300">
                          {ymdFixed(new Date())}
                          {/* or: new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date()) */}
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
                            placeholder=""
                            className="w-full px-3 py-2 text-right bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm"
                            onKeyDown={handleKeyDown}
                            disabled
                          />
                        </td>

                        <td className="px-3 py-2 border-t border-slate-300 text-right bg-white">
                          <input
                            ref={cashExpenseRef}
                            type="number"
                            placeholder=""
                            className="w-full px-3 py-2 text-right bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm"
                            onKeyDown={handleKeyDown}
                            disabled
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
      )}

      {/* Add Cash In Dialog */}
      <Dialog
        open={showAddCashIn}
        onOpenChange={(open) => {
          setShowAddCashIn(open)
          if (!open) {
            setAddCashInAmount('')
            setAddCashInDesc('')
            setAddCashInError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Cash In</DialogTitle>
          </DialogHeader>

          {addCashInError && (
            <p className="text-red-600 text-sm">{addCashInError}</p>
          )}

          <div className="space-y-3">
            <input
              type="text"
              value={addCashInDesc}
              onChange={(e) => setAddCashInDesc(e.target.value)}
              placeholder="Description"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              onKeyDown={handleKeyDown}
            />
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={addCashInAmount}
              onChange={(e) => setAddCashInAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-right bg-white border border-slate-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              onKeyDown={handleKeyDown}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddCashIn(false)
                setAddCashInAmount('')
                setAddCashInDesc('')
                setAddCashInError(null)
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={submitAddCashIn}
              disabled={addCashInLoading || !site}
            >
              {addCashInLoading ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}