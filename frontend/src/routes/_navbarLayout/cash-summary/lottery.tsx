import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useFormStore } from '@/store'
import { DatePicker } from '@/components/custom/datePicker'
import { SitePicker } from '@/components/custom/sitePicker'
import { useAuth } from '@/context/AuthContext'

export const Route = createFileRoute('/_navbarLayout/cash-summary/lottery')({
  component: RouteComponent,
})

const ROWS = [
  { key: 'onlineSales', label: 'Online Sales' },
  { key: 'scratchSales', label: 'Scratch Sales' },
  { key: 'scratchFreeTickets', label: 'Scratch Free Tickets' },
  { key: 'payouts', label: 'Payouts' },
  { key: 'datawaveValue', label: 'Datawave Value' },
  { key: 'datawaveFee', label: 'Datawave Fee' },
] as const

function RouteComponent() {
  const date = useFormStore((s) => s.date)
  const setDate = useFormStore((s) => s.setDate)
  const lotteryValues = useFormStore((s) => s.lotteryValues)
  const setLotteryValues = useFormStore((s) => s.setLotteryValues)
  const setLotterySite = useFormStore((s) => s.setLotterySite)

  // images are stored in the store and used on the images page
  // const lotteryImages = useFormStore((s) => s.lotteryImages)
  const setLotteryImages = useFormStore((s) => s.setLotteryImages)

  const { user } = useAuth()

  // Bullock report totals fetched from backend for selected site+date
  const [bullock, setBullock] = useState<Record<string, number>>({})
  const [site, setSite] = useState<string>(user?.location || '')
  const [_, setExistingEntry] = useState(false)

  useEffect(() => {
    if (!user?.location) return
    // set default site when auth provides user
    setSite(user.location)
    setLotterySite(user.location)
  }, [user])

  useEffect(() => {
    // persist selected site into global store so images page can access it
    setLotterySite(site)
  }, [site, setLotterySite])

  const toYmd = (d?: Date) => {
    if (!d) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  useEffect(() => {
    const ymd = toYmd(date)
    if (!site || !ymd) return

    const controller = new AbortController();
    (async () => {
      try {
        const token = localStorage.getItem('token')
        const resp = await fetch(`/api/cash-summary/lottery?site=${encodeURIComponent(site)}&date=${encodeURIComponent(ymd)}`, {
          signal: controller.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!resp.ok) {
          console.warn('Lottery fetch returned', resp.status, await resp.text().catch(() => ''))
          setBullock({})
          setExistingEntry(false)
          return
        }
        const data = await resp.json()

        const t = data?.totals || {}
        setBullock({
          onlineSales: Number(t.onlineSales || 0),
          scratchSales: Number(t.scratchSales || 0),
          // scratchFreeTickets is not provided by Bullock; leave undefined so UI shows '-'
          payouts: Number(t.payouts || 0),
          datawaveValue: Number(t.dataWave || 0),
          datawaveFee: Number(t.dataWaveFee || 0),
        })

        const rows = Array.isArray(data?.rows) ? data.rows : []
        const found = rows.find((r:any) => (r.lottoPayout != null) || (r.onlineLottoTotal != null) || (r.instantLottTotal != null))
        if (found) {
          setExistingEntry(true)
          setLotteryValues({
            onlineSales: Number(found.onlineLottoTotal ?? 0),
            scratchSales: Number(found.instantLottTotal ?? 0),
            payouts: Number(found.lottoPayout ?? 0),
            datawaveValue: Number(found.dataWave ?? 0),
            datawaveFee: Number(found.feeDataWave ?? 0),
            scratchFreeTickets: Number(found.scratchFreeTickets ?? 0),
          })
          if (Array.isArray(found.images) && found.images.length) setLotteryImages(found.images)
        } else {
          setExistingEntry(false)
          setLotteryValues({
            onlineSales: 0,
            scratchSales: 0,
            scratchFreeTickets: 0,
            payouts: 0,
            datawaveValue: 0,
            datawaveFee: 0,
          })
          setLotteryImages([])
        }
      } catch (e) {
        if ((e as any).name !== 'AbortError') console.warn('Lottery totals fetch failed', e)
      }
    })()

    return () => controller.abort()
  }, [site, date, setLotteryValues, setLotteryImages, user])

  // Over/Short calculation helpers
  const overShort = useMemo(() => {
    return {
      onlineSales: (lotteryValues.onlineSales || 0) - (bullock.onlineSales || 0),
      scratchSales: (lotteryValues.scratchSales || 0) - (bullock.scratchSales || 0),
      scratchFreeTickets: (lotteryValues.scratchFreeTickets || 0) - (bullock.scratchFreeTickets || 0),
      payouts: (lotteryValues.payouts || 0) - (bullock.payouts || 0),
      datawaveValue: (lotteryValues.datawaveValue || 0) - (bullock.datawaveValue || 0),
      datawaveFee: (lotteryValues.datawaveFee || 0) - (bullock.datawaveFee || 0),
    }
  }, [lotteryValues, bullock])

  const handleChange = (key: string, value: string) => {
    const num = Number(value || 0)
    if (key === 'datawaveValue') setLotteryValues({ datawaveValue: num })
    else if (key === 'datawaveFee') setLotteryValues({ datawaveFee: num })
    else setLotteryValues({ [key]: num } as any)
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Lottery Reconciliation</h2>
      <div className="mb-4">
        <div className="grid grid-cols-2 gap-4 items-end">
          <div>
            <h3 className="text-sm font-semibold mb-2">Site</h3>
            <SitePicker value={site} onValueChange={(v) => setSite(v)} placeholder="Select site" />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">Date</h3>
            <DatePicker
              date={date}
              setDate={(value) => {
                if (typeof value === 'function') {
                  const newDate = value(date);
                  if (newDate) setDate(newDate);
                } else {
                  setDate(value);
                }
              }}
            />
          </div>
        </div>
        {/* {existingEntry && <div className="mt-2 text-sm text-muted-foreground">Existing lottery entry found for this site/date — values and images populated.</div>} */}
      </div>

      <div className="overflow-x-auto border rounded-md">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Description</th>
              <th className="px-4 py-2 text-left">Lottery Report</th>
              <th className="px-4 py-2 text-left">Bullock Report</th>
              <th className="px-4 py-2 text-left">Over / Short</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.key} className="border-t">
                <td className="px-4 py-2">{r.label}</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    className="w-40 p-2 border rounded"
                    value={(lotteryValues as any)[r.key] ?? 0}
                    onChange={(e) => handleChange(r.key, e.target.value)}
                  />
                </td>
                <td className="px-4 py-2">{(bullock as any)[r.key] ?? '-'}</td>
                <td className="px-4 py-2">{(overShort as any)[r.key] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between mt-4">
        <div />
        <Link to="/cash-summary/lottery-images">
          <Button>Next</Button>
        </Link>
      </div>
    </div>
  )
}