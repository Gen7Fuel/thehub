import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { SitePicker } from '@/components/custom/sitePicker'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type CashSummarySearch = { site: string }

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
  createdAt: string
  updatedAt: string
}

export const Route = createFileRoute('/_navbarLayout/cash-summary/list')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): CashSummarySearch => ({
    site: (search.site as string) || '',
  }),
  loaderDeps: ({ search: { site } }) => ({ site }),
  loader: async ({ deps: { site } }) => {
    if (!site) return { summaries: [] as CashSummaryDoc[], accessDenied: false };

    try {
      const res = await fetch(`/api/cash-summary?site=${encodeURIComponent(site)}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          "X-Required-Permission": "accounting.cashSummary.list"
        },
      });

      if (!res.ok) {
        if (res.status === 403) {
          return { summaries: [], accessDenied: true };
        }
        throw new Error('Failed to load cash summaries');
      }

      const data = await res.json();
      return { summaries: data, accessDenied: false };

    } catch {
      return { summaries: [], accessDenied: false };
    }
  },
});

function RouteComponent() {
  const { site } = Route.useSearch()
  // const { summaries } = Route.useLoaderData() as { summaries: CashSummaryDoc[] }
  const navigate = useNavigate({ from: Route.fullPath })
  const router = useRouter()
  const { summaries, accessDenied } = Route.useLoaderData() as {
    summaries: CashSummaryDoc[];
    accessDenied: boolean;
  };

  const [pendingDelete, setPendingDelete] = useState<CashSummaryDoc | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (accessDenied) {
      navigate({ to: "/no-access" });
    }
  }, [accessDenied, navigate]);

  if (accessDenied) return null;

  const onRowClick = (id: string) => {
    navigate({ to: '/cash-summary/form', search: { site, id } })
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/cash-summary/${pendingDelete._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          'X-Required-Permission': 'accounting.cashSummary.list',
        },
      })
      if (!res.ok) {
        throw new Error('Failed to delete entry')
      }
      setPendingDelete(null)
      await router.invalidate()
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete entry')
    } finally {
      setDeleting(false)
    }
  }

  const updateSite = (newSite: string) => {
    navigate({ search: (prev: CashSummarySearch) => ({ ...prev, site: newSite }) })
  }

  const sorted = useMemo(
    () =>
      [...summaries].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [summaries],
  )

  const duplicateShiftNumbers = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of summaries) {
      const key = String(row.shift_number)
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    const dups = new Set<string>()
    for (const [key, count] of counts) {
      if (count > 1) dups.add(key)
    }
    return dups
  }, [summaries])

  const fmtNum = (n: number | undefined) =>
    n == null ? '—' : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const fmtDateOnly = (iso: string) => {
    if (!iso) return '—'
    // Show exactly YYYY-MM-DD as stored, avoiding timezone shifts
    const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})/)
    return m ? m[1] : new Date(iso).toISOString().slice(0, 10)
  }

  return (
    <div className="pt-4 w-full flex flex-col items-center">
      <div className="w-full max-w-7xl px-4 space-y-6">
        <div className="flex items-end gap-4">
          <SitePicker
            value={site}
            onValueChange={updateSite}
            placeholder="Pick a site"
            label="Site"
            className="w-[220px]"
          />
        </div>

        <div className="border rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/40">
            <h2 className="text-sm font-semibold">Cash Summaries {site && `– ${site}`}</h2>
            {!site && <span className="text-xs text-muted-foreground">Select a site to view entries</span>}
          </div>

          {site && sorted.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No summaries found for this site.</div>
          )}

          {site && sorted.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-muted">
                  <tr className="text-left">
                    <th className="px-3 py-2">Shift</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Canadian Cash</th>
                    <th className="px-3 py-2">Item Sales</th>
                    <th className="px-3 py-2">Cash Back</th>
                    <th className="px-3 py-2">Loyalty</th>
                    <th className="px-3 py-2">CPL Bulloch</th>
                    <th className="px-3 py-2">Exempted Tax</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row) => (
                    <tr
                      key={row._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onRowClick(row._id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onRowClick(row._id)
                        }
                      }}
                      className="cursor-pointer odd:bg-background even:bg-muted/30 hover:bg-primary/10 transition"
                    >
                      <td className="px-3 py-2 font-medium">{row.shift_number}</td>
                      <td className="px-3 py-2">{fmtDateOnly(row.date)}</td>
                      <td className="px-3 py-2">{fmtNum(row.canadian_cash_collected)}</td>
                      <td className="px-3 py-2">{fmtNum(row.item_sales)}</td>
                      <td className="px-3 py-2">{fmtNum(row.cash_back)}</td>
                      <td className="px-3 py-2">{fmtNum(row.loyalty)}</td>
                      <td className="px-3 py-2">{fmtNum(row.cpl_bulloch)}</td>
                      <td className="px-3 py-2">{fmtNum(row.exempted_tax)}</td>
                      <td className="px-3 py-2">{fmtDate(row.createdAt)}</td>
                      <td className="px-3 py-2">
                        {duplicateShiftNumbers.has(String(row.shift_number)) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            aria-label={`Delete duplicate entry for shift ${row.shift_number}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteError(null)
                              setPendingDelete(row)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setPendingDelete(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete cash summary entry?</DialogTitle>
            <DialogDescription>
              {pendingDelete && (
                <>
                  This will permanently delete the entry for shift{' '}
                  <span className="font-semibold">{pendingDelete.shift_number}</span>
                  {pendingDelete.date && <> on {fmtDateOnly(pendingDelete.date)}</>}
                  . This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPendingDelete(null)
                setDeleteError(null)
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}