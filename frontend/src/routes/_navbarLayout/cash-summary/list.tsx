import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { SitePicker } from '@/components/custom/sitePicker'

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
  const { summaries, accessDenied } = Route.useLoaderData() as {
    summaries: CashSummaryDoc[];
    accessDenied: boolean;
  };

  useEffect(() => {
    if (accessDenied) {
      navigate({ to: "/no-access" });
    }
  }, [accessDenied, navigate]);

  if (accessDenied) return null;

  const onRowClick = (id: string) => {
    navigate({ to: '/cash-summary/form', search: { site, id } })
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}