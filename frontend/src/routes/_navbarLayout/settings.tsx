import { createFileRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/settings')({
  component: RouteComponent,
})

function RouteComponent() {
  const activeProps = {
    className: 'bg-gray-100 rounded-md',
  }

  const links = [
    { to: '/settings/paypoints', label: 'Pay Points' },
    { to: '/settings/users', label: 'Users' },
    { to: '/settings/permissions', label: 'Permissions' }
  ]

  return (
    <div className='flex pt-15 mx-auto'>
      <aside className='flex flex-col w-1/4 p-4 border-r border-gray-300 border-dashed justify-start items-end'>
      {links.map((link) => (
        <Link key={link.to} className='p-2' to={link.to} activeProps={activeProps}>
          {link.label}
        </Link>
      ))}
      </aside>
      <main className='w-3/4'>
        <Outlet />
      </main>
    </div>
  )
}
