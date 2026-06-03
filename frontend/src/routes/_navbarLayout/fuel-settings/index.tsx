import { createFileRoute } from '@tanstack/react-router'
import { Truck, Flame, Percent, SlidersHorizontal, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export const Route = createFileRoute('/_navbarLayout/fuel-settings/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuth()
  const access = user?.access || {}

  // Full breakdown of parameters matching your specific table definitions
  const categories = [
    { 
      name: 'Carrier Haulage', 
      icon: Truck, 
      permissionKey: 'haulage',
      desc: 'Manage logistics haulage rates and freight routing parameters.' 
    },
    { 
      name: 'Carrier FSC', 
      icon: Flame, 
      permissionKey: 'fsc',
      desc: 'Configure fuel surcharge matrix calculations for carriers.' 
    },
    { 
      name: 'Supplier Discounts', 
      icon: Percent, 
      permissionKey: 'supplierDiscounts',
      desc: 'Maintain live and scheduled vendor fuel purchase pricing reductions.' 
    },
  ]

  // Filter the grid items exactly like you do in the sidebar navigation
  const authorizedCategories = categories.filter(
    (cat) => access?.fuelSettings?.[cat.permissionKey]?.value === true
  )

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50/30 p-8 relative overflow-hidden">
      {/* Background Decorative Element */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <SlidersHorizontal className="absolute -bottom-24 -right-24 h-96 w-96 text-slate-200 rotate-12" />
      </div>

      <div className="max-w-2xl w-full text-center relative z-10">
        {/* Icon Header */}
        <div className="mb-8 flex justify-center">
          <div className="h-20 w-20 bg-white rounded-3xl shadow-xl shadow-blue-100 flex items-center justify-center border border-slate-100">
            <SlidersHorizontal className="h-10 w-10 text-blue-600" />
          </div>
        </div>

        {/* Text Content */}
        <h1 className="text-3xl font-black tracking-tighter text-slate-900 mb-3 italic uppercase">
          Fuel Settings & Parameters
        </h1>
        <p className="text-slate-500 font-medium mb-12 max-w-md mx-auto text-sm">
          Select a price variable option from the sidebar to begin analyzing or updating live structural fuel costs, surcharges, and discount tables.
        </p>

        {/* Status Mini-Grid (Conditioned by Permissions) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-4">
          {authorizedCategories.map((cat) => {
            const Icon = cat.icon
            return (
              <div 
                key={cat.name} 
                className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center gap-2 group hover:border-blue-200 transition-all"
              >
                <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 group-hover:text-slate-900">
                  {cat.name}
                </span>
                <p className="text-[11px] text-slate-400 font-normal leading-normal">
                  {cat.desc}
                </p>
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