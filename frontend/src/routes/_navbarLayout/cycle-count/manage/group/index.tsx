import { createFileRoute } from '@tanstack/react-router'
import { Layers, ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/_navbarLayout/cycle-count/manage/group/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50/30 min-h-[60vh] select-none">
      <div className="text-center animate-in fade-in zoom-in duration-300">
        <div className="h-16 w-16 bg-white rounded-2xl shadow-sm border border-slate-200/60 flex items-center justify-center mx-auto mb-4">
          <Layers className="h-8 w-8 text-indigo-600" />
        </div>
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-slate-900">
          Count Groups Matrix
        </h2>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1 mb-6">
          Select or create a layout group to allocate target parameters
        </p>
        <div className="flex items-center justify-center gap-2 text-indigo-600 animate-pulse text-[10px] font-black uppercase tracking-widest">
          <ArrowLeft className="h-3 w-3" /> Awaiting Profile Selection
        </div>
      </div>
    </div>
  )
}