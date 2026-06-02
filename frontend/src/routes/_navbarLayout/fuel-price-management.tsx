import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { Truck, Flame, Percent } from 'lucide-react'

export const Route = createFileRoute('/_navbarLayout/fuel-price-management')({
  component: FuelPricingManagementLayout,
})

function FuelPricingManagementLayout() {
  const activeProps = { className: 'bg-primary text-primary-foreground shadow-md' }

  const links = [
    { 
      to: '/fuel-price-management/carrier-haulage', 
      label: 'Carrier Haulage', 
      icon: Truck 
    },
    { 
      to: '/fuel-price-management/carrier-fcs', 
      label: 'Carrier FSC', 
      icon: Flame 
    },
    { 
      to: '/fuel-price-management/supplier-discounts', 
      label: 'Supplier Discounts', 
      icon: Percent 
    },
  ]

  return (
    <div className="flex w-full h-[calc(100vh-80px)] overflow-hidden bg-gray-50/50">
      {/* COLUMN 1: Price Management Parameters */}
      <aside className="w-16 lg:w-64 flex flex-col border-r bg-white p-4 gap-2 shrink-0">
        <div className="mb-4 px-2">
          <h2 className="text-xs font-bold uppercase text-muted-foreground tracking-tighter">
            Price Parameters
          </h2>
        </div>
        
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            activeProps={activeProps}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-all group"
          >
            <link.icon className="h-5 w-5 shrink-0" />
            <span className="hidden lg:block font-medium">{link.label}</span>
          </Link>
        ))}
      </aside>

      {/* Renders COLUMN 2 and COLUMN 3 (The data tables) */}
      <main className="flex-1 flex overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
