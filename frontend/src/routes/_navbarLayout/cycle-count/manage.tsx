import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { CalendarDays, Package, Layers } from 'lucide-react'

export const Route = createFileRoute('/_navbarLayout/cycle-count/manage')({
  component: RouteComponent,
})

function RouteComponent() {
  const activeProps = { className: 'bg-slate-900 text-white shadow-xs hover:bg-slate-900' }

  const links = [
    { 
      to: '/cycle-count/manage/schedule', 
      label: 'Count Schedule', 
      icon: CalendarDays 
    },
    { 
      to: '/cycle-count/manage/item-bk', 
      label: 'Item Book (Products)', 
      icon: Package 
    },
    { 
      to: '/cycle-count/manage/group', 
      label: 'Schedule Filter Groups', 
      icon: Layers 
    },
  ]

  return (
    <div className="flex w-full h-[calc(100vh-80px)] overflow-hidden bg-slate-50/50 select-none">
      {/* COLUMN 1: Main Control Navigation */}
      <aside className="w-16 lg:w-64 flex flex-col border-r border-slate-200/80 bg-white p-3 lg:p-4 gap-1.5 shrink-0">
        <div className="mb-4 px-2 hidden lg:block">
          <h2 className="text-[12px] font-black uppercase text-slate-400 tracking-wide">
            Cycle Count Control Panel
          </h2>
        </div>
        
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            activeProps={activeProps}
            className="flex items-center justify-center lg:justify-start gap-3 p-3 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-all group font-sans text-xs font-bold"
          >
            <link.icon className="h-5 w-5 shrink-0" />
            <span className="hidden lg:block tracking-tight text-medium">{link.label}</span>
          </Link>
        ))}
      </aside>

      {/* Renders COLUMN 2 (List panels) and COLUMN 3 (Form/Workspace detail views) */}
      <main className="flex-1 flex overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}