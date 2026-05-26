import { createFileRoute } from '@tanstack/react-router'
import { CalendarDays, Package, Layers, ClipboardList, ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/_navbarLayout/cycle-count/manage/')({
  component: RouteComponent,
})

function RouteComponent() {
  const categories = [
    { 
      name: 'Schedules', 
      icon: CalendarDays, 
      desc: 'Set up ongoing date sequences, calendar frequencies, and timeline boundaries.' 
    },
    { 
      name: 'Item Bank', 
      icon: Package, 
      desc: 'Reconcile core item master ledgers, barcodes, cost pricing, and tracking metrics.' 
    },
    { 
      name: 'Count Groups', 
      icon: Layers, 
      desc: 'Organize dynamic group identifiers, inventory matching profiles, and site targets.' 
    },
  ]

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50/30 p-8 min-h-[75vh] select-none">
      {/* Background Decorative Element */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <ClipboardList className="absolute -bottom-24 -right-24 h-96 w-96 text-slate-200/70 rotate-12" />
      </div>

      <div className="max-w-2xl w-full text-center relative z-10">
        {/* Icon Header */}
        <div className="mb-8 flex justify-center">
          <div className="h-20 w-20 bg-white rounded-3xl shadow-xl shadow-slate-100 flex items-center justify-center border border-slate-200/60">
            <ClipboardList className="h-10 w-10 text-slate-900" />
          </div>
        </div>

        {/* Text Content */}
        <h1 className="text-3xl font-black tracking-tighter text-slate-900 mb-3 italic uppercase">
          Inventory Control Workspace
        </h1>
        <p className="text-slate-500 font-medium mb-12 max-w-md mx-auto text-xs leading-relaxed">
          Select a parameter matrix layout option from the left sidebar panel to begin administering workflow schedules, raw item metrics, or master group configurations.
        </p>

        {/* Status Mini-Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-4 max-w-xl mx-auto">
          {categories.map((cat) => {
            const Icon = cat.icon
            return (
              <div 
                key={cat.name} 
                className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-2xs flex flex-col items-center gap-3 group hover:border-slate-400 hover:shadow-xs transition-all duration-200"
              >
                <div className="h-11 w-11 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-slate-900 group-hover:bg-slate-100 transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 group-hover:text-slate-900 transition-colors">
                    {cat.name}
                  </span>
                  <p className="text-[10px] text-slate-400 font-medium leading-normal hidden md:block px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {cat.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Instruction Footer */}
        <div className="mt-12 flex items-center justify-center gap-2 text-slate-800 animate-pulse">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Awaiting Panel Selection</span>
        </div>
      </div>
    </div>
  )
}