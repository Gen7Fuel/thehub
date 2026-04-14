import { createFileRoute } from '@tanstack/react-router'
import { Building2, Fuel, Truck, Warehouse, LayoutDashboard, ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/_navbarLayout/fuel-management/manage/')({
  component: RouteComponent,
})

function RouteComponent() {
  const categories = [
    { name: 'Stations', icon: Fuel, desc: 'Manage tank configurations and site specs.' },
    { name: 'Racks', icon: Warehouse, desc: 'Configure supply points and rack locations.' },
    { name: 'Carriers', icon: Truck, desc: 'Assign logistics partners and contact info.' },
    { name: 'Suppliers', icon: Building2, desc: 'Manage fuel vendors and sourcing.' },
  ]

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50/30 p-8">
      {/* Background Decorative Element */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <LayoutDashboard className="absolute -bottom-24 -right-24 h-96 w-96 text-slate-200 rotate-12" />
      </div>

      <div className="max-w-2xl w-full text-center relative z-10">
        {/* Icon Header */}
        <div className="mb-8 flex justify-center">
          <div className="h-20 w-20 bg-white rounded-3xl shadow-xl shadow-blue-100 flex items-center justify-center border border-slate-100">
            <LayoutDashboard className="h-10 w-10 text-blue-600" />
          </div>
        </div>

        {/* Text Content */}
        <h1 className="text-3xl font-black tracking-tighter text-slate-900 mb-3 italic uppercase">
          Fuel Configurations Management
        </h1>
        <p className="text-slate-500 font-medium mb-12 max-w-md mx-auto">
          Please select a category from the sidebar to begin managing your fuel infrastructure, logistics, and supply chain data.
        </p>

        {/* Status Mini-Grid (Visual Only) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4">
          {categories.map((cat) => {
            const Icon = cat.icon
            return (
              <div 
                key={cat.name} 
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center gap-2 group hover:border-blue-200 transition-all"
              >
                <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-900">
                  {cat.name}
                </span>
              </div>
            )
          })}
        </div>

        {/* Instruction Footer */}
        <div className="mt-12 flex items-center justify-center gap-2 text-blue-500 animate-pulse">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-widest">Awaiting Selection</span>
        </div>
      </div>
    </div>
  )
}