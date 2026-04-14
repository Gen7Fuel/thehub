import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { Warehouse, Truck, UserCheck, MapPin } from 'lucide-react'

export const Route = createFileRoute('/_navbarLayout/fuel-management/manage')({
  component: ManageLayout,
})

function ManageLayout() {
  const activeProps = { className: 'bg-primary text-primary-foreground shadow-md' }

  const links = [
    { to: '/fuel-management/manage/locations', label: 'Stations', icon: MapPin },
    { to: '/fuel-management/manage/racks', label: 'Fuel Racks', icon: Warehouse },
    { to: '/fuel-management/manage/carriers', label: 'Carriers', icon: Truck },
    { to: '/fuel-management/manage/suppliers', label: 'Suppliers', icon: UserCheck },
  ]

  return (
    <div className="flex w-full h-[calc(100vh-80px)] overflow-hidden bg-gray-50/50">
      {/* COLUMN 1: Main Categories */}
      <aside className="w-16 lg:w-64 flex flex-col border-r bg-white p-4 gap-2 shrink-0">
        <div className="mb-4 px-2">
          <h2 className="text-xs font-bold uppercase text-muted-foreground tracking-tighter">Fuel Configurations</h2>
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

      {/* Renders COLUMN 2 and COLUMN 3 */}
      <main className="flex-1 flex overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}