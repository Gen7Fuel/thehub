import { createFileRoute } from '@tanstack/react-router'
import { CalendarDays, ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/_navbarLayout/cycle-count/manage/schedule/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50/30 min-h-[60vh] select-none">
      <div className="text-center animate-in fade-in zoom-in duration-300">
        <div className="h-16 w-16 bg-white rounded-2xl shadow-sm border border-slate-200/60 flex items-center justify-center mx-auto mb-4">
          <CalendarDays className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-slate-900">
          Sequence Schedules
        </h2>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1 mb-6">
          Select an active schedule timeframe sequence from the sub-panel
        </p>
        <div className="flex items-center justify-center gap-2 text-emerald-600 animate-pulse text-[10px] font-black uppercase tracking-widest">
          <ArrowLeft className="h-3 w-3" /> Awaiting Sequence Selection
        </div>
      </div>
    </div>
  )
}