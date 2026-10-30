import { createFileRoute } from '@tanstack/react-router'
import { Loader2, Save, Fuel } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { SitePicker } from '@/components/custom/sitePicker'
import { fuelStationTanksService } from '@/api/fuel-management/fuel-station-tanks.service'

export const Route = createFileRoute('/_navbarLayout/fuel-dip-readings')({
  validateSearch: (search: Record<string, unknown>) => ({
    site: (search.site as string) || '',
  }),
  component: FuelDipReadings,
})

type Tank = {
  _id: string
  stationName: string
  tankNo: number
  grade: string
  currentVolume?: number
  lastUpdatedVolumeReadingDateTime?: string
}

function FuelDipReadings() {
  const { site } = Route.useSearch()
  const [tanks, setTanks] = useState<Tank[]>([])
  const [volumes, setVolumes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const fetchTanks = async () => {
    setLoading(true)
    try {
      const siteLabel = site || 'the site picker'
      setTanks(await fuelStationTanksService.syncAllVolumes<Tank[]>(
        'fuel-dip-readings',
        `Fuel dip readings loaded for ${siteLabel}`,
        'fuelDipReadings.addNewReadings',
      ))
    } catch {
      toast.error('Unable to load tank readings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTanks() }, [])

  const visibleTanks = useMemo(
    () => tanks.filter((tank) => tank.stationName === site),
    [tanks, site],
  )

  const isEditable = (tank: Tank) => {
    const reading = tank.lastUpdatedVolumeReadingDateTime || ''
    return !reading || reading === 'No latest reading available' ||
      reading.includes('Yesterday') || reading.includes('(Manual)')
  }

  const saveReading = async (tank: Tank) => {
    const volume = volumes[tank._id]?.trim()
    if (!volume || Number.isNaN(Number(volume)) || Number(volume) < 0) {
      toast.error(`Enter a valid volume for tank #${tank.tankNo}`)
      return
    }

    setSaving(tank._id)
    const now = new Date()
    try {
      await fuelStationTanksService.manualUpdate(
        tank._id,
        {
          volume,
          manualDate: now.toISOString().slice(0, 10),
          manualTime: now.toTimeString().slice(0, 5),
        },
        `Tank #${tank.tankNo} (${tank.grade}) at ${tank.stationName}`,
        'fuel-dip-readings',
        'fuelDipReadings.addNewReadings',
      )
      toast.success(`Tank #${tank.tankNo} reading saved`)
      setVolumes((current) => ({ ...current, [tank._id]: '' }))
      await fetchTanks()
    } catch {
      toast.error(`Unable to save tank #${tank.tankNo} reading`)
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin" /></div>

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-600 p-2 text-white"><Fuel className="size-5" /></div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Fuel Dips Reading</h1>
              <p className="text-sm text-slate-500">Enter the physical tank volume in liters.</p>
            </div>
          </div>
          <SitePicker value={site} className="w-full sm:w-[240px]" />
        </div>
      </section>

      {!site ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Select a site to begin.</div>
      ) : visibleTanks.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No tanks are configured for this site.</div>
      ) : (
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTanks.map((tank) => {
            const editable = isEditable(tank)
            return (
              <article key={tank._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tank #{tank.tankNo}</p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">{tank.grade}</h2>
                  </div>
                  {!editable && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700">Automatic reading</span>}
                </div>
                {editable ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="flex-1 text-sm font-medium text-slate-700">Volume (L)
                      <input
                        inputMode="decimal"
                        type="number"
                        min="0"
                        step="1"
                        value={volumes[tank._id] || ''}
                        onChange={(event) => setVolumes((current) => ({ ...current, [tank._id]: event.target.value }))}
                        className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                        placeholder="0"
                      />
                    </label>
                    <button type="button" onClick={() => saveReading(tank)} disabled={saving === tank._id} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60">
                      {saving === tank._id ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
                    </button>
                  </div>
                ) : <p className="text-sm text-slate-500">A current automatic reading is available.</p>}
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}
