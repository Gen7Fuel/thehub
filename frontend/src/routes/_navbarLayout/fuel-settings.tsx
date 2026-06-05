import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { Truck, Flame, Percent, Fuel } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export const Route = createFileRoute('/_navbarLayout/fuel-settings')({
  component: FuelPricingManagementLayout,
})

function FuelPricingManagementLayout() {
  const activeProps = { className: 'bg-primary text-primary-foreground shadow-md' }
  const { user } = useAuth()
  const access = user?.access || {}

  const links = [
    {
      to: '/fuel-settings/carrier-haulage',
      label: 'Carrier Haulage',
      icon: Truck,
      permissionKey: 'haulage' // Matches your access key
    },
    {
      to: '/fuel-settings/carrier-fcs',
      label: 'Carrier FSC',
      icon: Flame,
      permissionKey: 'fsc' // Matches your access key
    },
    {
      to: '/fuel-settings/supplier-discounts',
      label: 'Supplier Discounts',
      icon: Percent,
      permissionKey: 'supplierDiscounts' // Matches your access key
    },
    {
      to: '/fuel-settings/station-discounts',
      label: 'Station Discounts',
      icon: Fuel,
      permissionKey: 'stationDiscounts' // Matches your access key
    }
  ]

  // Filter links based on whether the user has the 'value' permission set to true
  const authorizedLinks = links.filter((link) => {
    return access?.fuelSettings?.[link.permissionKey]?.value === true
  })

  return (
    <div className="flex w-full h-[calc(100vh-80px)] overflow-hidden bg-gray-50/50">
      <aside className="w-16 lg:w-64 flex flex-col border-r bg-white p-4 gap-2 shrink-0">
        <div className="mb-4 px-2">
          <h2 className="text-xs font-bold uppercase text-muted-foreground tracking-tighter">
            Price Parameters
          </h2>
        </div>

        {authorizedLinks.map((link) => (
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

      <main className="flex-1 flex overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}